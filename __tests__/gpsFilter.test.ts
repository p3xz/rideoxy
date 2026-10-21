/**
 * GPS Filter Unit Tests — Rideoxy Telemetry
 *
 * Deterministic test cases covering the full validateGPSPoint() pipeline.
 * No real GPS hardware required — all inputs are synthetic RawGPSPoint objects.
 */

import { validateGPSPoint, GPSValidationResult } from '../services/gpsFilter';
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
});
