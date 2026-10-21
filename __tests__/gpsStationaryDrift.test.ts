/**
 * GPS Stationary Drift & Hysteresis Unit Tests — Rideoxy Telemetry
 *
 * Covers:
 * 1. A still phone with drifting points: distance stays about 0, top speed 0.
 * 2. A still phone wandering at 40 to 65 m accuracy counts 0 distance, 0 top speed, and every fix is "demoted" or "still", never "accepted".
 * 3. A real 1 km straight ride: distance within a few percent.
 * 4. A single 500 m teleport spike: rejected.
 * 5. Speed -1 input: falls back to computed speed.
 * 6. Stale timestamp rejection & deferred batch in timestamp order.
 * 7. 259 km/h fix with mocked = true (no simulator flag) is ACCEPTED, and identical fix with mocked = false is REJECTED.
 * 8. Android platform thresholds explicitly executed (24m accuracy accepted on Android, demoted on iOS).
 * 9. Re-enter-still test: ride ~500 m, stop, 20s jitter at new location; still re-engages and distance stays ~500 m.
 */

import { validateGPSPoint, GPSValidationResult } from '../services/gpsFilter';
import { RawGPSPoint } from '../types/ride';
import { GPS_FILTER_CONFIG } from '../constants/gps';

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

describe('Section 5 — GPS Drift, Stationary, and Platform Verification', () => {
  // ---------------------------------------------------------------------------
  // 1. Still phone with drifting points: distance stays about 0, top speed 0
  // ---------------------------------------------------------------------------
  it('1. A still phone with drifting points: distance stays about 0, top speed 0', () => {
    const baseCoords = { latitude: 28.6448, longitude: 77.2167 };
    const startTime = recentTimestamp(35000);

    const initialFix = makePoint({
      ...baseCoords,
      timestamp: startTime,
      accuracy: 10,
      speed: -1,
    });

    let lastAcceptedFix: RawGPSPoint = initialFix;
    let stationaryAnchor: RawGPSPoint | null = initialFix;
    let isStill = true;
    let consecutiveMovingFixes = 0;
    let totalDistanceMeters = 0;
    let maxSpeedKmh = 0;
    let displayedSpeedKmh = 0;

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
    ];

    for (let i = 0; i < driftOffsets.length; i++) {
      const [north, east] = driftOffsets[i];
      const drifted = moveMeters(baseCoords, north, east);
      const pointTs = startTime + (i + 1) * 1000;

      const incomingFix = makePoint({
        latitude: drifted.latitude,
        longitude: drifted.longitude,
        timestamp: pointTs,
        accuracy: 10 + (i % 5),
        speed: i % 2 === 0 ? -1 : 0.2,
      });

      const validation = validateGPSPoint(
        incomingFix,
        lastAcceptedFix,
        stationaryAnchor,
        {
          isCurrentlyStill: isStill,
          consecutiveMovingFixes,
        }
      );

      expect(validation.isValid).toBe(true);
      expect(validation.isStationaryJitter).toBe(true);

      if (validation.isStationaryJitter) {
        isStill = true;
        consecutiveMovingFixes = validation.consecutiveMovingFixes ?? 0;
        displayedSpeedKmh = 0;
      } else {
        isStill = false;
        totalDistanceMeters += validation.segmentDistanceMeters ?? 0;
        if ((validation.segmentSpeedKmh ?? 0) > maxSpeedKmh) {
          maxSpeedKmh = validation.segmentSpeedKmh ?? 0;
        }
      }
    }

    expect(totalDistanceMeters).toBe(0);
    expect(maxSpeedKmh).toBe(0);
    expect(displayedSpeedKmh).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // 2. Still phone wandering at 40 to 65 m accuracy counts 0 distance and 0 top speed
  // ---------------------------------------------------------------------------
  it('2. A still phone wandering at 40 to 65 m accuracy counts 0 distance and 0 top speed, decisions demoted or still, never accepted', () => {
    const baseCoords = { latitude: 28.6448, longitude: 77.2167 };
    const startTime = recentTimestamp(30000);

    const initialFix = makePoint({
      ...baseCoords,
      timestamp: startTime,
      accuracy: 10,
      speed: 0,
    });

    let lastAcceptedFix: RawGPSPoint = initialFix;
    let stationaryAnchor: RawGPSPoint | null = initialFix;
    let isStill = true;
    let consecutiveMovingFixes = 0;
    let totalDistanceMeters = 0;
    let maxSpeedKmh = 0;

    const decisions: ('accepted' | 'still' | 'demoted')[] = [];

    // Simulate 20 poor-accuracy wandering fixes with accuracy between 40m and 65m
    for (let i = 1; i <= 20; i++) {
      const accuracy = 40 + (i * 1.25); // 40m to 65m
      const wander = moveMeters(baseCoords, (i % 5) * 4, ((i + 2) % 5) * 4); // 0m to 20m displacement
      const incomingFix = makePoint({
        latitude: wander.latitude,
        longitude: wander.longitude,
        timestamp: startTime + i * 1000,
        accuracy,
        speed: 0.5,
      });

      const validation = validateGPSPoint(
        incomingFix,
        lastAcceptedFix,
        stationaryAnchor,
        {
          isCurrentlyStill: isStill,
          consecutiveMovingFixes,
        }
      );

      expect(validation.isValid).toBe(true);

      let decision: 'accepted' | 'still' | 'demoted';
      if (validation.isDemoted) {
        decision = 'demoted';
        // Demoted fix never contributes distance, never updates top speed, never moves anchor
      } else if (validation.isStationaryJitter) {
        decision = 'still';
      } else {
        decision = 'accepted';
        totalDistanceMeters += validation.segmentDistanceMeters ?? 0;
        if ((validation.segmentSpeedKmh ?? 0) > maxSpeedKmh) {
          maxSpeedKmh = validation.segmentSpeedKmh ?? 0;
        }
        lastAcceptedFix = incomingFix;
      }

      decisions.push(decision);
    }

    // Every fix's decision is "demoted" or "still", never "accepted"
    expect(decisions.every((d) => d === 'demoted' || d === 'still')).toBe(true);
    expect(decisions.some((d) => d === 'demoted')).toBe(true);
    expect(totalDistanceMeters).toBe(0);
    expect(maxSpeedKmh).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // 3. Real 1 km straight ride: distance within a few percent
  // ---------------------------------------------------------------------------
  it('3. A real 1 km straight ride: distance within a few percent', () => {
    const baseCoords = { latitude: 28.6448, longitude: 77.2167 };
    const startTime = recentTimestamp(80000);

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

    const speedMs = 13.8889; // 50 km/h
    const totalSteps = 72; // 72 seconds = 1000.0 m

    for (let i = 1; i <= totalSteps; i++) {
      currentCoords = moveMeters(currentCoords, speedMs, 0);
      const incomingFix = makePoint({
        latitude: currentCoords.latitude,
        longitude: currentCoords.longitude,
        timestamp: startTime + i * 1000,
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

    expect(totalDistanceMeters).toBeGreaterThanOrEqual(980);
    expect(totalDistanceMeters).toBeLessThanOrEqual(1020);
    expect(maxSpeedKmh).toBeGreaterThanOrEqual(48);
    expect(maxSpeedKmh).toBeLessThanOrEqual(52);
  });

  // ---------------------------------------------------------------------------
  // 4. Single 500 m teleport spike: rejected
  // ---------------------------------------------------------------------------
  it('4. A single 500 m teleport spike: rejected', () => {
    const now = recentTimestamp();
    const prev = makePoint({
      latitude: 28.6448,
      longitude: 77.2167,
      timestamp: now - 1000,
      accuracy: 8,
      speed: 15,
    });

    const spikeCoords = moveMeters(prev, 500, 0);
    const spikePoint = makePoint({
      latitude: spikeCoords.latitude,
      longitude: spikeCoords.longitude,
      timestamp: now,
      accuracy: 12,
      speed: 15,
    });

    const result = validateGPSPoint(spikePoint, prev, null);

    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/spike jump|impossible speed/i);
  });

  // ---------------------------------------------------------------------------
  // 5. Speed -1 input: falls back to computed speed
  // ---------------------------------------------------------------------------
  it('5. Speed -1 input: falls back to computed speed', () => {
    const now = recentTimestamp();
    const prev = makePoint({
      latitude: 28.6448,
      longitude: 77.2167,
      timestamp: now - 1000,
      accuracy: 6,
      speed: null,
    });

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
    expect(result.segmentSpeedKmh).toBeGreaterThanOrEqual(53);
    expect(result.segmentSpeedKmh).toBeLessThanOrEqual(55);
  });

  // ---------------------------------------------------------------------------
  // 6. Stale timestamp rules
  // ---------------------------------------------------------------------------
  it('6. Stale timestamp rules: backward timestamps rejected, cached first fix > 10s dropped, deferred batch accepted in order', () => {
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

    // B. First fix is a 15-second old cached fix: rejected
    const cachedOldFirstFix = makePoint({
      latitude: 28.6450,
      longitude: 77.2167,
      timestamp: Date.now() - 15000,
      accuracy: 8,
    });
    const resultCached = validateGPSPoint(cachedOldFirstFix, null, null);
    expect(resultCached.isValid).toBe(false);
    expect(resultCached.reason).toMatch(/cached first fix older than 10s/i);

    // C. Deferred batch of fixes with old-but-increasing timestamps: accepted in order
    const oldBaseTs = Date.now() - 45000;
    const acceptedBase = makePoint({
      latitude: 28.6448,
      longitude: 77.2167,
      timestamp: oldBaseTs,
    });
    const b1 = makePoint({ latitude: 28.6449, longitude: 77.2167, timestamp: oldBaseTs + 1000 });
    const b2 = makePoint({ latitude: 28.6450, longitude: 77.2167, timestamp: oldBaseTs + 2000 });

    const resB1 = validateGPSPoint(b1, acceptedBase, null);
    expect(resB1.isValid).toBe(true);

    const resB2 = validateGPSPoint(b2, b1, null);
    expect(resB2.isValid).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 7. 259 km/h emulator playback with mocked=true vs mocked=false
  // ---------------------------------------------------------------------------
  it('7. 259 km/h fix with mocked = true (no simulator flag) is ACCEPTED, and identical fix with mocked = false is REJECTED', () => {
    const now = recentTimestamp();
    const prev = makePoint({
      latitude: 28.6448,
      longitude: 77.2167,
      timestamp: now - 1000,
      accuracy: 5,
      speed: 71.94, // 259 km/h
    });

    const nextCoords = moveMeters(prev, 71.94, 0);

    // Release build simulation: temporarily set __DEV__ to false to test release device behavior
    const originalDev = (global as any).__DEV__;
    (global as any).__DEV__ = false;

    try {
      // Case A: mocked = true, NO simulator flag passed
      const mockedFix = makePoint({
        latitude: nextCoords.latitude,
        longitude: nextCoords.longitude,
        timestamp: now,
        accuracy: 5,
        speed: 71.94,
        mocked: true, // Cap raised by mocked alone to 120 m/s
      });
      const resultMocked = validateGPSPoint(mockedFix, prev, null);
      expect(resultMocked.isValid).toBe(true);
      expect(resultMocked.isStationaryJitter).toBe(false);
      expect(resultMocked.segmentSpeedKmh).toBeGreaterThanOrEqual(255);
      expect(resultMocked.segmentSpeedKmh).toBeLessThanOrEqual(263);

      // Case B: mocked = false, identical coordinates and speed
      const nonMockedFix = makePoint({
        latitude: nextCoords.latitude,
        longitude: nextCoords.longitude,
        timestamp: now,
        accuracy: 5,
        speed: 71.94,
        mocked: false, // Subject to 70 m/s cap in release builds
      });
      const resultNonMocked = validateGPSPoint(nonMockedFix, prev, null);
      expect(resultNonMocked.isValid).toBe(false);
      expect(resultNonMocked.reason).toMatch(/spike jump|impossible speed/i);
    } finally {
      (global as any).__DEV__ = originalDev;
    }
  });

  // ---------------------------------------------------------------------------
  // 8. Android platform thresholds explicitly executed
  // ---------------------------------------------------------------------------
  it('8. Android platform thresholds explicitly executed (24m accuracy accepted on Android, demoted on iOS)', () => {
    const now = recentTimestamp();
    const prev = makePoint({
      latitude: 28.6448,
      longitude: 77.2167,
      timestamp: now - 1000,
      accuracy: 10,
      speed: 10,
    });

    const nextCoords = moveMeters(prev, 10, 0);
    const testPoint = makePoint({
      latitude: nextCoords.latitude,
      longitude: nextCoords.longitude,
      timestamp: now,
      accuracy: 24, // 24m accuracy: within Android 25m limit, but worse than iOS 20m limit
      speed: 10,
    });

    // On Android (threshold 25m): 24m is accepted, genuine movement counted
    const resultAndroid = validateGPSPoint(testPoint, prev, null, {
      platform: 'android',
      isCurrentlyStill: false,
    });
    expect(resultAndroid.isValid).toBe(true);
    expect(resultAndroid.isDemoted).toBe(false);
    expect(resultAndroid.segmentDistanceMeters).toBeGreaterThan(9);

    // On iOS (threshold 20m): 24m is DEMOTED, contributes 0 distance
    const resultIOS = validateGPSPoint(testPoint, prev, null, {
      platform: 'ios',
      isCurrentlyStill: false,
    });
    expect(resultIOS.isValid).toBe(true);
    expect(resultIOS.isDemoted).toBe(true);
    expect(resultIOS.segmentDistanceMeters).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // 9. Re-enter-still test: ride ~500m, stop, 20s jitter at new location
  // ---------------------------------------------------------------------------
  it('9. Re-enter-still test: ride ~500 m, stop, 20s jitter around new location; still re-engages and distance stays ~500 m', () => {
    const baseCoords = { latitude: 28.6448, longitude: 77.2167 };
    const startTime = recentTimestamp(100000);

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

    // Phase A: Ride 500 m at steady speed (13.89 m/s = 50 km/h, 36 steps of 13.89m = 500m)
    const speedMs = 13.8889;
    const rideSteps = 36;
    let currentTs = startTime;

    for (let i = 1; i <= rideSteps; i++) {
      currentCoords = moveMeters(currentCoords, speedMs, 0);
      currentTs += 1000;

      const incomingFix = makePoint({
        latitude: currentCoords.latitude,
        longitude: currentCoords.longitude,
        timestamp: currentTs,
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
        }
      );

      expect(validation.isValid).toBe(true);

      if (validation.isStationaryJitter) {
        isStill = true;
        consecutiveMovingFixes = validation.consecutiveMovingFixes ?? 0;
      } else {
        isStill = false;
        consecutiveMovingFixes = validation.consecutiveMovingFixes ?? 0;
        stationaryAnchor = null; // Exit still state
        totalDistanceMeters += validation.segmentDistanceMeters ?? 0;
        lastAcceptedFix = incomingFix;
      }
    }

    // Assert ride completed ~500m and is currently moving
    expect(totalDistanceMeters).toBeGreaterThanOrEqual(490);
    expect(totalDistanceMeters).toBeLessThanOrEqual(510);
    expect(isStill).toBe(false);
    expect(stationaryAnchor).toBeNull();

    const distanceAtStop = totalDistanceMeters;
    const stopCoords = { ...currentCoords };

    // Phase B: Rider stops at the ~500m mark. First fix at 0 speed re-engages still state.
    currentTs += 1000;
    const stopFix = makePoint({
      latitude: stopCoords.latitude,
      longitude: stopCoords.longitude,
      timestamp: currentTs,
      accuracy: 6,
      speed: 0, // Stopped
    });

    const stopValidation = validateGPSPoint(
      stopFix,
      lastAcceptedFix,
      stationaryAnchor,
      {
        isCurrentlyStill: isStill,
        consecutiveMovingFixes,
      }
    );

    expect(stopValidation.isValid).toBe(true);
    expect(stopValidation.isStationaryJitter).toBe(true);

    // Tracking service anchors at the stop location:
    isStill = true;
    consecutiveMovingFixes = 0;
    stationaryAnchor = lastAcceptedFix; // Re-anchor at the new stop point!

    // Phase C: 20 seconds of GPS jitter around the stop location (±1m to 4m jitter, accuracy 6-10m)
    for (let j = 1; j <= 20; j++) {
      currentTs += 1000;
      const jitterNorth = ((j % 4) - 1.5) * 1.5; // -2.25m to +2.25m
      const jitterEast = (((j + 1) % 4) - 1.5) * 1.5;
      const jitterCoords = moveMeters(stopCoords, jitterNorth, jitterEast);

      const jitterFix = makePoint({
        latitude: jitterCoords.latitude,
        longitude: jitterCoords.longitude,
        timestamp: currentTs,
        accuracy: 7 + (j % 4),
        speed: 0.2, // Small Doppler noise
      });

      const jitterValidation = validateGPSPoint(
        jitterFix,
        lastAcceptedFix,
        stationaryAnchor,
        {
          isCurrentlyStill: isStill,
          consecutiveMovingFixes,
        }
      );

      expect(jitterValidation.isValid).toBe(true);
      expect(jitterValidation.isStationaryJitter).toBe(true);

      // Still state remains active, no distance added
      if (!jitterValidation.isStationaryJitter) {
        totalDistanceMeters += jitterValidation.segmentDistanceMeters ?? 0;
      }
    }

    // Still successfully re-engaged: total distance remained at the ~500m stop distance!
    expect(totalDistanceMeters).toBe(distanceAtStop);
    expect(isStill).toBe(true);
  });
});
