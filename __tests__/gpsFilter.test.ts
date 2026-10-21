/**
 * GPS Filter Unit Tests — Rideoxy Telemetry
 *
 * 13 deterministic test cases covering the full validateGPSPoint() pipeline.
 * No real GPS hardware required — all inputs are synthetic RawGPSPoint objects.
 *
 * Test numbering matches the audit plan:
 *  1. Stationary jitter (small displacement, no Doppler)
 *  2. Stationary with Doppler confirmation (speed < MIN_MOVING_SPEED_MS)
 *  3. Constant movement at 36 km/h
 *  4. Tiny dt spike (< MIN_SAMPLE_INTERVAL_MS) → rejected
 *  5. Duplicate timestamp (dt = 0) → rejected
 *  6. Out-of-order timestamp (dt < 0) → rejected
 *  7. Poor accuracy rejection (> MAX_ACCEPTABLE_ACCURACY_METERS)
 *  8. Stale fix rejection (age > GPS_MAX_FIX_AGE_MS)
 *  9. Valid slow movement (2 km/h crawl)
 * 10. Valid acceleration (0 → 60 km/h segment)
 * 11. Impossible teleportation → rejected (MAX_PLAUSIBLE_SPEED_KMH)
 * 12. Background batch: burst of same-timestamp points (only 1st accepted after first)
 * 13. Null Island (0,0) coordinate → rejected
 */

import { validateGPSPoint, GPSValidationResult } from '../services/gpsFilter';
import { RawGPSPoint } from '../types/ride';
import { GPS_CONFIG } from '../constants/gps';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a fresh timestamp that is within the stale window. */
function recentTimestamp(offsetMs = 0): number {
  return Date.now() - offsetMs;
}

/**
 * Build a minimal valid RawGPSPoint at a given lat/lng with a recent timestamp.
 * All optional fields default to sensible values.
 */
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

/**
 * Haversine approximation: move `distanceM` meters north from a reference point.
 * Used to construct "moved by X meters" test fixtures without a full geo library.
 * 1 degree latitude ≈ 111,320 meters.
 */
function moveNorthMeters(base: RawGPSPoint, distanceM: number): RawGPSPoint {
  const deltaLat = distanceM / 111_320;
  return { ...base, latitude: base.latitude + deltaLat };
}

