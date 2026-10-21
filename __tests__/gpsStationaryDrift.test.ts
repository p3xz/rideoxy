/**
 * GPS Stationary Drift & Hysteresis Unit Tests — Rideoxy Telemetry
 *
 * Covers all Section 5 requirements:
 * 1. A still phone with drifting points: distance stays about 0, top speed 0.
 * 2. A real 1 km straight ride: distance within a few percent.
 * 3. A single 500 m teleport spike: rejected.
 * 4. Speed -1 input: falls back to computed speed.
 * 5. Stale timestamp: rejected.
 * 6. Emulator playback at 259 km/h with the raised cap: accepted.
 * 7. Android behavior doesn't regress.
 */

import { validateGPSPoint, GPSValidationResult } from '../services/gpsFilter';
import { RawGPSPoint } from '../types/ride';
import { GPS_FILTER_CONFIG, GPS_CONFIG } from '../constants/gps';
import { calculateDistanceMeters } from '../services/distance';

function recentTimestamp(offsetMs = 0): number {
  return Date.now() - offsetMs;
}

function makePoint(
  overrides: Partial<RawGPSPoint> & { latitude: number; longitude: number; timestamp: number }
): RawGPSPoint {
  return {
    altitude: 250,
    speed: null,
    accuracy: 8,
    heading: 0,
    ...overrides,
  };
}

function moveMeters(
  base: { latitude: number; longitude: number },
  northM: number,
  eastM: number = 0
): { latitude: number; longitude: number } {
  const deltaLat = northM / 111_320;
  const deltaLng = eastM / (111_320 * Math.cos((base.latitude * Math.PI) / 180));
  return {
    latitude: base.latitude + deltaLat,
    longitude: base.longitude + deltaLng,
  };
}

