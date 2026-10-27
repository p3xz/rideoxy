/**
 * GPS Filter Unit Tests — Rideoxy Telemetry
 *
 * Deterministic test cases covering the full validateGPSPoint() pipeline.
 * No real GPS hardware required — all inputs are synthetic RawGPSPoint objects.
 */

import {
  validateGPSPoint,
  GPSValidationResult,
  GpsKalmanFilter,
  ImuMotionDetector,
  smoothGPSTrace,
} from '../services/gpsFilter';
import { trackingService } from '../services/tracking';
import * as locationService from '../services/location';
import { calculateDistanceMeters } from '../services/distance';
import { RawGPSPoint } from '../types/ride';
import { GPS_CONFIG, GPS_FILTER_CONFIG } from '../constants/gps';

function recentTimestamp(offsetMs = 0): number {
  return Date.now() - offsetMs;
}

function makePoint(overrides: Partial<RawGPSPoint> & { latitude: number; longitude: number }): RawGPSPoint {
  return {
    altitude: 300,
    speed: null,
    accuracy: 10,
    heading: 90,
    timestamp: recentTimestamp(),
    ...overrides,
  };
}

function moveNorthMeters(base: RawGPSPoint, distanceM: number): RawGPSPoint {
  const deltaLat = distanceM / 111_320;
  return { ...base, latitude: base.latitude + deltaLat };
}

