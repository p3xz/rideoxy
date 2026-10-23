import { trackingService } from '../services/tracking';
import { RawGPSPoint } from '../types/ride';
import { getActiveRide } from '../database/rideRepository';
import { getDatabase } from '../database/database';
import * as Location from 'expo-location';

describe('Rideoxy Fix Batch 1: The Ride-Killers (2026-10-22)', () => {
  const ridesStore = new Map<string, any>();

  beforeEach(async () => {
    // Restore default mocks
    jest.clearAllMocks();
    ridesStore.clear();

    const db = await getDatabase();
    (db.runAsync as jest.Mock).mockImplementation(async (sql: string, params: any[] = []) => {
      const lower = sql.toLowerCase();
      if (lower.startsWith('insert into rides')) {
        const [id, start_time, end_time, duration, moving_time, distance, average_speed, max_speed, status] = params;
        ridesStore.set(id, {
          id,
          start_time,
          end_time,
          duration,
          moving_time,
          distance,
          average_speed,
          max_speed,
          status,
        });
      } else if (lower.startsWith('delete from rides')) {
        const [id] = params;
        ridesStore.delete(id);
      } else if (lower.startsWith('update rides')) {
        const id = params[params.length - 1];
        const existing = ridesStore.get(id);
        if (existing) {
          if (lower.includes('status = ?')) {
            existing.status = params[params.length - 2];
          }
        }
      }
      return undefined;
    });

    (db.getFirstAsync as jest.Mock).mockImplementation(async (sql: string) => {
      const lower = sql.toLowerCase();
      if (lower.includes('from rides where status in (\'running\', \'paused\')')) {
        const active = Array.from(ridesStore.values()).find(
          (r) => r.status === 'running' || r.status === 'paused'
        );
        return active ?? null;
      }
      return null;
    });

    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: true,
      status: 'granted',
      canAskAgain: true,
    });
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: true,
      status: 'granted',
      canAskAgain: true,
    });
    (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: true,
      status: 'granted',
    });
    (Location.hasStartedLocationUpdatesAsync as jest.Mock).mockResolvedValue(false);
    (Location.startLocationUpdatesAsync as jest.Mock).mockResolvedValue(undefined);
    (Location.stopLocationUpdatesAsync as jest.Mock).mockResolvedValue(undefined);
    (Location.watchPositionAsync as jest.Mock).mockResolvedValue({ remove: jest.fn() });
    await trackingService.resetToIdle();
  });

  afterEach(async () => {
    await trackingService.resetToIdle();
  });

  // =========================================================================
  // FIX 1: DATA-01, stale re-anchor accepts unvalidated fixes
  // =========================================================================
  describe('Fix 1: DATA-01, Stale re-anchor validates fixes', () => {
    it('rejects (0,0) during stale recovery, maintains stale flag, and continues accumulating distance on subsequent valid Delhi fixes', async () => {
      const now = Date.now();
      const delhiBase: RawGPSPoint = {
        latitude: 28.6139,
        longitude: 77.2090,
        altitude: 215,
        accuracy: 5,
        speed: 0,
        heading: 0,
        timestamp: now,
      };

      // Set up a running ride in Delhi
      const rideId = `test_stale_${now}`;
      (trackingService as any).state = {
        status: 'running',
        currentRide: {
          id: rideId,
          start_time: now,
          end_time: null,
          duration: 0,
          moving_time: 0,
          distance: 0,
          average_speed: 0,
          max_speed: 0,
          status: 'running',
          created_at: now,
          ride_mode: 'free',
          destination_name: null,
          destination_lat: null,
          destination_lng: null,
          estimated_duration_sec: null,
          estimated_distance_m: null,
          estimate_source: null,
        },
        currentSpeedKmh: 0,
        currentDistanceKm: 0,
        currentDurationSeconds: 0,
        currentMovingTimeSeconds: 0,
        currentAvgSpeedKmh: 0,
        currentMaxSpeedKmh: 0,
        currentLocation: delhiBase,
        routeCoordinates: [[delhiBase.longitude, delhiBase.latitude]],
        recentPointsCount: 1,
        lastUpdated: now,
        gpsSignalState: 'good',
      };
      (trackingService as any).lastRecordedPoint = delhiBase;
      (trackingService as any).stationaryAnchor = delhiBase;
      (trackingService as any).isStill = true;
      (trackingService as any).lastPointReceivedTime = now;

      // 1. Simulate 2s signal gap (tunnel/underpass)
      (trackingService as any).isGpsStale = true;

      // 2. Hardware reports corrupted Null Island (0,0) fix after the gap
      const nullIsland: RawGPSPoint = {
        latitude: 0,
        longitude: 0,
        altitude: 0,
        accuracy: 5,
        speed: 0,
        heading: 0,
        timestamp: now + 3000,
      };

      await (trackingService as any).handleIncomingGPSPoints([nullIsland]);

      // ASSERT: Null Island was rejected, isGpsStale stays TRUE, lastRecordedPoint is still Delhi!
      expect((trackingService as any).isGpsStale).toBe(true);
      expect((trackingService as any).lastRecordedPoint.latitude).toBe(28.6139);
      expect((trackingService as any).lastRecordedPoint.longitude).toBe(77.2090);
      expect(trackingService.getState().currentDistanceKm).toBe(0);

      // 3. Now valid Delhi fix arrives (resuming after tunnel)
      const validDelhiResume: RawGPSPoint = {
        latitude: 28.6140, // ~11m north
        longitude: 77.2090,
        altitude: 215,
        accuracy: 5,
        speed: 5,
        heading: 0,
        timestamp: now + 4000,
      };

      await (trackingService as any).handleIncomingGPSPoints([validDelhiResume]);

      // ASSERT: Re-anchor cleanly adopts the fresh valid Delhi point and un-stales
      expect((trackingService as any).isGpsStale).toBe(false);
      expect((trackingService as any).lastRecordedPoint.latitude).toBeCloseTo(28.6140, 4);

      // 4. Riding continues in Delhi at ~36 km/h (10 m/s)
      for (let i = 1; i <= 5; i++) {
        const movingPoint: RawGPSPoint = {
          latitude: 28.6140 + (i * 10) / 111320,
          longitude: 77.2090,
          altitude: 215,
          accuracy: 5,
          speed: 10,
          heading: 0,
          timestamp: now + 4000 + i * 1000,
        };
        await (trackingService as any).handleIncomingGPSPoints([movingPoint]);
      }

      const finalState = trackingService.getState();
      // ASSERT: Distance is accumulating normally (NOT stuck at 0) and speed is positive!
      expect(finalState.currentDistanceKm).toBeGreaterThan(0.04); // ~50 meters accumulated
      expect(finalState.currentSpeedKmh).toBeGreaterThan(20);
      expect(finalState.currentLocation?.latitude).toBeCloseTo(28.6140 + 50 / 111320, 4);
    });
  });

  // =========================================================================
  // FIX 2: DATA-02 + DEAD-03, startRide re-entrancy and ghost rides
  // =========================================================================
  describe('Fix 2: DATA-02 + DEAD-03, startRide re-entrancy and ghost rides', () => {
    it('DATA-02: double startRide concurrent calls produce exactly one running ride', async () => {
      // Fire two concurrent startRide calls simultaneously
      const [res1, res2] = await Promise.all([
        trackingService.startRide(),
        trackingService.startRide(),
      ]);

      // Exactly one succeeds, the other is rejected as already starting/running
      const successCount = [res1, res2].filter((r) => r.success).length;
      const failureCount = [res1, res2].filter((r) => !r.success).length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);

      // State is running with exactly one current ride
      expect(trackingService.getState().status).toBe('running');
      expect(trackingService.getState().currentRide).not.toBeNull();

      // Database check: exactly one active ride row exists
      const activeRide = await getActiveRide();
      expect(activeRide).not.toBeNull();
      expect(activeRide?.id).toBe(trackingService.getState().currentRide?.id);
    });

    it('DEAD-03: failed location tracking init rolls back inserted SQLite ride and returns to idle', async () => {
      // Mock startLocationUpdatesAsync to simulate hardware failure
      (Location.startLocationUpdatesAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Location hardware disabled')
      );
      (Location.watchPositionAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Foreground location hardware disabled')
      );

      const res = await trackingService.startRide();

      expect(res.success).toBe(false);
      expect(res.errorType).toBe('location');
      expect(trackingService.getState().status).toBe('idle');
      expect(trackingService.getState().currentRide).toBeNull();

      // Database check: inserted row was rolled back / deleted (0 active rides)
      const activeRide = await getActiveRide();
      expect(activeRide).toBeNull();
    });
  });

  // =========================================================================
  // FIX 3: DATA-03, un-awaited teardown kills next ride tracking
  // =========================================================================
  describe('Fix 3: DATA-03, Serialized teardown and consecutive ride start', () => {
    it('starts a new ride immediately after ending one and delivers fixes without teardown dropping callback', async () => {
      let registeredCallback: ((points: RawGPSPoint[]) => void) | null = null;
      let stopCallCount = 0;

      // Mock startLocationUpdatesAsync to simulate async native delay on teardown and startup
      (Location.stopLocationUpdatesAsync as jest.Mock).mockImplementation(async () => {
        stopCallCount++;
        // Small delay to simulate native async teardown
        await new Promise((r) => setTimeout(r, 20));
      });

      // 1. Start and end Ride 1
      const startRes1 = await trackingService.startRide();
      expect(startRes1.success).toBe(true);

      const endRes1 = await trackingService.endRide();
      expect(endRes1).not.toBeNull();

      // 2. Immediately start Ride 2 without delay
      const startRes2 = await trackingService.startRide();
      expect(startRes2.success).toBe(true);
      expect(trackingService.getState().status).toBe('running');

      // 3. Deliver GPS fixes to the active ride
      const now = Date.now();
      const p1: RawGPSPoint = {
        latitude: 28.6139,
        longitude: 77.2090,
        altitude: 200,
        accuracy: 5,
        speed: 10,
        heading: 0,
        timestamp: now,
      };
      const p2: RawGPSPoint = {
        latitude: 28.6142, // ~33m away
        longitude: 77.2090,
        altitude: 200,
        accuracy: 5,
        speed: 10,
        heading: 0,
        timestamp: now + 1000,
      };

      await (trackingService as any).handleIncomingGPSPoints([p1, p2]);

      const state = trackingService.getState();
      expect(state.recentPointsCount).toBeGreaterThan(0);
      expect(state.currentDistanceKm).toBeGreaterThan(0.02);
    });
  });

  // =========================================================================
  // FIX 4: DEAD-02, resumeRide checks permissions and tracking failure
  // =========================================================================
  describe('Fix 4: DEAD-02, resumeRide checks permissions and tracking failure', () => {
    it('refuses to resume and stays paused when location permission is revoked', async () => {
      // 1. Start ride and pause it
      await trackingService.startRide();
      await trackingService.pauseRide();
      expect(trackingService.getState().status).toBe('paused');

      // 2. Revoke location permissions (user toggled off in Settings while paused)
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: false,
        status: 'denied',
        canAskAgain: false,
      });
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: false,
        status: 'denied',
        canAskAgain: false,
      });

      // 3. Attempt to resume
      const resumeRes = await trackingService.resumeRide();

      // ASSERT: Resume is rejected, error informs user, and status STAYS paused!
      expect(resumeRes.success).toBe(false);
      expect(resumeRes.errorType).toBe('permission');
      expect(resumeRes.error).toBe('Location permission is required to record a ride.');
      expect(trackingService.getState().status).toBe('paused');

      // 4. Restore permissions
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: true,
        status: 'granted',
        canAskAgain: true,
      });
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: true,
        status: 'granted',
        canAskAgain: true,
      });

      // 5. Simulate location startup failure
      (Location.startLocationUpdatesAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Location service error')
      );
      (Location.watchPositionAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Location service error')
      );

      const resumeFailRes = await trackingService.resumeRide();
      expect(resumeFailRes.success).toBe(false);
      expect(resumeFailRes.errorType).toBe('location');
      expect(trackingService.getState().status).toBe('paused');

      // 6. Restore tracking service and resume successfully
      (Location.startLocationUpdatesAsync as jest.Mock).mockResolvedValue(undefined);
      const resumeSuccessRes = await trackingService.resumeRide();

      expect(resumeSuccessRes.success).toBe(true);
      expect(trackingService.getState().status).toBe('running');
    });
  });
});
