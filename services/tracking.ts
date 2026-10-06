import { Ride, TrackPoint, RawGPSPoint } from '../types/ride';
import { LiveTrackingState } from '../types/tracking';
import { GPS_CONFIG } from '../constants/gps';
import { validateGPSPoint } from './gpsFilter';
import {
  createRide,
  updateRide,
  getActiveRide,
  deleteRide,
} from '../database/rideRepository';
import {
  insertTrackPoint,
  getTrackPointsByRideId,
} from '../database/trackPointRepository';
import {
  startForegroundLocationWatching,
  stopForegroundLocationWatching,
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
  getCurrentGPSFix,
  requestLocationPermissions,
} from './location';
import { registerLocationUpdateCallback } from '../tasks/locationTask';

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
  private lastPointReceivedTime: number = 0;
  private isGpsStale: boolean = false;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private tickCounter: number = 0;
  private lastDbSyncTime: number = 0;
  private lastUiNotifyTime: number = 0;

  constructor() {
    // Register global callback for Expo TaskManager background updates
    registerLocationUpdateCallback((points) => {
      this.handleIncomingGPSPoints(points);
    });
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
        console.error('[rideoxy] Error in tracking listener:', err);
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
      console.warn('[rideoxy] Error checking for active ride:', err);
      return null;
    }
  }

  /**
   * Start a brand new ride
   */
  public async startRide(): Promise<{
    success: boolean;
    error?: string;
    errorType?: 'permission' | 'location' | 'database' | 'system';
  }> {
    try {
      const perms = await requestLocationPermissions();
      if (!perms.canTrack) {
        return {
          success: false,
          error: 'Location permission is required to record a ride.',
          errorType: 'permission',
        };
      }

      this.state.status = 'starting';
      this.notifyListeners(true);

      const initialFix = await getCurrentGPSFix();
      const startTime = Date.now();
      const rideId = `ride_${startTime}_${Math.random().toString(36).substring(2, 7)}`;

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
        console.error('[rideoxy] [TrackingService] Database failure while creating ride record:', dbErr);
        this.state.status = 'idle';
        this.notifyListeners(true);
        return {
          success: false,
          error: dbErr instanceof Error ? dbErr.message : 'Database error while initializing ride.',
          errorType: 'database',
        };
      }

      this.lastRecordedPoint = initialFix;
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

      // Start background & foreground GPS services
      try {
        await startBackgroundLocationTracking();
        await startForegroundLocationWatching((point) => {
          this.handleIncomingGPSPoints([point]);
        });
      } catch (locErr) {
        console.error('[rideoxy] [TrackingService] Location tracking service error:', locErr);
        this.stopDurationTimer();
        this.state.status = 'idle';
        this.notifyListeners(true);
        return {
          success: false,
          error: locErr instanceof Error ? locErr.message : 'Failed to start GPS tracking service.',
          errorType: 'location',
        };
      }

      this.notifyListeners(true);
      return { success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[rideoxy] [TrackingService] Unexpected error in startRide:', err);
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

    await updateRide(this.state.currentRide.id, {
      status: 'running',
    });

    if (!this.timerInterval) {
      this.startDurationTimer();
    }

    await startBackgroundLocationTracking();
    await startForegroundLocationWatching((point) => {
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
    stopForegroundLocationWatching();
    await stopBackgroundLocationTracking();

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
    stopForegroundLocationWatching();
    await stopBackgroundLocationTracking();

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
    stopForegroundLocationWatching();
    stopBackgroundLocationTracking();

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
    this.lastPointReceivedTime = 0;
    this.isGpsStale = false;
    this.notifyListeners(true);
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


        // Add re-anchor coordinate for map display
        this.state.routeCoordinates.push([point.longitude, point.latitude]);
        this.state.recentPointsCount++;
        newCoordsAdded = true;

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
          console.error('[rideoxy] Failed to insert re-anchor trackpoint:', err);
        }

        continue;
      }

      const validation = validateGPSPoint(point, this.lastRecordedPoint);

      if (!validation.isValid) {

        if (point.accuracy && point.accuracy > GPS_CONFIG.MAX_ACCEPTABLE_ACCURACY_METERS) {
          this.state.gpsSignalState = 'poor';
        }
        continue;
      }

      // Point is structurally valid
      this.lastPointReceivedTime = now;
      this.state.gpsSignalState = 'good';

      // Update current live location
      this.state.currentLocation = {
        latitude: point.latitude,
        longitude: point.longitude,
        heading: point.heading,
        accuracy: point.accuracy,
        altitude: point.altitude,
      };

      const segmentDistanceKm = (validation.segmentDistanceMeters ?? 0) / 1000;
      const segmentDurationSec = validation.segmentTimeSeconds ?? 0;
      const calculatedSpeedKmh = validation.segmentSpeedKmh ?? 0;
      const reportedSpeedKmh = point.speed !== null && point.speed !== undefined && point.speed >= 0
        ? Math.round(point.speed * 3.6 * 100) / 100
        : 0;

      if (validation.isStationaryJitter) {
        // Vehicle is stationary: speed is 0, do not accumulate distance or moving time
        this.state.currentSpeedKmh = 0;
        this.state.lastUpdated = now;
        this.lastRecordedPoint = point;


        continue;
      }

      // Valid movement segment:
      // Single authoritative speed, distance, and duration source
      this.state.currentSpeedKmh = calculatedSpeedKmh;
      this.state.lastUpdated = now;

      // Update max speed from the SAME calculated segment speed
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
        this.state.currentAvgSpeedKmh = calculatedAvg;
      }


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
        console.error('[rideoxy] Failed to insert trackpoint:', err);
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