describe('gpsFilter Core Tests', () => {
  // ---------------------------------------------------------------------------
  // Test 1 — Stationary jitter: very small displacement, no Doppler
  // ---------------------------------------------------------------------------
  describe('Test 1 — Stationary jitter (no Doppler)', () => {
    it('should mark as stationaryJitter when displacement < STATIONARY_RADIUS_METERS', () => {
      const now = recentTimestamp();
      const anchor = makePoint({ latitude: 28.6448, longitude: 77.2167, timestamp: now - 2000 });
      const prev   = makePoint({ latitude: 28.6448, longitude: 77.2167, timestamp: now - 1000 });

      const current = moveNorthMeters(anchor, 1.2);
      current.timestamp = now;

      const result = validateGPSPoint(current, prev, anchor);

      expect(result.isValid).toBe(true);
      expect(result.isStationaryJitter).toBe(true);
      expect(result.segmentSpeedKmh).toBe(0);
      expect(result.segmentDistanceMeters).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 2 — Stationary with Doppler confirmation
  // ---------------------------------------------------------------------------
  describe('Test 2 — Stationary with Doppler confirmation (speed < 1.0 m/s)', () => {
    it('should mark as stationaryJitter when OS Doppler speed < 1.0 m/s and point is near anchor', () => {
      const now = recentTimestamp();
      const anchor  = makePoint({ latitude: 28.6448, longitude: 77.2167, timestamp: now - 2000 });
      const prev    = makePoint({ latitude: 28.6448, longitude: 77.2167, timestamp: now - 1000 });

      const current = {
        ...moveNorthMeters(anchor, 4),
        speed: 0.3, // 0.3 m/s < 1.0 m/s
        accuracy: 8,
        timestamp: now,
      };

      const result = validateGPSPoint(current, prev, anchor);

      expect(result.isValid).toBe(true);
      expect(result.isStationaryJitter).toBe(true);
      expect(result.segmentSpeedKmh).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 3 — Constant movement at 36 km/h
  // ---------------------------------------------------------------------------
  describe('Test 3 — Valid movement at 36 km/h', () => {
    it('should accept segment and return ~36 km/h segmentSpeedKmh', () => {
      const now = recentTimestamp();
      const prev = makePoint({ latitude: 28.6448, longitude: 77.2167, timestamp: now - 1000 });
      const current = {
        ...moveNorthMeters(prev, 10), // 10 m in 1 s = 10 m/s = 36 km/h
        speed: 10,
        accuracy: 8,
        timestamp: now,
      };

      const result = validateGPSPoint(current, prev, null);

      expect(result.isValid).toBe(true);
      expect(result.isStationaryJitter).toBe(false);
      expect(result.segmentSpeedKmh).toBeGreaterThanOrEqual(34);
      expect(result.segmentSpeedKmh).toBeLessThanOrEqual(38);
      expect(result.segmentDistanceMeters).toBeGreaterThan(9);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 4 — Tiny dt spike (< MIN_SAMPLE_INTERVAL_MS)
  // ---------------------------------------------------------------------------
  describe('Test 4 — Rapid burst / tiny dt spike rejection', () => {
    it('should reject a point that arrives < MIN_SAMPLE_INTERVAL_MS after previous', () => {
      const now = recentTimestamp();
      const prev = makePoint({ latitude: 28.6448, longitude: 77.2167, timestamp: now - 50 });
      const current = makePoint({ latitude: 28.6449, longitude: 77.2167, timestamp: now });

      const result = validateGPSPoint(current, prev, null);

      expect(result.isValid).toBe(false);
      expect(result.reason).toMatch(/rapid/i);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 5 — Duplicate timestamp (dt = 0)
  // ---------------------------------------------------------------------------
  describe('Test 5 — Duplicate timestamp rejection', () => {
    it('should reject when current and previous timestamps are identical', () => {
      const ts = recentTimestamp();
      const prev = makePoint({ latitude: 28.6448, longitude: 77.2167, timestamp: ts });
      const current = makePoint({ latitude: 28.6449, longitude: 77.2167, timestamp: ts });

      const result = validateGPSPoint(current, prev, null);

      expect(result.isValid).toBe(false);
      expect(result.reason).toMatch(/duplicate|backward/i);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 6 — Out-of-order timestamp (dt < 0)
  // ---------------------------------------------------------------------------
  describe('Test 6 — Out-of-order timestamp rejection', () => {
    it('should reject when current timestamp is before previous timestamp', () => {
      const now = recentTimestamp();
      const prev = makePoint({ latitude: 28.6448, longitude: 77.2167, timestamp: now });
      const current = makePoint({ latitude: 28.6449, longitude: 77.2167, timestamp: now - 500 });

      const result = validateGPSPoint(current, prev, null);

      expect(result.isValid).toBe(false);
      expect(result.reason).toMatch(/duplicate|backward/i);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 7 — Accuracy handling: reject null/<=0, demote > platform limit
  // ---------------------------------------------------------------------------
  describe('Test 7 — Accuracy handling: hard reject <= 0, demote poor accuracy', () => {
    it('should hard reject when accuracy is 0 or negative', () => {
      const now = recentTimestamp();
      const prev = makePoint({ latitude: 28.6448, longitude: 77.2167, timestamp: now - 1000 });
      const zeroAcc = makePoint({
        latitude: 28.6449,
        longitude: 77.2167,
        accuracy: 0,
        timestamp: now,
      });

      const result = validateGPSPoint(zeroAcc, prev, null);
      expect(result.isValid).toBe(false);
      expect(result.reason).toMatch(/accuracy invalid/i);
    });

    it('should DEMOTE (not reject) fix when accuracy is worse than threshold', () => {
      const now = recentTimestamp();
      const prev = makePoint({ latitude: 28.6448, longitude: 77.2167, timestamp: now - 1000 });
      const poorAccPoint = makePoint({
        latitude: 28.6449,
        longitude: 77.2167,
        accuracy: 45, // 45m > 25m
        timestamp: now,
      });

      const result = validateGPSPoint(poorAccPoint, prev, null, { platform: 'android' });

      // Demoted fixes are valid in stream, but contribute NO distance, NO speed
      expect(result.isValid).toBe(true);
      expect(result.isDemoted).toBe(true);
      expect(result.segmentDistanceMeters).toBe(0);
      expect(result.segmentSpeedKmh).toBe(0);
      expect(result.reason).toMatch(/demoted/i);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 8 — Stale first fix rejection vs deferred batch acceptance
  // ---------------------------------------------------------------------------
  describe('Test 8 — Stale first fix rule and deferred batch monotonicity', () => {
    it('should drop a cached first fix older than 10 seconds at ride start', () => {
      const oldCachedTs = Date.now() - 15000; // 15 seconds old
      const firstFix = makePoint({
        latitude: 28.6448,
        longitude: 77.2167,
        timestamp: oldCachedTs,
      });

      const result = validateGPSPoint(firstFix, null, null);
      expect(result.isValid).toBe(false);
      expect(result.reason).toMatch(/cached first fix older than 10s/i);
    });

    it('should accept deferred batch of fixes with old-but-increasing timestamps in order', () => {
      const baseTs = Date.now() - 60000; // 1 minute ago
      const initialAccepted = makePoint({
        latitude: 28.6448,
        longitude: 77.2167,
        timestamp: baseTs,
      });

      // 3 deferred fixes from background queue, all > 10s old relative to wall-clock,
      // but monotonically increasing relative to each other:
      const p1 = makePoint({ latitude: 28.6449, longitude: 77.2167, timestamp: baseTs + 1000 });
      const p2 = makePoint({ latitude: 28.6450, longitude: 77.2167, timestamp: baseTs + 2000 });
      const p3 = makePoint({ latitude: 28.6451, longitude: 77.2167, timestamp: baseTs + 3000 });

      const r1 = validateGPSPoint(p1, initialAccepted, null);
      expect(r1.isValid).toBe(true);

      const r2 = validateGPSPoint(p2, p1, null);
      expect(r2.isValid).toBe(true);

      const r3 = validateGPSPoint(p3, p2, null);
      expect(r3.isValid).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 9 — Valid slow movement
  // ---------------------------------------------------------------------------
  describe('Test 9 — Valid slow movement (crawl ~3 km/h)', () => {
    it('should accept ~3 km/h movement with displacement > anchor radius', () => {
      const now = recentTimestamp();
      const prev = makePoint({ latitude: 28.6448, longitude: 77.2167, accuracy: 3, timestamp: now - 10000 });
      const current = {
        ...moveNorthMeters(prev, 8.33),
        speed: 0.833,
        accuracy: 3,
        timestamp: now,
      };

      const result = validateGPSPoint(current, prev, null);

      expect(result.isValid).toBe(true);
      expect(result.isStationaryJitter).toBe(false);
      expect(result.segmentSpeedKmh).toBeGreaterThan(2);
      expect(result.segmentSpeedKmh).toBeLessThan(4);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 10 — Valid acceleration (0 → 60 km/h)
  // ---------------------------------------------------------------------------
  describe('Test 10 — Valid acceleration (0 → 60 km/h)', () => {
    it('should accept a segment representing 60 km/h average over 5 seconds', () => {
      const now = recentTimestamp();
      const prev = makePoint({ latitude: 28.6448, longitude: 77.2167, timestamp: now - 5000 });
      const current = {
        ...moveNorthMeters(prev, 83.3),
        speed: 16.67,
        accuracy: 7,
        timestamp: now,
      };

      const result = validateGPSPoint(current, prev, null);

      expect(result.isValid).toBe(true);
      expect(result.isStationaryJitter).toBe(false);
      expect(result.segmentSpeedKmh).toBeGreaterThan(55);
      expect(result.segmentSpeedKmh).toBeLessThan(65);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 11 — Impossible teleportation
  // ---------------------------------------------------------------------------
  describe('Test 11 — Impossible teleportation rejection', () => {
    it('should reject a point 5 km away in 1 second', () => {
      const now = recentTimestamp();
      const prev = makePoint({ latitude: 28.6448, longitude: 77.2167, timestamp: now - 1000 });
      const current = {
        ...moveNorthMeters(prev, 5000),
        speed: 5000,
        accuracy: 10,
        timestamp: now,
      };

      const result = validateGPSPoint(current, prev, null);

      expect(result.isValid).toBe(false);
      expect(result.reason).toMatch(/impossible speed/i);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 12 — Background batch: burst deduplication
  // ---------------------------------------------------------------------------
  describe('Test 12 — Background batch burst deduplication', () => {
    it('should reject points with dt < MIN_SAMPLE_INTERVAL_MS in burst callbacks', () => {
      const batchTs = recentTimestamp();
      const base = makePoint({ latitude: 28.6448, longitude: 77.2167, timestamp: batchTs - 1000 });
      const batchPoints = [
        makePoint({ latitude: 28.6449, longitude: 77.2167, timestamp: batchTs }),
        makePoint({ latitude: 28.6450, longitude: 77.2167, timestamp: batchTs }),
      ];

      const r0 = validateGPSPoint(batchPoints[0], base, null);
      expect(r0.isValid).toBe(true);

      const r1 = validateGPSPoint(batchPoints[1], batchPoints[0], null);
      expect(r1.isValid).toBe(false);
      expect(r1.reason).toMatch(/duplicate|backward/i);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 13 — Null Island (0, 0)
  // ---------------------------------------------------------------------------
  describe('Test 13 — Null Island coordinate rejection', () => {
    it('should reject a GPS fix at (0, 0)', () => {
      const now = recentTimestamp();
      const current: RawGPSPoint = {
        latitude: 0,
        longitude: 0,
        altitude: 0,
        speed: null,
        accuracy: 5,
        heading: null,
        timestamp: now,
      };

      const result = validateGPSPoint(current, null, null);

      expect(result.isValid).toBe(false);
      expect(result.reason).toMatch(/null island/i);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 14 — Anchor validation on the initial fix
  // ---------------------------------------------------------------------------
  describe('Test 14 — Anchor validation on the initial fix', () => {
    afterEach(async () => {
      jest.restoreAllMocks();
      await trackingService.resetToIdle();
    });

    it('should reject invalid or poor-accuracy initial fix in startRide() and never anchor until a valid fix arrives', async () => {
      const now = recentTimestamp();
      // Mock getCurrentGPSFix returning a poor-accuracy fix (48m > MAX_ACCEPTABLE_ACCURACY_METERS)
      jest.spyOn(locationService, 'checkLocationPermissions').mockResolvedValue({
        foregroundGranted: true,
        backgroundGranted: true,
        canTrack: true,
      });
      jest.spyOn(locationService, 'startLocationTracking').mockResolvedValue({
        success: true,
        mode: 'foreground',
      });
      jest.spyOn(locationService, 'stopLocationTracking').mockResolvedValue();
      jest.spyOn(locationService, 'getCurrentGPSFix').mockResolvedValue(
        makePoint({
          latitude: 28.6139,
          longitude: 77.2090,
          accuracy: 48, // Worse than MAX_ACCEPTABLE_ACCURACY_METERS (20m/25m)
          timestamp: now,
        })
      );

      const startRes = await trackingService.startRide();
      expect(startRes.success).toBe(true);

      // Anchor must remain null because initialFix was demoted by validateGPSPoint
      expect((trackingService as any).lastRecordedPoint).toBeNull();
      expect((trackingService as any).stationaryAnchor).toBeNull();
      expect(trackingService.getState().routeCoordinates).toHaveLength(0);

      // Feed a Null Island fix at start -> dropped, still no anchor
      await (trackingService as any).handleIncomingGPSPoints([
        makePoint({ latitude: 0, longitude: 0, accuracy: 5, timestamp: now + 1000 }),
      ]);
      expect((trackingService as any).lastRecordedPoint).toBeNull();
      expect((trackingService as any).stationaryAnchor).toBeNull();

      // Feed a poor-accuracy fix even 15 seconds after ride start -> strictly ignored, never anchors
      await (trackingService as any).handleIncomingGPSPoints([
        makePoint({ latitude: 28.6139, longitude: 77.2090, accuracy: 35, timestamp: now + 15000 }),
      ]);
      expect((trackingService as any).lastRecordedPoint).toBeNull();
      expect((trackingService as any).stationaryAnchor).toBeNull();

      // Now feed a valid, accurate fix (accuracy 8m <= MAX_ACCEPTABLE_ACCURACY_METERS) -> sets initial anchor
      const goodFirstFix = makePoint({
        latitude: 28.6139,
        longitude: 77.2090,
        accuracy: 8,
        timestamp: Date.now(),
      });
      await (trackingService as any).handleIncomingGPSPoints([goodFirstFix]);

      expect((trackingService as any).lastRecordedPoint).not.toBeNull();
      expect((trackingService as any).stationaryAnchor).not.toBeNull();
      expect((trackingService as any).lastRecordedPoint.latitude).toBeCloseTo(28.6139, 5);
      expect(trackingService.getState().currentDistanceKm).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 15 — Anchor validation on stale-period resume
  // ---------------------------------------------------------------------------
  describe('Test 15 — Anchor validation on stale-period resume', () => {
    afterEach(async () => {
      await trackingService.resetToIdle();
    });

    it('should validate candidate fixes during stale resume and reject invalid or poor-accuracy re-anchors', async () => {
      const now = recentTimestamp();
      const validOrigin = makePoint({
        latitude: 28.6139,
        longitude: 77.2090,
        accuracy: 6,
        timestamp: now - 5000,
      });

      await trackingService.resetToIdle();
      (trackingService as any).state = {
        ...trackingService.getState(),
        status: 'running',
        currentRide: {
          id: 'ride_stale_test',
          start_time: now - 5000,
          end_time: null,
          duration: 5,
          moving_time: 0,
          distance: 0,
          average_speed: 0,
          max_speed: 0,
          status: 'running',
          created_at: now - 5000,
        },
        currentLocation: {
          latitude: validOrigin.latitude,
          longitude: validOrigin.longitude,
          heading: validOrigin.heading,
          accuracy: validOrigin.accuracy,
          altitude: validOrigin.altitude,
        },
      };
      (trackingService as any).lastRecordedPoint = validOrigin;
      (trackingService as any).stationaryAnchor = validOrigin;
      (trackingService as any).isGpsStale = true;

      // 1. Feed Null Island (0, 0) while stale -> rejected, stays stale, keeps validOrigin
      await (trackingService as any).handleIncomingGPSPoints([
        makePoint({ latitude: 0, longitude: 0, accuracy: 5, timestamp: now - 2000 }),
      ]);
      expect((trackingService as any).isGpsStale).toBe(true);
      expect((trackingService as any).lastRecordedPoint.latitude).toBeCloseTo(28.6139, 5);

      // 2. Feed poor accuracy (40m) while stale -> demoted, stays stale, keeps validOrigin
      await (trackingService as any).handleIncomingGPSPoints([
        makePoint({ latitude: 28.6140, longitude: 77.2090, accuracy: 40, timestamp: now - 1000 }),
      ]);
      expect((trackingService as any).isGpsStale).toBe(true);
      expect((trackingService as any).lastRecordedPoint.latitude).toBeCloseTo(28.6139, 5);

      // 3. Feed valid accurate fix after stale period -> accepted as new baseline anchor with 0 distance added
      const validReanchor = moveNorthMeters(validOrigin, 25);
      validReanchor.accuracy = 7;
      validReanchor.timestamp = now;
      await (trackingService as any).handleIncomingGPSPoints([validReanchor]);

      expect((trackingService as any).isGpsStale).toBe(false);
      expect((trackingService as any).lastRecordedPoint.latitude).toBeCloseTo(validReanchor.latitude, 5);
      expect(trackingService.getState().currentDistanceKm).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 16 — Stationary phone recording zero distance (GPS + IMU sensors)
  // ---------------------------------------------------------------------------
  describe('Test 16 — Stationary phone recording zero distance', () => {
    it('should record zero distance, zero moving time, and zero speed when phone is still (with IMU stationary confirmation)', () => {
      const imu = new ImuMotionDetector();
      const baseTs = recentTimestamp(20000);

      // Feed 10 still accelerometer (~1g gravity, tiny sensor floor noise) and gyroscope (~0 rad/s) samples
      const sampleTime = Date.now();
      for (let i = 0; i < 10; i++) {
        const ts = sampleTime - (10 - i) * 150;
        imu.addAccelerometerSample(
          { x: 0.002 * (i % 2 === 0 ? 1 : -1), y: 0.001, z: 0.999 },
          ts
        );
        imu.addGyroscopeSample({ x: 0.003, y: -0.002, z: 0.001 }, ts);
      }

      expect(imu.isStationary(sampleTime)).toBe(true);

      const anchor = makePoint({
        latitude: 28.6448,
        longitude: 77.2167,
        accuracy: 10,
        timestamp: baseTs,
      });

      // Simulate 15 seconds of urban canyon GPS drift around the stationary phone (up to 16m wander with false 2.2 m/s speed)
      const driftOffsetsMeters = [3, -5, 8, 12, -10, 15, -14, 9, -6, 11, 16, -12, 7, -4, 5];
      let totalDistanceM = 0;
      let totalMovingTimeS = 0;
      let maxSpeedKmh = 0;
      let isCurrentlyStill = true;
      let consecutiveMoving = 0;

      for (let i = 0; i < driftOffsetsMeters.length; i++) {
        const wanderingFix = moveNorthMeters(anchor, driftOffsetsMeters[i]);
        wanderingFix.timestamp = baseTs + (i + 1) * 1000;
        wanderingFix.accuracy = 10;
        wanderingFix.speed = 2.2; // False urban multipath speed

        const res = validateGPSPoint(wanderingFix, anchor, anchor, {
          isCurrentlyStill,
          consecutiveMovingFixes: consecutiveMoving,
          imuIsStationary: imu.isStationary(sampleTime),
        });

        expect(res.isValid).toBe(true);
        expect(res.isStationaryJitter).toBe(true);
        expect(res.segmentDistanceMeters).toBe(0);
        expect(res.segmentSpeedKmh).toBe(0);

        totalDistanceM += res.segmentDistanceMeters ?? 0;
        if (!res.isStationaryJitter) {
          totalMovingTimeS += res.segmentTimeSeconds ?? 0;
          maxSpeedKmh = Math.max(maxSpeedKmh, res.segmentSpeedKmh ?? 0);
        }
        isCurrentlyStill = Boolean(res.isStationaryJitter);
        consecutiveMoving = res.consecutiveMovingFixes ?? 0;
      }

      expect(totalDistanceM).toBe(0);
      expect(totalMovingTimeS).toBe(0);
      expect(maxSpeedKmh).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 17 — Kalman smoothing reducing jitter on a noisy test trace
  // ---------------------------------------------------------------------------
  describe('Test 17 — Kalman smoothing reducing jitter on a noisy test trace', () => {
    it('should reduce lateral coordinate jitter and false distance inflation on a noisy moving trace', () => {
      const baseTs = recentTimestamp(30000);
      const startLat = 28.6139;
      const startLng = 77.2090;
      const metersPerDegLat = 111_320;
      const metersPerDegLng = 111_320 * Math.cos((startLat * Math.PI) / 180);

      // True path: rider travels straight North at 10 m/s for 20 seconds (true distance = 200 m, longitude = constant startLng)
      // Noisy GPS trace: alternating ±12m lateral (East/West) multipath jitter with 18m reported accuracy
      const rawTrace: RawGPSPoint[] = [];
      for (let i = 0; i <= 20; i++) {
        const trueNorthM = i * 10;
        const lateralJitterM = i === 0 ? 0 : (i % 2 === 1 ? 12 : -12);
        rawTrace.push(
          makePoint({
            latitude: startLat + trueNorthM / metersPerDegLat,
            longitude: startLng + lateralJitterM / metersPerDegLng,
            accuracy: 18,
            speed: 10,
            timestamp: baseTs + i * 1000,
          })
        );
      }

      const smoothedTrace = smoothGPSTrace(rawTrace);
      expect(smoothedTrace).toHaveLength(rawTrace.length);

      // Compute total path length and mean lateral error for raw vs smoothed trace
      let rawTotalDistanceM = 0;
      let smoothedTotalDistanceM = 0;
      let rawLateralErrorSumM = 0;
      let smoothedLateralErrorSumM = 0;

      for (let i = 1; i < rawTrace.length; i++) {
        rawTotalDistanceM += calculateDistanceMeters(rawTrace[i - 1], rawTrace[i]);
        smoothedTotalDistanceM += calculateDistanceMeters(smoothedTrace[i - 1], smoothedTrace[i]);

        rawLateralErrorSumM += Math.abs(rawTrace[i].longitude - startLng) * metersPerDegLng;
        smoothedLateralErrorSumM += Math.abs(smoothedTrace[i].longitude - startLng) * metersPerDegLng;
      }

      // Raw zig-zag trace inflates 200m ride to > 500m; Kalman smoothed trace is significantly closer to 200m
      expect(rawTotalDistanceM).toBeGreaterThan(450);
      expect(smoothedTotalDistanceM).toBeLessThan(rawTotalDistanceM * 0.65);
      expect(smoothedLateralErrorSumM).toBeLessThan(rawLateralErrorSumM * 0.5);
    });
  });
});
