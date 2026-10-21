import { Ride, TrackPoint, RawGPSPoint, RideMode } from '../types/ride';
import { fetchRouteEta } from './etaService';
import { Coordinates } from './distance';
import { LiveTrackingState } from '../types/tracking';
import { GPS_CONFIG, GPS_FILTER_CONFIG } from '../constants/gps';
import { validateGPSPoint } from './gpsFilter';
import { recordGpsDiagnostic } from './gpsDiagnostics';
import {
  createRide,
  updateRide,
  getActiveRide,
  deleteRide,
  setRideEstimate,
} from '../database/rideRepository';
import {
  insertTrackPoint,
  getTrackPointsByRideId,
} from '../database/trackPointRepository';
import {
  startLocationTracking,
  stopLocationTracking,
  getCurrentGPSFix,
  requestLocationPermissions,
} from './location';

type StateListener = (state: LiveTrackingState) => void;

class TrackingService {
  private state: LiveTrackingState = {
    status: 'idle',
    currentRide: null,
    currentSpeedKmh: 0,
    currentDistanceKm: 0,
    currentDurationSeconds: 0,
    currentMovingTimeSeconds: 0,
    currentAvgSpeedKmh: 0,
    currentMaxSpeedKmh: 0,
    currentLocation: null,
    routeCoordinates: [],
    recentPointsCount: 0,
    lastUpdated: Date.now(),
    gpsSignalState: 'searching',
  };

  private listeners: Set<StateListener> = new Set();
  private lastRecordedPoint: RawGPSPoint | null = null;
  private stationaryAnchor: RawGPSPoint | null = null;
  private lastPointReceivedTime: number = 0;
  private isGpsStale: boolean = false;
  private isStill: boolean = true;
  private consecutiveMovingFixes: number = 0;
  private speedSmoothingQueue: number[] = [];
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private tickCounter: number = 0;
  private lastDbSyncTime: number = 0;
  private lastUiNotifyTime: number = 0;

  constructor() {
    // Single location subscription lifecycle is managed explicitly in startRide/resumeRide/pauseRide/endRide
  }