// ---------------------------------------------------------------------------
// Test 1 — Stationary jitter: very small displacement, no Doppler
// ---------------------------------------------------------------------------
describe('Test 1 — Stationary jitter (no Doppler)', () => {
  it('should mark as stationaryJitter when displacement < MIN_STATIONARY_DISTANCE_METERS', () => {
    const now = recentTimestamp();

    // Anchor and previous are the same (device has been stationary for 2s)
    const anchor = makePoint({ latitude: 28.6448, longitude: 77.2167, timestamp: now - 2000 });
    const prev   = makePoint({ latitude: 28.6448, longitude: 77.2167, timestamp: now - 1000 });

    // Current point is ~1.2 m north — GPS jitter inside anchor radius
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
describe('Test 2 — Stationary with Doppler confirmation (speed < MIN_MOVING_SPEED_MS)', () => {
  it('should mark as stationaryJitter when OS Doppler speed < 0.7 m/s and point is near anchor', () => {
    const now = recentTimestamp();

    const anchor  = makePoint({ latitude: 28.6448, longitude: 77.2167, timestamp: now - 2000 });
    const prev    = makePoint({ latitude: 28.6448, longitude: 77.2167, timestamp: now - 1000 });

    // 4 m displacement — beyond strict anchor radius but Doppler says stationary
    const current = {
      ...moveNorthMeters(anchor, 4),
      speed: 0.3, // 0.3 m/s ≈ 1.08 km/h — below MIN_MOVING_SPEED_MS (0.7)
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
    // 36 km/h = 10 m/s — in 1 second the device moves 10 m
    const now = recentTimestamp();

    const prev    = makePoint({ latitude: 28.6448, longitude: 77.2167, timestamp: now - 1000 });
    const current = {
      ...moveNorthMeters(prev, 10), // 10 m north in 1 s = 10 m/s = 36 km/h
      speed: 10,
      accuracy: 8,
      timestamp: now,
    };

    const result = validateGPSPoint(current, prev, null);

    expect(result.isValid).toBe(true);
    expect(result.isStationaryJitter).toBe(false);
    // Allow ±2 km/h tolerance for Haversine floating-point rounding
    expect(result.segmentSpeedKmh).toBeGreaterThanOrEqual(34);
    expect(result.segmentSpeedKmh).toBeLessThanOrEqual(38);
    expect(result.segmentDistanceMeters).toBeGreaterThan(9);
  });
});

// ---------------------------------------------------------------------------
// Test 4 — Tiny dt spike (< MIN_SAMPLE_INTERVAL_MS)
// ---------------------------------------------------------------------------
describe('Test 4 — Rapid burst / tiny dt spike rejection', () => {
  it('should reject a point that arrives < MIN_SAMPLE_INTERVAL_MS after the previous', () => {
    const now = recentTimestamp();

    const prev    = makePoint({ latitude: 28.6448, longitude: 77.2167, timestamp: now - 50 }); // 50ms ago
    const current = makePoint({ latitude: 28.6449, longitude: 77.2167, timestamp: now });       // dt = 50ms

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
    const prev    = makePoint({ latitude: 28.6448, longitude: 77.2167, timestamp: ts });
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
    const prev    = makePoint({ latitude: 28.6448, longitude: 77.2167, timestamp: now });
    // current has a timestamp 500ms in the PAST relative to prev
    const current = makePoint({ latitude: 28.6449, longitude: 77.2167, timestamp: now - 500 });

    const result = validateGPSPoint(current, prev, null);

    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/duplicate|backward/i);
  });
});

// ---------------------------------------------------------------------------
// Test 7 — Poor accuracy rejection (> MAX_ACCEPTABLE_ACCURACY_METERS)
// ---------------------------------------------------------------------------
describe('Test 7 — Poor accuracy rejection', () => {
  it('should reject when accuracy exceeds MAX_ACCEPTABLE_ACCURACY_METERS', () => {
    const now = recentTimestamp();
    const prev    = makePoint({ latitude: 28.6448, longitude: 77.2167, timestamp: now - 1000 });
    const current = makePoint({
      latitude: 28.6449,
      longitude: 77.2167,
      accuracy: GPS_CONFIG.MAX_ACCEPTABLE_ACCURACY_METERS + 1, // e.g. 76m
      timestamp: now,
    });

    const result = validateGPSPoint(current, prev, null);

    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/accuracy/i);
  });
});

// ---------------------------------------------------------------------------
// Test 8 — Stale fix rejection (age > GPS_MAX_FIX_AGE_MS)
// ---------------------------------------------------------------------------
describe('Test 8 — Stale GPS fix rejection', () => {
  it('should reject a fix whose timestamp is older than GPS_MAX_FIX_AGE_MS', () => {
    const staleTs = Date.now() - GPS_CONFIG.GPS_MAX_FIX_AGE_MS - 500; // 4500ms old
    const prev    = makePoint({ latitude: 28.6448, longitude: 77.2167, timestamp: staleTs - 1000 });
    const current = makePoint({ latitude: 28.6449, longitude: 77.2167, timestamp: staleTs });

    const result = validateGPSPoint(current, prev, null);

    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/stale/i);
  });
});

// ---------------------------------------------------------------------------
// Test 9 — Valid slow movement (crawl ≈ 3 km/h, clearly above moving threshold)
// ---------------------------------------------------------------------------
describe('Test 9 — Valid slow movement (crawl ~3 km/h)', () => {
  it('should accept a point representing ~3 km/h movement with displacement > accuracy bubble', () => {
    /**
     * 3 km/h = 0.833 m/s — clearly above MIN_MOVING_SPEED_MS (0.7).
     * Over 10 seconds: 8.33 m displacement.
     * GPS accuracy = 3m → accuracy bubble = min(3, 6) = 3m.
     * 8.33m > 3m → point escapes the accuracy bubble path B.
     * Path C: distanceMeters (8.33) > MIN_STATIONARY_DISTANCE_METERS (2.5) → no jitter.
     * Expected: isValid=true, isStationaryJitter=false.
     */
    const now = recentTimestamp();

    const prev    = makePoint({ latitude: 28.6448, longitude: 77.2167, accuracy: 3, timestamp: now - 10000 });
    const current = {
      ...moveNorthMeters(prev, 8.33),
      speed: 0.833, // 3 km/h in m/s — above MIN_MOVING_SPEED_MS
      accuracy: 3,
      timestamp: now,
    };

    const result = validateGPSPoint(current, prev, null);

    expect(result.isValid).toBe(true);
    expect(result.isStationaryJitter).toBe(false);
    // segmentSpeed ≈ 3 km/h — allow 2–4 km/h tolerance
    expect(result.segmentSpeedKmh).toBeGreaterThan(2);
    expect(result.segmentSpeedKmh).toBeLessThan(4);
  });
});

// ---------------------------------------------------------------------------
// Test 10 — Valid acceleration (0 → 60 km/h in 5s segment)
// ---------------------------------------------------------------------------
describe('Test 10 — Valid acceleration (0 → 60 km/h)', () => {
  it('should accept a segment representing 60 km/h average over 5 seconds', () => {
    // 60 km/h average = 16.67 m/s → 5 s → 83.3 m displacement
    const now = recentTimestamp();

    const prev    = makePoint({ latitude: 28.6448, longitude: 77.2167, timestamp: now - 5000 });
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
// Test 11 — Impossible teleportation (5 km in 1 s = 18,000 km/h)
// ---------------------------------------------------------------------------
describe('Test 11 — Impossible teleportation rejection', () => {
  it('should reject a point 5 km away in 1 second (GPS multipath / satellite glitch)', () => {
    const now = recentTimestamp();
    const prev    = makePoint({ latitude: 28.6448, longitude: 77.2167, timestamp: now - 1000 });
    // Move 5000 m north in 1 second = 18,000 km/h
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
// Test 12 — Background batch: burst of same-timestamp points
// ---------------------------------------------------------------------------
describe('Test 12 — Background batch burst deduplication', () => {
  it('should reject all but the first point when a batch arrives with identical timestamps', () => {
    /**
     * Simulates expo background task delivering 5 location objects all with
     * timestamp = delivery time (edge case on some Android versions).
     * The filtering contract: after the 1st point is accepted, subsequent
     * points with dt < MIN_SAMPLE_INTERVAL_MS must be rejected.
     */
    const batchTs = recentTimestamp();

    const base = makePoint({ latitude: 28.6448, longitude: 77.2167, timestamp: batchTs - 1000 });
    const batchPoints = [
      makePoint({ latitude: 28.6449, longitude: 77.2167, timestamp: batchTs }),
      makePoint({ latitude: 28.6450, longitude: 77.2167, timestamp: batchTs }), // same ts
      makePoint({ latitude: 28.6451, longitude: 77.2167, timestamp: batchTs }), // same ts
    ];

    // First point in batch: prev = base (1000ms gap) → should be accepted
    const r0 = validateGPSPoint(batchPoints[0], base, null);
    expect(r0.isValid).toBe(true);

    // Second point: prev = batchPoints[0] (0ms gap) → should be rejected
    const r1 = validateGPSPoint(batchPoints[1], batchPoints[0], null);
    expect(r1.isValid).toBe(false);
    expect(r1.reason).toMatch(/duplicate|backward/i);

    // Third point: still same ts as batchPoints[0] → rejected
    const r2 = validateGPSPoint(batchPoints[2], batchPoints[0], null);
    expect(r2.isValid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test 13 — Null Island (0, 0) rejection
// ---------------------------------------------------------------------------
describe('Test 13 — Null Island coordinate rejection', () => {
  it('should reject a GPS fix at (0, 0) — uninitialized hardware cache', () => {
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
// Bonus — First point of ride (no previous)
// ---------------------------------------------------------------------------
describe('Bonus — First point of ride (no previous)', () => {
  it('should accept the first GPS fix and return stationaryJitter=true with zero distance/speed', () => {
    const current = makePoint({ latitude: 28.6448, longitude: 77.2167 });

    const result = validateGPSPoint(current, null, null);

    expect(result.isValid).toBe(true);
    expect(result.isStationaryJitter).toBe(true);
    expect(result.segmentSpeedKmh).toBe(0);
    expect(result.segmentDistanceMeters).toBe(0);
  });
});