describe('Section 5 — GPS Drift & Stationary Verification', () => {
  // ---------------------------------------------------------------------------
  // 1. Still phone with drifting points
  // ---------------------------------------------------------------------------
  it('1. A still phone with drifting points: distance stays about 0, top speed 0', () => {
    const baseCoords = { latitude: 28.6448, longitude: 77.2167 };
    const startTime = recentTimestamp(35000);

    // Initial fix sitting on a table
    const initialFix = makePoint({
      ...baseCoords,
      timestamp: startTime,
      accuracy: 10,
      speed: -1, // iOS unknown speed
    });

    let lastAcceptedFix: RawGPSPoint = initialFix;
    let stationaryAnchor: RawGPSPoint | null = initialFix;
    let isStill = true;
    let consecutiveMovingFixes = 0;
    let totalDistanceMeters = 0;
    let maxSpeedKmh = 0;
    let displayedSpeedKmh = 0;

    // Simulate 30 drifting GPS fixes inside jitter bubble (1 to 6m displacement, noisy accuracy)
    const driftOffsets = [
      [1.2, 0.5],
      [-2.1, 1.0],
      [3.0, -1.5],
      [0.8, 2.2],
      [-1.5, -2.0],
      [2.5, 1.8],
      [-0.5, 3.1],
      [4.2, -0.8],
      [1.1, -2.5],
      [-3.0, 0.2],
      [2.0, 2.0],
      [-1.8, -1.2],
      [3.5, 1.0],
      [0.4, -2.8],
      [-2.2, 2.5],
      [1.9, 0.8],
      [-3.1, -1.4],
      [2.8, 2.1],
      [0.9, -1.9],
      [-1.4, 3.0],
      [2.2, -0.5],
      [-2.5, 1.7],
      [3.1, -2.1],
      [0.7, 1.4],
      [-1.9, -1.8],
      [2.4, 0.9],
      [-0.8, 2.6],
      [1.5, -1.5],
      [-2.3, 0.4],
      [1.8, 1.2],
    ];

    for (let i = 0; i < driftOffsets.length; i++) {
      const [north, east] = driftOffsets[i];
      const drifted = moveMeters(baseCoords, north, east);
      const pointTs = startTime + (i + 1) * 1000;

      const incomingFix = makePoint({
        latitude: drifted.latitude,
        longitude: drifted.longitude,
        timestamp: pointTs,
        accuracy: 10 + (i % 5), // Accuracy 10m - 14m
        speed: i % 2 === 0 ? -1 : 0.2, // Alternating iOS unknown (-1) and sub-1m/s noise
      });

      const validation = validateGPSPoint(
        incomingFix,
        lastAcceptedFix,
        stationaryAnchor,
        {
          isCurrentlyStill: isStill,
          consecutiveMovingFixes,
          isSimulator: false,
          skipStaleCheck: true,
        }
      );

      expect(validation.isValid).toBe(true);
      expect(validation.isStationaryJitter).toBe(true);

      if (validation.isStationaryJitter) {
        isStill = true;
        consecutiveMovingFixes = validation.consecutiveMovingFixes ?? 0;
        displayedSpeedKmh = 0;
        // NO distance, NO top speed update
      } else {
        isStill = false;
        totalDistanceMeters += validation.segmentDistanceMeters ?? 0;
        if ((validation.segmentSpeedKmh ?? 0) > maxSpeedKmh) {
          maxSpeedKmh = validation.segmentSpeedKmh ?? 0;
        }
      }
    }

    // After 30 seconds of drift on the table:
    expect(totalDistanceMeters).toBe(0);
    expect(maxSpeedKmh).toBe(0);
    expect(displayedSpeedKmh).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // 2. Real 1 km straight ride: distance within a few percent
  // ---------------------------------------------------------------------------
  it('2. A real 1 km straight ride: distance within a few percent', () => {
    const baseCoords = { latitude: 28.6448, longitude: 77.2167 };
    const startTime = recentTimestamp(80000);

    // Ride starts at baseCoords
    let currentCoords = { ...baseCoords };
    let lastAcceptedFix = makePoint({
      ...currentCoords,
      timestamp: startTime,
      accuracy: 5,
      speed: 0,
    });
    let stationaryAnchor: RawGPSPoint | null = lastAcceptedFix;
    let isStill = true;
    let consecutiveMovingFixes = 0;
    let totalDistanceMeters = 0;
    let maxSpeedKmh = 0;

    // Moving at 50 km/h (13.889 m/s) for 72 seconds = 1000.0 meters total
    const speedMs = 13.8889;
    const totalSteps = 72;

    for (let i = 1; i <= totalSteps; i++) {
      currentCoords = moveMeters(currentCoords, speedMs, 0);
      const pointTs = startTime + i * 1000;

      const incomingFix = makePoint({
        latitude: currentCoords.latitude,
        longitude: currentCoords.longitude,
        timestamp: pointTs,
        accuracy: 5,
        speed: speedMs,
      });

      const validation = validateGPSPoint(
        incomingFix,
        lastAcceptedFix,
        stationaryAnchor,
        {
          isCurrentlyStill: isStill,
          consecutiveMovingFixes,
          isSimulator: false,
          skipStaleCheck: true,
        }
      );

      expect(validation.isValid).toBe(true);

      if (validation.isStationaryJitter) {
        isStill = true;
        consecutiveMovingFixes = validation.consecutiveMovingFixes ?? 0;
      } else {
        isStill = false;
        consecutiveMovingFixes = validation.consecutiveMovingFixes ?? 0;
        stationaryAnchor = null;
        totalDistanceMeters += validation.segmentDistanceMeters ?? 0;
        const segmentSpeedKmh = validation.segmentSpeedKmh ?? 0;
        if (segmentSpeedKmh > maxSpeedKmh) {
          maxSpeedKmh = segmentSpeedKmh;
        }
        lastAcceptedFix = incomingFix;
      }
    }

    // 1 km target: total distance should be within 2% (980m - 1020m)
    expect(totalDistanceMeters).toBeGreaterThanOrEqual(980);
    expect(totalDistanceMeters).toBeLessThanOrEqual(1020);
    // Speed should be ~50 km/h (allow 48 - 52 km/h)
    expect(maxSpeedKmh).toBeGreaterThanOrEqual(48);
    expect(maxSpeedKmh).toBeLessThanOrEqual(52);
  });

  // ---------------------------------------------------------------------------
  // 3. Single 500 m teleport spike: rejected
  // ---------------------------------------------------------------------------
  it('3. A single 500 m teleport spike: rejected', () => {
    const now = recentTimestamp();
    const prev = makePoint({
      latitude: 28.6448,
      longitude: 77.2167,
      timestamp: now - 1000,
      accuracy: 8,
      speed: 15,
    });

    // Sudden 500 m jump in 1 second (500 m/s = 1800 km/h)
    const spikeCoords = moveMeters(prev, 500, 0);
    const spikePoint = makePoint({
      latitude: spikeCoords.latitude,
      longitude: spikeCoords.longitude,
      timestamp: now,
      accuracy: 12,
      speed: 15,
    });

    const result = validateGPSPoint(spikePoint, prev, null, { isSimulator: false });

    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/spike jump|impossible speed/i);
  });

  // ---------------------------------------------------------------------------
  // 4. Speed -1 input: falls back to computed speed
  // ---------------------------------------------------------------------------
  it('4. Speed -1 input: falls back to computed speed', () => {
    const now = recentTimestamp();
    const prev = makePoint({
      latitude: 28.6448,
      longitude: 77.2167,
      timestamp: now - 1000,
      accuracy: 6,
      speed: null,
    });

    // 15 m in 1 second = 15 m/s = 54 km/h
    const nextCoords = moveMeters(prev, 15, 0);
    const nextPoint = makePoint({
      latitude: nextCoords.latitude,
      longitude: nextCoords.longitude,
      timestamp: now,
      accuracy: 6,
      speed: -1, // iOS unknown speed
    });

    const result = validateGPSPoint(nextPoint, prev, null, {
      isCurrentlyStill: false,
      consecutiveMovingFixes: 0,
    });

    expect(result.isValid).toBe(true);
    expect(result.isStationaryJitter).toBe(false);
    expect(result.reportedSpeedMs).toBeNull();
    // Segment speed derived from coordinates: ~54 km/h (allow 53 - 55)
    expect(result.segmentSpeedKmh).toBeGreaterThanOrEqual(53);
    expect(result.segmentSpeedKmh).toBeLessThanOrEqual(55);
  });

  // ---------------------------------------------------------------------------
  // 5. Stale timestamp: rejected
  // ---------------------------------------------------------------------------
  it('5. Stale timestamp: rejected', () => {
    const now = recentTimestamp();
    const prev = makePoint({
      latitude: 28.6448,
      longitude: 77.2167,
      timestamp: now,
      accuracy: 8,
    });

    // A. Timestamp older than previous accepted fix
    const backwardsPoint = makePoint({
      latitude: 28.6450,
      longitude: 77.2167,
      timestamp: now - 2000,
      accuracy: 8,
    });

    const resultBackwards = validateGPSPoint(backwardsPoint, prev, null);
    expect(resultBackwards.isValid).toBe(false);
    expect(resultBackwards.reason).toMatch(/duplicate|backward/i);

    // B. Fix stale compared to wall-clock time (> GPS_FILTER_CONFIG.MAX_FIX_AGE_MS = 4000ms)
    const veryOldPoint = makePoint({
      latitude: 28.6450,
      longitude: 77.2167,
      timestamp: Date.now() - 10000, // 10 seconds old
      accuracy: 8,
    });

    const resultStale = validateGPSPoint(veryOldPoint, null, null);
    expect(resultStale.isValid).toBe(false);
    expect(resultStale.reason).toMatch(/stale/i);
  });

  // ---------------------------------------------------------------------------
  // 6. Emulator playback at 259 km/h with the raised cap: accepted
  // ---------------------------------------------------------------------------
  it('6. Emulator playback at 259 km/h with the raised cap: accepted', () => {
    const now = recentTimestamp();
    const prev = makePoint({
      latitude: 28.6448,
      longitude: 77.2167,
      timestamp: now - 1000,
      accuracy: 5,
      speed: 71.94, // 259 km/h in m/s
    });

    // 259 km/h = 71.94 m/s in 1 second
    const nextCoords = moveMeters(prev, 71.94, 0);
    const nextPoint = makePoint({
      latitude: nextCoords.latitude,
      longitude: nextCoords.longitude,
      timestamp: now,
      accuracy: 5,
      speed: 71.94,
      mocked: true, // Android mocked or emulator playback
    });

    // On real device with cap = 70 m/s: rejected (71.94 > 70)
    const resultRealDevice = validateGPSPoint(nextPoint, prev, null, {
      isSimulator: false,
    });
    // Even if mocked=true, if isSimulator is explicitly forced to false without mocked check:
    // With mocked: true, isSimulatorOrMocked(nextPoint) returns true!
    const nonMockedReal = { ...nextPoint, mocked: false };
    const resultRealNonMocked = validateGPSPoint(nonMockedReal, prev, null, {
      isSimulator: false,
    });
    expect(resultRealNonMocked.isValid).toBe(false);
    expect(resultRealNonMocked.reason).toMatch(/spike jump|impossible speed/i);

    // On emulator / simulator (raised cap = 120 m/s): ACCEPTED!
    const resultEmulator = validateGPSPoint(nextPoint, prev, null, {
      isSimulator: true,
    });
    expect(resultEmulator.isValid).toBe(true);
    expect(resultEmulator.isStationaryJitter).toBe(false);
    // Segment speed derived: ~259 km/h
    expect(resultEmulator.segmentSpeedKmh).toBeGreaterThanOrEqual(255);
    expect(resultEmulator.segmentSpeedKmh).toBeLessThanOrEqual(263);
  });

  // ---------------------------------------------------------------------------
  // 7. Android behavior doesn't regress
  // ---------------------------------------------------------------------------
  it('7. Android behavior doesn\'t regress', () => {
    const now = recentTimestamp();
    const prev = makePoint({
      latitude: 28.6448,
      longitude: 77.2167,
      timestamp: now - 1000,
      accuracy: 22, // Android accuracy 22m (within 25m Android limit)
      speed: 10,
    });

    const nextCoords = moveMeters(prev, 12, 0);
    const nextPoint = makePoint({
      latitude: nextCoords.latitude,
      longitude: nextCoords.longitude,
      timestamp: now,
      accuracy: 24, // Within 25m
      speed: 12,
      mocked: false,
    });

    const result = validateGPSPoint(nextPoint, prev, null, {
      isSimulator: false,
      platform: 'android',
    });

    expect(result.isValid).toBe(true);
    expect(result.isStationaryJitter).toBe(false);
    expect(result.segmentDistanceMeters).toBeGreaterThan(11);
    expect(result.segmentDistanceMeters).toBeLessThan(13);
  });
});