  public getState(): LiveTrackingState {
    return { ...this.state };
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(force: boolean = false): void {
    const now = Date.now();
    if (!force && now - this.lastUiNotifyTime < GPS_CONFIG.UI_THROTTLE_INTERVAL_MS) {
      return;
    }
    this.lastUiNotifyTime = now;
    const currentState = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(currentState);
      } catch (err) {
        console.error('[Rideoxy] Error in tracking listener:', err);
      }
    });
  }

  /**
   * Check for interrupted/uncompleted rides on app startup
   */
  public async checkForInterruptedRide(): Promise<Ride | null> {
    try {
      const activeRide = await getActiveRide();
      if (activeRide) {
        const trackPoints = await getTrackPointsByRideId(activeRide.id);
        const routeCoords: [number, number][] = trackPoints.map((pt) => [pt.longitude, pt.latitude]);
        
        this.state = {
          ...this.state,
          status: 'interrupted',
          currentRide: activeRide,
          currentSpeedKmh: 0,
          currentDistanceKm: activeRide.distance,
          currentDurationSeconds: activeRide.duration,
          currentMovingTimeSeconds: activeRide.moving_time,
          currentAvgSpeedKmh: activeRide.average_speed,
          currentMaxSpeedKmh: activeRide.max_speed,
          routeCoordinates: routeCoords,
          recentPointsCount: trackPoints.length,
          lastUpdated: Date.now(),
        };

        this.isGpsStale = true;

        if (trackPoints.length > 0) {
          const last = trackPoints[trackPoints.length - 1];
          this.lastRecordedPoint = {
            latitude: last.latitude,
            longitude: last.longitude,
            altitude: last.altitude,
            speed: last.speed,
            accuracy: last.accuracy,
            heading: last.heading,
            timestamp: last.timestamp,
          };
          this.state.currentLocation = {
            latitude: last.latitude,
            longitude: last.longitude,
            heading: last.heading,
            accuracy: last.accuracy,
            altitude: last.altitude,
          };
        }

        this.notifyListeners(true);
        return activeRide;
      }
      return null;
    } catch (err) {
      console.warn('[Rideoxy] Error checking for active ride:', err);
      return null;
    }
  }

  /**
   * Start a brand new ride
   */
  public async startRide(options?: {
    rideMode?: RideMode;
    destination?: {
      name: string;
      lat: number;
      lng: number;
    } | null;
    manualMinutes?: number | null;
  }): Promise<{
    success: boolean;
    error?: string;
    errorType?: 'permission' | 'location' | 'database' | 'system';
  }> {
    try {
      const perms = await requestLocationPermissions();
      if (!perms.canTrack) {
        return {
          success: false,
          error: perms.isReducedAccuracy
            ? 'Precise location is required. Please enable Precise Location in Settings.'
            : 'Location permission is required to record a ride.',
          errorType: 'permission',
        };
      }

      this.state.status = 'starting';
      this.notifyListeners(true);

      const initialFix = await getCurrentGPSFix();
      const startTime = Date.now();
      const rideId = `ride_${startTime}_${Math.random().toString(36).substring(2, 7)}`;

      const selectedMode = options?.rideMode ?? 'free';
      const dest = options?.destination;
      const manualMins = options?.manualMinutes;

      const newRide: Ride = {
        id: rideId,
        start_time: startTime,
        end_time: null,
        duration: 0,
        moving_time: 0,
        distance: 0,
        average_speed: 0,
        max_speed: 0,
        status: 'running',
        created_at: startTime,
        ride_mode: selectedMode,
        destination_name: dest?.name ?? null,
        destination_lat: dest?.lat ?? null,
        destination_lng: dest?.lng ?? null,
        estimated_duration_sec: null,
        estimated_distance_m: null,
        estimate_source: null,
      };

      try {
        await createRide(newRide);

        if (initialFix) {
          await insertTrackPoint({
            ride_id: rideId,
            latitude: initialFix.latitude,
            longitude: initialFix.longitude,
            altitude: initialFix.altitude,
            speed: 0,
            accuracy: initialFix.accuracy,
            heading: initialFix.heading,
            timestamp: initialFix.timestamp,
          });
        }
      } catch (dbErr) {
        console.error('[Rideoxy] [TrackingService] Database failure while creating ride record:', dbErr);
        this.state.status = 'idle';
        this.notifyListeners(true);
        return {
          success: false,
          error: dbErr instanceof Error ? dbErr.message : 'Database error while initializing ride.',
          errorType: 'database',
        };
      }

      this.lastRecordedPoint = initialFix;
      this.stationaryAnchor = initialFix;
      this.isStill = true;
      this.consecutiveMovingFixes = 0;
      this.speedSmoothingQueue = [];
      this.lastPointReceivedTime = initialFix ? Date.now() : 0;
      this.isGpsStale = false;
      const initialRouteCoords: [number, number][] = initialFix
        ? [[initialFix.longitude, initialFix.latitude]]
        : [];

      // Initial state: speed is strictly 0 km/h until live motion is validated
      this.state = {
        status: 'running',
        currentRide: newRide,
        currentSpeedKmh: 0,
        currentDistanceKm: 0,
        currentDurationSeconds: 0,
        currentMovingTimeSeconds: 0,
        currentAvgSpeedKmh: 0,
        currentMaxSpeedKmh: 0,
        currentLocation: initialFix
          ? {
              latitude: initialFix.latitude,
              longitude: initialFix.longitude,
              heading: initialFix.heading,
              accuracy: initialFix.accuracy,
              altitude: initialFix.altitude,
            }
          : null,
        routeCoordinates: initialRouteCoords,
        recentPointsCount: initialFix ? 1 : 0,
        lastUpdated: Date.now(),
        gpsSignalState: initialFix ? 'good' : 'searching',
      };

      // Start duration & staleness watchdog ticker
      this.startDurationTimer();

      // Start authoritative single location tracking subscription
      try {
        const trackRes = await startLocationTracking((point) => {
          this.handleIncomingGPSPoints([point]);
        });
        if (!trackRes.success) {
          throw new Error('Failed to start location tracking service.');
        }
      } catch (locErr) {
        console.error('[Rideoxy] [TrackingService] Location tracking service error:', locErr);
        this.stopDurationTimer();
        this.state.status = 'idle';
        this.notifyListeners(true);
        return {
          success: false,
          error: locErr instanceof Error ? locErr.message : 'Failed to start GPS tracking service.',
          errorType: 'location',
        };
      }

      // If destination mode: asynchronously resolve origin fix and compute estimate
      if (selectedMode === 'destination' && dest) {
        this.resolveDestinationEstimate(rideId, dest, manualMins, initialFix).catch((err) => {
          console.warn('[Rideoxy] [TrackingService] Error computing destination estimate:', err);
        });
      }

      this.notifyListeners(true);
      return { success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[Rideoxy] [TrackingService] Unexpected error in startRide:', err);
      this.stopDurationTimer();
      this.state.status = 'idle';
      this.notifyListeners(true);
      return { success: false, error: errorMsg, errorType: 'system' };
    }
  }

  /**
   * Pause the active ride
   */
  public async pauseRide(): Promise<void> {
    if (this.state.status !== 'running' || !this.state.currentRide) return;

    this.state.status = 'paused';
    this.state.currentSpeedKmh = 0;
    this.lastPointReceivedTime = 0;
    this.isGpsStale = true;
    this.isStill = true;
    this.consecutiveMovingFixes = 0;
    this.speedSmoothingQueue = [];

    // Stop native location tracking while paused to save battery and prevent unwanted background churn
    await stopLocationTracking();

    await updateRide(this.state.currentRide.id, {
      status: 'paused',
      duration: this.state.currentDurationSeconds,
      moving_time: Math.round(this.state.currentMovingTimeSeconds),
      distance: this.state.currentDistanceKm,
      average_speed: this.state.currentAvgSpeedKmh,
      max_speed: this.state.currentMaxSpeedKmh,
    });
    this.notifyListeners(true);
  }

  /**
   * Resume the active ride
   */
  public async resumeRide(): Promise<void> {
    if (this.state.status !== 'paused' && this.state.status !== 'interrupted') return;
    if (!this.state.currentRide) return;

    this.state.status = 'running';
    this.state.currentSpeedKmh = 0;
    this.lastPointReceivedTime = 0;
    this.isGpsStale = true;
    this.isStill = true;
    this.consecutiveMovingFixes = 0;
    this.speedSmoothingQueue = [];

    await updateRide(this.state.currentRide.id, {
      status: 'running',
    });

    if (!this.timerInterval) {
      this.startDurationTimer();
    }

    // Re-anchor stationary reference upon resume
    if (this.lastRecordedPoint) {
      this.stationaryAnchor = this.lastRecordedPoint;
    }

    // Start single authoritative location subscription
    await startLocationTracking((point) => {
      this.handleIncomingGPSPoints([point]);
    });

    this.notifyListeners(true);
  }

  /**
   * End the active ride and finalize in SQLite
   */
  public async endRide(): Promise<Ride | null> {
    if (!this.state.currentRide) return null;

    const rideId = this.state.currentRide.id;
    this.state.status = 'finishing';
    this.stopDurationTimer();
    await stopLocationTracking();
    this.stationaryAnchor = null;

    const endTime = Date.now();
    const finalRide: Ride = {
      ...this.state.currentRide,
      end_time: endTime,
      duration: this.state.currentDurationSeconds,
      moving_time: Math.round(this.state.currentMovingTimeSeconds),
      distance: Math.round(this.state.currentDistanceKm * 100) / 100,
      average_speed: this.state.currentAvgSpeedKmh,
      max_speed: this.state.currentMaxSpeedKmh,
      status: 'completed',
    };

    await updateRide(rideId, {
      end_time: endTime,
      duration: finalRide.duration,
      moving_time: finalRide.moving_time,
      distance: finalRide.distance,
      average_speed: finalRide.average_speed,
      max_speed: finalRide.max_speed,
      status: 'completed',
    });

    this.state = {
      ...this.state,
      status: 'completed',
      currentRide: finalRide,
      currentSpeedKmh: 0,
      lastUpdated: Date.now(),
    };

    this.notifyListeners(true);
    return finalRide;
  }

  /**
   * Discard active/interrupted ride without saving
   */
  public async discardRide(): Promise<void> {
    this.stopDurationTimer();
    await stopLocationTracking();
    this.stationaryAnchor = null;

    if (this.state.currentRide) {
      await deleteRide(this.state.currentRide.id);
    }

    this.resetToIdle();
  }

  /**
   * End an interrupted ride directly and save as completed
   */
  public async endInterruptedRideAndSave(): Promise<Ride | null> {
    return this.endRide();
  }

  /**
   * Reset state to IDLE
   */
  public resetToIdle(): void {
    this.stopDurationTimer();
    stopLocationTracking();
    this.stationaryAnchor = null;

    this.state = {
      status: 'idle',
      currentRide: null,
      currentSpeedKmh: 0,
      currentDistanceKm: 0,
      currentDurationSeconds: 0,
      currentMovingTimeSeconds: 0,
      currentAvgSpeedKmh: 0,
      currentMaxSpeedKmh: 0,
      currentLocation: null,
      routeCoordinates: [],
      recentPointsCount: 0,
      lastUpdated: Date.now(),
      gpsSignalState: 'searching',
    };
    this.lastRecordedPoint = null;
    this.stationaryAnchor = null;
    this.isStill = true;
    this.consecutiveMovingFixes = 0;
    this.speedSmoothingQueue = [];
    this.lastPointReceivedTime = 0;
    this.isGpsStale = false;
    this.notifyListeners(true);
  }

  /**
   * Asynchronously resolves first accepted GPS fix from trackingService and computes route estimate
   */
  private async resolveDestinationEstimate(
    rideId: string,
    dest: { name: string; lat: number; lng: number },
    manualMinutes?: number | null,
    initialFix?: RawGPSPoint | null
  ): Promise<void> {
    const destinationCoords: Coordinates = { latitude: dest.lat, longitude: dest.lng };

    // 1. Wait up to 10 seconds for the first accepted GPS fix
    let originFix: Coordinates | null = null;
    if (initialFix && initialFix.accuracy && initialFix.accuracy <= GPS_CONFIG.MAX_ACCEPTABLE_ACCURACY_METERS) {
      originFix = { latitude: initialFix.latitude, longitude: initialFix.longitude };
    } else {
      const startWait = Date.now();
      while (Date.now() - startWait < 10000) {
        if (this.state.currentRide?.id !== rideId || this.state.status !== 'running') {
          return; // Ride stopped or changed
        }
        if (
          this.lastRecordedPoint &&
          this.lastRecordedPoint.accuracy &&
          this.lastRecordedPoint.accuracy <= GPS_CONFIG.MAX_ACCEPTABLE_ACCURACY_METERS
        ) {
          originFix = { latitude: this.lastRecordedPoint.latitude, longitude: this.lastRecordedPoint.longitude };
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // 2. If manual minutes were entered, they take precedence (rider's explicit choice)
    if (manualMinutes && manualMinutes > 0) {
      const manualSec = Math.round(manualMinutes * 60);
      let providerDistM: number | null = null;

      // Attempt routing once to obtain estimated distance if origin fix was resolved
      if (originFix) {
        try {
          const routeRes = await fetchRouteEta(originFix, destinationCoords, 'destination');
          if (routeRes.success && !routeRes.estimate.isLowTrust) {
            providerDistM = routeRes.estimate.distanceM;
          }
        } catch {
          // Ignore routing errors when manual minutes are explicitly provided
        }
      }

      await setRideEstimate(rideId, {
        estimated_duration_sec: manualSec,
        estimated_distance_m: providerDistM,
        estimate_source: 'manual',
      });

      if (this.state.currentRide && this.state.currentRide.id === rideId) {
        this.state.currentRide.estimated_duration_sec = manualSec;
        this.state.currentRide.estimated_distance_m = providerDistM;
        this.state.currentRide.estimate_source = 'manual';
        this.notifyListeners(true);
      }
      return;
    }

    // 3. No manual minutes: provider estimate is required
    if (!originFix) {
      console.warn('[Rideoxy] [TrackingService] No qualifying GPS fix within 10s. Skipping ETA computation.');
      return;
    }

    const routeRes = await fetchRouteEta(originFix, destinationCoords, 'destination');
    if (routeRes.success) {
      const est = routeRes.estimate;
      // If low trust (snapped endpoint > 500m), skip estimate
      if (est.isLowTrust) {
        console.warn('[Rideoxy] [TrackingService] Route snapped endpoint > 500m from destination. Low-trust estimate skipped.');
        return;
      }

      await setRideEstimate(rideId, {
        estimated_duration_sec: est.durationSec,
        estimated_distance_m: est.distanceM,
        estimate_source: est.source,
      });

      if (this.state.currentRide && this.state.currentRide.id === rideId) {
        this.state.currentRide.estimated_duration_sec = est.durationSec;
        this.state.currentRide.estimated_distance_m = est.distanceM;
        this.state.currentRide.estimate_source = est.source;
        this.notifyListeners(true);
      }
    }
  }

  /**
   * Handle incoming raw GPS points from foreground or background tasks
   */
  private async handleIncomingGPSPoints(points: RawGPSPoint[]): Promise<void> {
    if (this.state.status !== 'running' || !this.state.currentRide) {
      return;
    }

    const rideId = this.state.currentRide.id;
    let newCoordsAdded = false;

    for (const point of points) {
      const now = Date.now();

      // If GPS is resuming after a stale period (>= 2s without fixes),
      // re-anchor baseline with the fresh point without adding stale distance/time
      if (this.isGpsStale) {
        this.isGpsStale = false;
        this.lastRecordedPoint = point;
        this.stationaryAnchor = point;
        this.lastPointReceivedTime = now;
        this.state.gpsSignalState = 'good';
        this.state.currentLocation = {
          latitude: point.latitude,
          longitude: point.longitude,
          heading: point.heading,
          accuracy: point.accuracy,
          altitude: point.altitude,
        };
        this.state.currentSpeedKmh = 0;
        this.state.lastUpdated = now;

        console.log('[GPS RE-ANCHOR]', {
          timestamp: point.timestamp,
          latitude: point.latitude,
          longitude: point.longitude,
          message: 'GPS resumed from stale period. Re-anchored baseline with zero distance/time delta.',
        });
        continue;
      }

      const validation = validateGPSPoint(point, this.lastRecordedPoint, this.stationaryAnchor, {
        isCurrentlyStill: this.isStill,
        consecutiveMovingFixes: this.consecutiveMovingFixes,
      });

      if (!validation.isValid) {
        recordGpsDiagnostic({
          timestamp: point.timestamp,
          latitude: point.latitude,
          longitude: point.longitude,
          accuracy: point.accuracy,
          reportedSpeed: point.speed !== null && point.speed !== undefined && point.speed >= 0 ? point.speed : null,
          derivedSpeed: validation.derivedSpeedMs ?? null,
          distanceFromLastAccepted: validation.distanceFromLastAccepted ?? 0,
          decision: 'rejected',
          reason: validation.reason,
          isStill: this.isStill,
          mocked: point.mocked,
        });

        console.log('[GPS REJECTED]', {
          reason: validation.reason,
          timestamp: point.timestamp,
          coordsSpeed: point.speed,
          calculatedSegmentDistance: validation.segmentDistanceMeters,
        });

        if (point.accuracy && point.accuracy > GPS_CONFIG.MAX_ACCEPTABLE_ACCURACY_METERS) {
          this.state.gpsSignalState = 'poor';
        }
        continue;
      }

      // Point is structurally valid
      this.lastPointReceivedTime = now;
      this.state.gpsSignalState = 'good';

      const segmentDistanceKm = (validation.segmentDistanceMeters ?? 0) / 1000;
      const segmentDurationSec = validation.segmentTimeSeconds ?? 0;
      const calculatedSpeedKmh = validation.segmentSpeedKmh ?? 0;
      const reportedSpeedKmh = point.speed !== null && point.speed !== undefined && point.speed >= 0
        ? Math.round(point.speed * 3.6 * 100) / 100
        : 0;

      if (validation.isStationaryJitter) {
        this.isStill = true;
        this.consecutiveMovingFixes = validation.consecutiveMovingFixes ?? 0;
        this.speedSmoothingQueue = [];

        // Vehicle is stationary: anchor position to prevent wandering baseline
        if (!this.stationaryAnchor && this.lastRecordedPoint) {
          this.stationaryAnchor = this.lastRecordedPoint;
        }

        // Speed is strictly 0 km/h
        this.state.currentSpeedKmh = 0;
        this.state.lastUpdated = now;

        recordGpsDiagnostic({
          timestamp: point.timestamp,
          latitude: point.latitude,
          longitude: point.longitude,
          accuracy: point.accuracy,
          reportedSpeed: point.speed !== null && point.speed !== undefined && point.speed >= 0 ? point.speed : null,
          derivedSpeed: validation.derivedSpeedMs ?? null,
          distanceFromLastAccepted: validation.distanceFromLastAccepted ?? 0,
          decision: 'still',
          reason: 'Stationary (< 8m/accuracy radius or speed < 1m/s)',
          isStill: true,
          mocked: point.mocked,
        });

        // CRITICAL INVARIANT:
        // Do NOT update this.state.currentLocation (prevents map camera easing/swimming)
        // Do NOT update this.lastRecordedPoint (prevents drifting reference)
        // Do NOT accumulate distance or moving time
        // Do NOT push to routeCoordinates
        // Do NOT insert into SQLite trackpoints

        console.log('[GPS SEGMENT - STATIONARY JITTER]', {
          distance: `${segmentDistanceKm.toFixed(4)} km`,
          duration: `${segmentDurationSec.toFixed(2)} sec`,
          calculatedSpeed: `${calculatedSpeedKmh.toFixed(2)} km/h`,
          reportedSpeed: `${reportedSpeedKmh.toFixed(2)} km/h`,
          movementAccepted: false,
          totalDistance: `${this.state.currentDistanceKm.toFixed(4)} km`,
          movingTime: `${this.state.currentMovingTimeSeconds.toFixed(2)} sec`,
          averageSpeed: `${this.state.currentAvgSpeedKmh.toFixed(2)} km/h`,
          maxSpeed: `${this.state.currentMaxSpeedKmh.toFixed(2)} km/h`,
        });

        continue;
      }

      // Valid genuine movement segment: release stationary anchor
      this.isStill = false;
      this.consecutiveMovingFixes = validation.consecutiveMovingFixes ?? 0;
      this.stationaryAnchor = null;

      // Single authoritative speed, distance, and duration source
      // Smooth displayed speed with 3-fix moving average
      this.speedSmoothingQueue.push(calculatedSpeedKmh);
      if (this.speedSmoothingQueue.length > GPS_FILTER_CONFIG.SPEED_SMOOTHING_SAMPLES) {
        this.speedSmoothingQueue.shift();
      }
      const smoothedSpeedKmh =
        this.speedSmoothingQueue.reduce((sum, s) => sum + s, 0) / this.speedSmoothingQueue.length;

      this.state.currentSpeedKmh = Math.round(smoothedSpeedKmh * 10) / 10;
      this.state.lastUpdated = now;

      // Authoritative location ONLY updates on accepted movement
      this.state.currentLocation = {
        latitude: point.latitude,
        longitude: point.longitude,
        heading: point.heading,
        accuracy: point.accuracy,
        altitude: point.altitude,
      };

      // Update max speed only from accepted, non-spike, moving fixes
      if (calculatedSpeedKmh > this.state.currentMaxSpeedKmh && calculatedSpeedKmh <= GPS_CONFIG.MAX_PLAUSIBLE_SPEED_KMH) {
        this.state.currentMaxSpeedKmh = Math.round(calculatedSpeedKmh * 10) / 10;
      }

      // Accumulate precise distance and moving time together
      this.state.currentDistanceKm += segmentDistanceKm;
      this.state.currentMovingTimeSeconds += segmentDurationSec;

      // Calculate average speed: totalMovingDistance / totalMovingTime
      if (this.state.currentMovingTimeSeconds > 0 && this.state.currentDistanceKm > 0) {
        const movingHours = this.state.currentMovingTimeSeconds / 3600;
        const calculatedAvg = Math.round((this.state.currentDistanceKm / movingHours) * 10) / 10;
        // Invariant: Average speed can never exceed max speed
        this.state.currentAvgSpeedKmh = Math.min(calculatedAvg, this.state.currentMaxSpeedKmh);
      }

      recordGpsDiagnostic({
        timestamp: point.timestamp,
        latitude: point.latitude,
        longitude: point.longitude,
        accuracy: point.accuracy,
        reportedSpeed: point.speed !== null && point.speed !== undefined && point.speed >= 0 ? point.speed : null,
        derivedSpeed: validation.derivedSpeedMs ?? null,
        distanceFromLastAccepted: validation.distanceFromLastAccepted ?? 0,
        decision: 'accepted',
        isStill: false,
        mocked: point.mocked,
      });

      console.log('[GPS SEGMENT - MOVEMENT ACCEPTED]', {
        distance: `${segmentDistanceKm.toFixed(4)} km`,
        duration: `${segmentDurationSec.toFixed(2)} sec`,
        calculatedSpeed: `${calculatedSpeedKmh.toFixed(2)} km/h`,
        reportedSpeed: `${reportedSpeedKmh.toFixed(2)} km/h`,
        movementAccepted: true,
        totalDistance: `${this.state.currentDistanceKm.toFixed(4)} km`,
        movingTime: `${this.state.currentMovingTimeSeconds.toFixed(2)} sec`,
        averageSpeed: `${this.state.currentAvgSpeedKmh.toFixed(2)} km/h`,
        maxSpeed: `${this.state.currentMaxSpeedKmh.toFixed(2)} km/h`,
      });

      // Append coordinate to route for map display
      this.state.routeCoordinates.push([point.longitude, point.latitude]);
      this.state.recentPointsCount++;
      newCoordsAdded = true;

      // Save point to SQLite
      const trackPoint: TrackPoint = {
        ride_id: rideId,
        latitude: point.latitude,
        longitude: point.longitude,
        altitude: point.altitude,
        speed: point.speed,
        accuracy: point.accuracy,
        heading: point.heading,
        timestamp: point.timestamp,
      };

      try {
        await insertTrackPoint(trackPoint);
      } catch (err) {
        console.error('[Rideoxy] Failed to insert trackpoint:', err);
      }

      this.lastRecordedPoint = point;
    }

    // Periodic SQLite ride table sync (every 10 seconds)
    const now = Date.now();
    if (now - this.lastDbSyncTime > 10000 && this.state.currentRide) {
      this.lastDbSyncTime = now;
      await updateRide(rideId, {
        duration: this.state.currentDurationSeconds,
        moving_time: Math.round(this.state.currentMovingTimeSeconds),
        distance: Math.round(this.state.currentDistanceKm * 100) / 100,
        average_speed: this.state.currentAvgSpeedKmh,
        max_speed: this.state.currentMaxSpeedKmh,
      });
    }

    // Notify UI immediately on incoming GPS fix so speed/location updates with zero delay
    this.notifyListeners(true);
  }

  /**
   * Watchdog timer running every 500ms:
   * 1. Increments duration (every full second).
   * 2. Checks GPS freshness: if no valid GPS fix is received within GPS_STALE_TIMEOUT_MS (2s),
   *    currentSpeedKmh transitions immediately to 0 km/h and marks isGpsStale = true.
   * 3. Guarantees that average speed is 0 if distance or moving time is 0.
   */
  private startDurationTimer(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.tickCounter = 0;

    this.timerInterval = setInterval(() => {
      if (this.state.status === 'running') {
        this.tickCounter++;
        const isOneSecondTick = this.tickCounter % 2 === 0;
        const now = Date.now();

        // 1. Check GPS Staleness: if updates stopped for >= 2.0s, transition current speed to 0 and flag stale
        if (
          this.lastPointReceivedTime > 0 &&
          now - this.lastPointReceivedTime >= GPS_CONFIG.GPS_STALE_TIMEOUT_MS
        ) {
          if (!this.isGpsStale) {
            this.isGpsStale = true;
          }

          if (this.state.currentSpeedKmh !== 0) {
            this.state.currentSpeedKmh = 0;
            this.state.lastUpdated = now;
            this.notifyListeners(true);
          }

          // If GPS updates stop for longer than signal timeout, mark searching
          if (now - this.lastPointReceivedTime >= GPS_CONFIG.GPS_SIGNAL_TIMEOUT_MS) {
            if (this.state.gpsSignalState !== 'searching') {
              this.state.gpsSignalState = 'searching';
              this.notifyListeners(true);
            }
          }
        }

        // 2. Second-based duration calculation
        if (isOneSecondTick) {
          this.state.currentDurationSeconds++;

          // Invariant safety: if distance is 0 or moving time is 0, average speed must be 0
          if (this.state.currentDistanceKm === 0 || this.state.currentMovingTimeSeconds === 0) {
            this.state.currentAvgSpeedKmh = 0;
          }

          this.notifyListeners(false);
        }
      }
    }, 500);
  }

  private stopDurationTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
}

export const trackingService = new TrackingService();
