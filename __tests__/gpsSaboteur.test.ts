import { validateGPSPoint, GPS_FILTER_THRESHOLDS } from '../services/gpsFilter';
import { trackingService } from '../services/tracking';
import { RawGPSPoint } from '../types/ride';
import { calculateDistanceMeters } from '../services/distance';

// Helper to simulate a fresh ride in trackingService without native hardware
async function setupRunningRide(initialPoint?: RawGPSPoint) {
  await trackingService.resetToIdle();
  const startTime = Date.now();
  const rideId = `test_ride_${startTime}`;
  
  (trackingService as any).state = {
    status: 'running',
    currentRide: {
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
    currentLocation: initialPoint
      ? {
          latitude: initialPoint.latitude,
          longitude: initialPoint.longitude,
          heading: initialPoint.heading,
          accuracy: initialPoint.accuracy,
          altitude: initialPoint.altitude,
        }
      : null,
    routeCoordinates: initialPoint ? [[initialPoint.longitude, initialPoint.latitude]] : [],
    recentPointsCount: initialPoint ? 1 : 0,
    lastUpdated: startTime,
    gpsSignalState: initialPoint ? 'good' : 'searching',
  };

  (trackingService as any).lastRecordedPoint = initialPoint ?? null;
  (trackingService as any).stationaryAnchor = initialPoint ?? null;
  (trackingService as any).isStill = true;
  (trackingService as any).consecutiveMovingFixes = 0;
  (trackingService as any).speedSmoothingQueue = [];
  (trackingService as any).lastPointReceivedTime = initialPoint ? startTime : 0;
  (trackingService as any).isGpsStale = false;

  return rideId;
}

async function feedPoints(points: RawGPSPoint[]) {
  // Feed through private handleIncomingGPSPoints
  await (trackingService as any).handleIncomingGPSPoints(points);
}

describe('Persona 4: The GPS Saboteur — Hostile Synthetic Streams', () => {
  beforeEach(() => {
    trackingService.resetToIdle();
  });

  afterEach(() => {
    trackingService.resetToIdle();
  });

  // ---------------------------------------------------------------------------
  // Stream 1: Duplicate fixes
  // Identical lat, lng, and timestamp sent 5 times in a row
  // ---------------------------------------------------------------------------
  describe('1. Duplicate fixes: identical lat, lng, and timestamp sent 5 times in a row', () => {
    it('runs through validateGPSPoint and trackingService', async () => {
      const now = Date.now();
      const pt: RawGPSPoint = {
        latitude: 28.6139,
        longitude: 77.2090,
        altitude: 215,
        accuracy: 5,
        speed: 10,
        heading: 90,
        timestamp: now,
      };

      // Direct validateGPSPoint checks
      const res1 = validateGPSPoint(pt, null, null);
      expect(res1.isValid).toBe(true);

      const res2 = validateGPSPoint(pt, pt, pt);
      expect(res2.isValid).toBe(false);
      expect(res2.reason).toBe('Duplicate or backward timestamp');

      // Now feed to trackingService
      await setupRunningRide(pt);
      const stateBefore = trackingService.getState();

      // Feed duplicate 4 more times sequentially
      for (let i = 0; i < 4; i++) {
        await feedPoints([pt]);
      }

      const stateAfter = trackingService.getState();
      console.log('Stream 1 Results:', {
        distanceKm: stateAfter.currentDistanceKm,
        durationSec: stateAfter.currentDurationSeconds,
        movingTimeSec: stateAfter.currentMovingTimeSeconds,
        topSpeedKmh: stateAfter.currentMaxSpeedKmh,
        avgSpeedKmh: stateAfter.currentAvgSpeedKmh,
        recentPointsCount: stateAfter.recentPointsCount,
      });

      expect(stateAfter.currentDistanceKm).toBe(0);
      expect(stateAfter.currentMovingTimeSeconds).toBe(0);
      expect(stateAfter.currentMaxSpeedKmh).toBe(0);
      expect(stateAfter.currentAvgSpeedKmh).toBe(0);
      expect(stateAfter.recentPointsCount).toBe(1); // Only the initial point
    });
  });

  // ---------------------------------------------------------------------------
  // Stream 2: Fixes arriving out of order
  // timestamp 100s, then 80s, then 120s, then 90s
  // ---------------------------------------------------------------------------
  describe('2. Fixes arriving out of order: timestamp 100s, then 80s, then 120s, then 90s', () => {
    it('runs sequentially (separate deliveries)', async () => {
      const baseTime = 1700000000000;
      const initialPt: RawGPSPoint = {
        latitude: 28.6139,
        longitude: 77.2090,
        altitude: 215,
        accuracy: 5,
        speed: 0,
        heading: 0,
        timestamp: baseTime,
      };

      await setupRunningRide(initialPt);

      // We move slightly north on each valid forward step
      // 100s: +100m north
      const pt100: RawGPSPoint = {
        latitude: 28.6139 + 100 / 111320,
        longitude: 77.2090,
        altitude: 215,
        accuracy: 5,
        speed: 10,
        heading: 0,
        timestamp: baseTime + 100000, // +100s
      };

      // 80s: out of order backward
      const pt80: RawGPSPoint = {
        latitude: 28.6139 + 80 / 111320,
        longitude: 77.2090,
        altitude: 215,
        accuracy: 5,
        speed: 10,
        heading: 0,
        timestamp: baseTime + 80000, // +80s
      };

      // 120s: forward from 100s (+200m north)
      const pt120: RawGPSPoint = {
        latitude: 28.6139 + 200 / 111320,
        longitude: 77.2090,
        altitude: 215,
        accuracy: 5,
        speed: 10,
        heading: 0,
        timestamp: baseTime + 120000, // +120s
      };

      // 90s: out of order backward from 120s
      const pt90: RawGPSPoint = {
        latitude: 28.6139 + 90 / 111320,
        longitude: 77.2090,
        altitude: 215,
        accuracy: 5,
        speed: 10,
        heading: 0,
        timestamp: baseTime + 90000, // +90s
      };

      // Feed pt100
      await feedPoints([pt100]);
      const s1 = trackingService.getState();

      // Feed pt80
      await feedPoints([pt80]);
      const s2 = trackingService.getState();

      // Feed pt120
      await feedPoints([pt120]);
      const s3 = trackingService.getState();

      // Feed pt90
      await feedPoints([pt90]);
      const s4 = trackingService.getState();

      console.log('Stream 2 Sequential Results:', {
        afterPt100: { distKm: s1.currentDistanceKm, movingSec: s1.currentMovingTimeSeconds, points: s1.recentPointsCount },
        afterPt80: { distKm: s2.currentDistanceKm, movingSec: s2.currentMovingTimeSeconds, points: s2.recentPointsCount },
        afterPt120: { distKm: s3.currentDistanceKm, movingSec: s3.currentMovingTimeSeconds, points: s3.recentPointsCount },
        afterPt90: { distKm: s4.currentDistanceKm, movingSec: s4.currentMovingTimeSeconds, points: s4.recentPointsCount },
      });

      // pt80 should be rejected because 80s < 100s
      expect(s2.currentDistanceKm).toBe(s1.currentDistanceKm);
      expect(s2.recentPointsCount).toBe(s1.recentPointsCount);

      // pt120 should be accepted relative to pt100 (dt = 20s, dist = 100m, speed = 5 m/s = 18 km/h)
      expect(s3.currentDistanceKm).toBeGreaterThan(s1.currentDistanceKm);

      // pt90 should be rejected because 90s < 120s
      expect(s4.currentDistanceKm).toBe(s3.currentDistanceKm);
      expect(s4.recentPointsCount).toBe(s3.recentPointsCount);
    });

    it('runs as a single batch [pt100, pt80, pt120, pt90]', async () => {
      const baseTime = 1700000000000;
      const initialPt: RawGPSPoint = {
        latitude: 28.6139,
        longitude: 77.2090,
        altitude: 215,
        accuracy: 5,
        speed: 0,
        heading: 0,
        timestamp: baseTime,
      };

      await setupRunningRide(initialPt);

      const pt100: RawGPSPoint = {
        latitude: 28.6139 + 100 / 111320,
        longitude: 77.2090,
        altitude: 215,
        accuracy: 5,
        speed: 10,
        heading: 0,
        timestamp: baseTime + 100000,
      };
      const pt80: RawGPSPoint = {
        latitude: 28.6139 + 80 / 111320,
        longitude: 77.2090,
        altitude: 215,
        accuracy: 5,
        speed: 10,
        heading: 0,
        timestamp: baseTime + 80000,
      };
      const pt120: RawGPSPoint = {
        latitude: 28.6139 + 200 / 111320,
        longitude: 77.2090,
        altitude: 215,
        accuracy: 5,
        speed: 10,
        heading: 0,
        timestamp: baseTime + 120000,
      };
      const pt90: RawGPSPoint = {
        latitude: 28.6139 + 90 / 111320,
        longitude: 77.2090,
        altitude: 215,
        accuracy: 5,
        speed: 10,
        heading: 0,
        timestamp: baseTime + 90000,
      };

      // Feed all in 1 batch
      await feedPoints([pt100, pt80, pt120, pt90]);
      const sBatch = trackingService.getState();
      console.log('Stream 2 Batch Results (sorted by trackingService):', {
        distKm: sBatch.currentDistanceKm,
        movingSec: sBatch.currentMovingTimeSeconds,
        points: sBatch.recentPointsCount,
        maxSpeed: sBatch.currentMaxSpeedKmh,
      });
      // In batch, handleIncomingGPSPoints sorts by timestamp -> 80, 90, 100, 120
      // All 4 can be processed in sorted monotonic order!
    });
  });

  // ---------------------------------------------------------------------------
  // Stream 3: Deferred batches
  // 0 fixes for 30 seconds, then 10 fixes all delivered at exact same ms or sub-ms
  // ---------------------------------------------------------------------------
  describe('3. Deferred batches: 0 fixes for 30 seconds, then 10 fixes all at same ms', () => {
    it('tests same millisecond delivery', async () => {
      const now = Date.now();
      const initialPt: RawGPSPoint = {
        latitude: 28.6139,
        longitude: 77.2090,
        altitude: 215,
        accuracy: 5,
        speed: 0,
        heading: 0,
        timestamp: now,
      };
      await setupRunningRide(initialPt);

      // Simulate 30s silence -> isGpsStale becomes true
      (trackingService as any).isGpsStale = true;

      // 10 fixes at identical timestamp (now + 30000)
      const deliveryTs = now + 30000;
      const batch: RawGPSPoint[] = [];
      for (let i = 0; i < 10; i++) {
        batch.push({
          latitude: 28.6139 + (i * 10) / 111320,
          longitude: 77.2090,
          altitude: 215,
          accuracy: 5,
          speed: 5,
          heading: 0,
          timestamp: deliveryTs, // ALL identical millisecond
        });
      }

      await feedPoints(batch);
      const state = trackingService.getState();
      console.log('Stream 3 Same-ms Results:', {
        distKm: state.currentDistanceKm,
        movingSec: state.currentMovingTimeSeconds,
        points: state.recentPointsCount,
        topSpeedKmh: state.currentMaxSpeedKmh,
        avgSpeedKmh: state.currentAvgSpeedKmh,
      });

      // Fix 0 hit isGpsStale -> re-anchored baseline (0 distance, 0 speed)
      // Fixes 1-9 had timeDeltaMs = 0 <= 0 -> rejected ("Duplicate or backward timestamp")
      expect(state.currentDistanceKm).toBe(0);
      expect(state.currentMovingTimeSeconds).toBe(0);
      expect(state.currentMaxSpeedKmh).toBe(0);
      expect(state.recentPointsCount).toBe(1); // Only the initial point was added to route
    });

    it('tests sub-200ms deltas (e.g. 50ms intervals in batch)', async () => {
      const now = Date.now();
      const initialPt: RawGPSPoint = {
        latitude: 28.6139,
        longitude: 77.2090,
        altitude: 215,
        accuracy: 5,
        speed: 0,
        heading: 0,
        timestamp: now,
      };
      await setupRunningRide(initialPt);

      (trackingService as any).isGpsStale = true;

      const deliveryTs = now + 30000;
      const batch: RawGPSPoint[] = [];
      for (let i = 0; i < 10; i++) {
        batch.push({
          latitude: 28.6139 + (i * 10) / 111320,
          longitude: 77.2090,
          altitude: 215,
          accuracy: 5,
          speed: 5,
          heading: 0,
          timestamp: deliveryTs + i * 50, // 50ms delta < 200ms threshold
        });
      }

      await feedPoints(batch);
      const state = trackingService.getState();
      console.log('Stream 3 Sub-200ms Results:', {
        distKm: state.currentDistanceKm,
        movingSec: state.currentMovingTimeSeconds,
        points: state.recentPointsCount,
        topSpeedKmh: state.currentMaxSpeedKmh,
      });

      // Fix 0 re-anchors
      // Fixes 1-9 rejected for dt < 200ms (Rapid duplicate/burst sample)
      expect(state.currentDistanceKm).toBe(0);
      expect(state.currentMaxSpeedKmh).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Stream 4: City teleport and back
  // Delhi (28.6139, 77.2090) -> 1s later Mumbai (19.0760, 72.8777) -> 1s later Delhi
  // ---------------------------------------------------------------------------
  describe('4. City teleport and back: Delhi -> 1s Mumbai -> 1s Delhi', () => {
    it('analyzes direct validateGPSPoint and trackingService behavior', async () => {
      const now = Date.now();
      const delhi1: RawGPSPoint = {
        latitude: 28.6139,
        longitude: 77.2090,
        altitude: 215,
        accuracy: 5,
        speed: 0,
        heading: 0,
        timestamp: now,
      };

      const mumbai: RawGPSPoint = {
        latitude: 19.0760,
        longitude: 72.8777,
        altitude: 10,
        accuracy: 5,
        speed: 1148000, // or whatever
        heading: 180,
        timestamp: now + 1000, // 1s later
      };

      const delhi2: RawGPSPoint = {
        latitude: 28.6139,
        longitude: 77.2090,
        altitude: 215,
        accuracy: 5,
        speed: 0,
        heading: 0,
        timestamp: now + 2000, // 1s later
      };

      // 1. Direct validation check
      const resMumbai = validateGPSPoint(mumbai, delhi1, delhi1);
      console.log('Stream 4 Mumbai Validation:', {
        isValid: resMumbai.isValid,
        reason: resMumbai.reason,
        derivedSpeedMs: resMumbai.derivedSpeedMs,
        segmentDistanceMeters: resMumbai.segmentDistanceMeters,
      });

      expect(resMumbai.isValid).toBe(false);
      expect(resMumbai.reason).toContain('Impossible speed / spike jump rejected');

      // 2. Tracking service integration
      await setupRunningRide(delhi1);
      await feedPoints([mumbai]);
      const stateAfterMumbai = trackingService.getState();

      await feedPoints([delhi2]);
      const stateAfterDelhi2 = trackingService.getState();

      console.log('Stream 4 Teleport Results in trackingService:', {
        afterMumbai: {
          distKm: stateAfterMumbai.currentDistanceKm,
          topSpeedKmh: stateAfterMumbai.currentMaxSpeedKmh,
          avgSpeedKmh: stateAfterMumbai.currentAvgSpeedKmh,
          points: stateAfterMumbai.recentPointsCount,
        },
        afterDelhi2: {
          distKm: stateAfterDelhi2.currentDistanceKm,
          topSpeedKmh: stateAfterDelhi2.currentMaxSpeedKmh,
          avgSpeedKmh: stateAfterDelhi2.currentAvgSpeedKmh,
          points: stateAfterDelhi2.recentPointsCount,
        },
      });

      // Mumbai MUST be rejected: 0 distance, 0 speed
      expect(stateAfterMumbai.currentDistanceKm).toBe(0);
      expect(stateAfterMumbai.currentMaxSpeedKmh).toBe(0);

      // Delhi2 is compared against last recorded point (delhi1, since mumbai was rejected).
      // Distance from delhi1 to delhi2 is 0m. Time delta is 2s.
      // Classified as stationary jitter!
      expect(stateAfterDelhi2.currentDistanceKm).toBe(0);
      expect(stateAfterDelhi2.currentMaxSpeedKmh).toBe(0);
      expect(stateAfterDelhi2.currentMovingTimeSeconds).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Stream 5: Accuracy swinging wildly
  // 5 m -> 45 m -> 500 m -> 8 m -> 80 m
  // ---------------------------------------------------------------------------
  describe('5. Accuracy swinging wildly: 5m -> 45m -> 500m -> 8m -> 80m', () => {
    it('tests accuracy demotion and distance leakage', async () => {
      const now = Date.now();
      const pt1: RawGPSPoint = {
        latitude: 28.6139,
        longitude: 77.2090,
        altitude: 215,
        accuracy: 5,
        speed: 10,
        heading: 0,
        timestamp: now,
      };

      // In trackingService
      await setupRunningRide(pt1);

      // Fix 2: 45m accuracy, moving 20m north (1s later)
      const pt2: RawGPSPoint = {
        latitude: 28.6139 + 20 / 111320,
        longitude: 77.2090,
        altitude: 215,
        accuracy: 45, // > 25m Android / 20m iOS -> demoted
        speed: 10,
        heading: 0,
        timestamp: now + 1000,
      };

      // Fix 3: 500m accuracy, moving another 50m north (1s later)
      const pt3: RawGPSPoint = {
        latitude: 28.6139 + 70 / 111320,
        longitude: 77.2090,
        altitude: 215,
        accuracy: 500, // > 25m -> demoted
        speed: 10,
        heading: 0,
        timestamp: now + 2000,
      };

      // Fix 4: 8m accuracy, moving another 10m north (total 80m from pt1) (1s later)
      const pt4: RawGPSPoint = {
        latitude: 28.6139 + 80 / 111320,
        longitude: 77.2090,
        altitude: 215,
        accuracy: 8, // <= 25m -> accepted
        speed: 10,
        heading: 0,
        timestamp: now + 3000,
      };

      // Fix 5: 80m accuracy (1s later)
      const pt5: RawGPSPoint = {
        latitude: 28.6139 + 100 / 111320,
        longitude: 77.2090,
        altitude: 215,
        accuracy: 80, // > 25m -> demoted
        speed: 10,
        heading: 0,
        timestamp: now + 4000,
      };

      // Feed sequential
      await feedPoints([pt2]);
      const sPt2 = trackingService.getState();

      await feedPoints([pt3]);
      const sPt3 = trackingService.getState();

      await feedPoints([pt4]);
      const sPt4 = trackingService.getState();

      await feedPoints([pt5]);
      const sPt5 = trackingService.getState();

      console.log('Stream 5 Accuracy Swing Results:', {
        pt2_45m: { distKm: sPt2.currentDistanceKm, points: sPt2.recentPointsCount, speed: sPt2.currentSpeedKmh },
        pt3_500m: { distKm: sPt3.currentDistanceKm, points: sPt3.recentPointsCount, speed: sPt3.currentSpeedKmh },
        pt4_8m: { distKm: sPt4.currentDistanceKm, points: sPt4.recentPointsCount, speed: sPt4.currentSpeedKmh },
        pt5_80m: { distKm: sPt5.currentDistanceKm, points: sPt5.recentPointsCount, speed: sPt5.currentSpeedKmh },
      });

      // Verify demoted points do not add distance or trackpoints
      expect(sPt2.currentDistanceKm).toBe(0);
      expect(sPt2.recentPointsCount).toBe(1);

      expect(sPt3.currentDistanceKm).toBe(0);
      expect(sPt3.recentPointsCount).toBe(1);

      // pt4 is 80m from pt1 over 3 seconds -> ~26.7 m/s (~96 km/h)
      expect(sPt4.currentDistanceKm).toBeGreaterThan(0.07);
      expect(sPt4.recentPointsCount).toBe(2);

      // pt5 is demoted -> no change to distance or points
      expect(sPt5.currentDistanceKm).toBe(sPt4.currentDistanceKm);
      expect(sPt5.recentPointsCount).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Stream 6: Speed stuck at -1 or NaN or negative
  // ---------------------------------------------------------------------------
  describe('6. Speed stuck at -1, NaN, or negative', () => {
    it('tests fallback to coordinate-derived speed', async () => {
      const now = Date.now();
      const pt1: RawGPSPoint = {
        latitude: 28.6139,
        longitude: 77.2090,
        altitude: 215,
        accuracy: 5,
        speed: -1, // stuck at -1 (Android unknown)
        heading: 0,
        timestamp: now,
      };

      await setupRunningRide(pt1);

      // Move 10 meters north in 1 second (10 m/s = 36 km/h) with speed = -1
      const ptMinus1: RawGPSPoint = {
        latitude: 28.6139 + 10 / 111320,
        longitude: 77.2090,
        altitude: 215,
        accuracy: 5,
        speed: -1,
        heading: 0,
        timestamp: now + 1000,
      };

      // Move another 10 meters north in 1 second with speed = NaN
      const ptNaN: RawGPSPoint = {
        latitude: 28.6139 + 20 / 111320,
        longitude: 77.2090,
        altitude: 215,
        accuracy: 5,
        speed: NaN,
        heading: 0,
        timestamp: now + 2000,
      };

      // Move another 10 meters north in 1 second with speed = -99
      const ptNeg: RawGPSPoint = {
        latitude: 28.6139 + 30 / 111320,
        longitude: 77.2090,
        altitude: 215,
        accuracy: 5,
        speed: -99,
        heading: 0,
        timestamp: now + 3000,
      };

      await feedPoints([ptMinus1]);
      const sMinus1 = trackingService.getState();

      await feedPoints([ptNaN]);
      const sNaN = trackingService.getState();

      await feedPoints([ptNeg]);
      const sNeg = trackingService.getState();

      console.log('Stream 6 Negative/NaN Speed Results:', {
        speedMinus1: {
          currentSpeed: sMinus1.currentSpeedKmh,
          maxSpeed: sMinus1.currentMaxSpeedKmh,
          distance: sMinus1.currentDistanceKm,
        },
        speedNaN: {
          currentSpeed: sNaN.currentSpeedKmh,
          maxSpeed: sNaN.currentMaxSpeedKmh,
          distance: sNaN.currentDistanceKm,
        },
        speedNeg: {
          currentSpeed: sNeg.currentSpeedKmh,
          maxSpeed: sNeg.currentMaxSpeedKmh,
          distance: sNeg.currentDistanceKm,
        },
      });

      // Verify that speed derived from coordinates (36 km/h) is used instead of 0 or negative
      expect(sMinus1.currentMaxSpeedKmh).toBeGreaterThanOrEqual(34);
      expect(sMinus1.currentMaxSpeedKmh).toBeLessThanOrEqual(38);
      expect(sMinus1.currentDistanceKm).toBeGreaterThan(0.009);

      expect(sNaN.currentMaxSpeedKmh).toBeGreaterThanOrEqual(34);
      expect(sNeg.currentMaxSpeedKmh).toBeGreaterThanOrEqual(34);
    });
  });

  // ---------------------------------------------------------------------------
  // Stream 7: Fixes at Null Island (0, 0) or off-world latitudes (> 90 or < -90)
  // ---------------------------------------------------------------------------
  describe('7. Fixes at Null Island (0, 0) or off-world latitudes', () => {
    it('validates rejection in validateGPSPoint', () => {
      const now = Date.now();
      const nullIsland: RawGPSPoint = {
        latitude: 0.0,
        longitude: 0.0,
        altitude: 0,
        accuracy: 5,
        speed: 0,
        heading: 0,
        timestamp: now,
      };
      const offWorldLatPos: RawGPSPoint = {
        latitude: 91.5,
        longitude: 77.2090,
        altitude: 0,
        accuracy: 5,
        speed: 0,
        heading: 0,
        timestamp: now,
      };
      const offWorldLatNeg: RawGPSPoint = {
        latitude: -95.0,
        longitude: 77.2090,
        altitude: 0,
        accuracy: 5,
        speed: 0,
        heading: 0,
        timestamp: now,
      };

      const resNull = validateGPSPoint(nullIsland, null);
      const resPos = validateGPSPoint(offWorldLatPos, null);
      const resNeg = validateGPSPoint(offWorldLatNeg, null);

      expect(resNull.isValid).toBe(false);
      expect(resNull.reason).toBe('Null Island (0,0) coordinate');
      expect(resPos.isValid).toBe(false);
      expect(resPos.reason).toBe('Coordinates out of geographic range');
      expect(resNeg.isValid).toBe(false);
      expect(resNeg.reason).toBe('Coordinates out of geographic range');
    });

    it('EXPOSES VULNERABILITY: what happens during stale re-anchor in trackingService?', async () => {
      const now = Date.now();
      const initialPt: RawGPSPoint = {
        latitude: 28.6139,
        longitude: 77.2090,
        altitude: 215,
        accuracy: 5,
        speed: 0,
        heading: 0,
        timestamp: now,
      };

      await setupRunningRide(initialPt);

      // Simulate stale state (e.g. after 2s of signal loss)
      (trackingService as any).isGpsStale = true;

      // Hostile fix arrives at Null Island (0, 0)
      const nullIsland: RawGPSPoint = {
        latitude: 0.0,
        longitude: 0.0,
        altitude: 0,
        accuracy: 5,
        speed: 0,
        heading: 0,
        timestamp: now + 3000,
      };

      await feedPoints([nullIsland]);
      const state = trackingService.getState();

      console.log('Stream 7 Stale Re-Anchor with Null Island:', {
        currentLocation: state.currentLocation,
        gpsSignalState: state.gpsSignalState,
        lastRecordedPoint: (trackingService as any).lastRecordedPoint,
      });

      // CHECK IF TRACKING SERVICE ACCEPTED NULL ISLAND WITHOUT VALIDATION!
      const leakedNullIsland = state.currentLocation?.latitude === 0 && state.currentLocation?.longitude === 0;
      console.log('CRITICAL CHECK: Did currentLocation leak Null Island (0,0)?', leakedNullIsland);
    });
  });

  // ---------------------------------------------------------------------------
  // Stream 8: Timestamps from last week (stale fixes cached by OS or provider)
  // ---------------------------------------------------------------------------
  describe('8. Timestamps from last week (stale fixes)', () => {
    it('tests stale first fix at ride start and during ride', async () => {
      const now = Date.now();
      const oneWeekAgo = now - 7 * 24 * 3600 * 1000;

      const staleFix: RawGPSPoint = {
        latitude: 28.6139,
        longitude: 77.2090,
        altitude: 215,
        accuracy: 5,
        speed: 0,
        heading: 0,
        timestamp: oneWeekAgo,
      };

      // 1. As initial fix at ride start
      const resStart = validateGPSPoint(staleFix, null, null, { now });
      console.log('Stream 8 Initial Fix from Last Week:', {
        isValid: resStart.isValid,
        reason: resStart.reason,
      });
      expect(resStart.isValid).toBe(false);
      expect(resStart.reason).toContain('Cached first fix older than 10s rejected');

      // 2. As incoming fix mid-ride
      const validInitial: RawGPSPoint = {
        latitude: 28.6139,
        longitude: 77.2090,
        altitude: 215,
        accuracy: 5,
        speed: 0,
        heading: 0,
        timestamp: now,
      };
      await setupRunningRide(validInitial);

      await feedPoints([staleFix]);
      const stateMid = trackingService.getState();
      console.log('Stream 8 Mid-Ride Stale Fix Results:', {
        distKm: stateMid.currentDistanceKm,
        points: stateMid.recentPointsCount,
      });
      expect(stateMid.currentDistanceKm).toBe(0);
      expect(stateMid.recentPointsCount).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Stream 9: Stream that alternates still and teleport every second
  // stationary (0 km/h) -> 5 km jump -> stationary -> 5 km jump
  // ---------------------------------------------------------------------------
  describe('9. Stream that alternates still and teleport every second', () => {
    it('tests stationary -> 5km jump -> stationary -> 5km jump', async () => {
      const now = Date.now();
      const baseLat = 28.6139;
      const baseLng = 77.2090;

      const initialPt: RawGPSPoint = {
        latitude: baseLat,
        longitude: baseLng,
        altitude: 215,
        accuracy: 5,
        speed: 0,
        heading: 0,
        timestamp: now,
      };

      await setupRunningRide(initialPt);

      // t=1s: stationary (same location)
      const pt1Still: RawGPSPoint = {
        latitude: baseLat + 1 / 111320, // 1m drift
        longitude: baseLng,
        altitude: 215,
        accuracy: 5,
        speed: 0,
        heading: 0,
        timestamp: now + 1000,
      };

      // t=2s: 5 km teleport jump (5000m north)
      const pt2Teleport: RawGPSPoint = {
        latitude: baseLat + 5000 / 111320,
        longitude: baseLng,
        altitude: 215,
        accuracy: 5,
        speed: 5000,
        heading: 0,
        timestamp: now + 2000,
      };

      // t=3s: stationary back at base location
      const pt3Still: RawGPSPoint = {
        latitude: baseLat + 2 / 111320,
        longitude: baseLng,
        altitude: 215,
        accuracy: 5,
        speed: 0,
        heading: 0,
        timestamp: now + 3000,
      };

      // t=4s: 5 km teleport jump again
      const pt4Teleport: RawGPSPoint = {
        latitude: baseLat + 5000 / 111320,
        longitude: baseLng,
        altitude: 215,
        accuracy: 5,
        speed: 5000,
        heading: 0,
        timestamp: now + 4000,
      };

      await feedPoints([pt1Still]);
      const s1 = trackingService.getState();

      await feedPoints([pt2Teleport]);
      const s2 = trackingService.getState();

      await feedPoints([pt3Still]);
      const s3 = trackingService.getState();

      await feedPoints([pt4Teleport]);
      const s4 = trackingService.getState();

      console.log('Stream 9 Alternating Teleport Results:', {
        afterPt1Still: { distKm: s1.currentDistanceKm, maxSpeed: s1.currentMaxSpeedKmh },
        afterPt2Teleport: { distKm: s2.currentDistanceKm, maxSpeed: s2.currentMaxSpeedKmh },
        afterPt3Still: { distKm: s3.currentDistanceKm, maxSpeed: s3.currentMaxSpeedKmh },
        afterPt4Teleport: { distKm: s4.currentDistanceKm, maxSpeed: s4.currentMaxSpeedKmh },
      });

      expect(s2.currentDistanceKm).toBe(0);
      expect(s2.currentMaxSpeedKmh).toBe(0);
      expect(s4.currentDistanceKm).toBe(0);
      expect(s4.currentMaxSpeedKmh).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Stream 10: Stationary jitter at 40-65m accuracy: phone sitting on desk
  // ---------------------------------------------------------------------------
  describe('10. Stationary jitter at 40-65m accuracy: phone sitting on desk', () => {
    it('tests 20 consecutive drifting fixes with poor accuracy 40-65m', async () => {
      const now = Date.now();
      const baseLat = 28.6139;
      const baseLng = 77.2090;

      const initialPt: RawGPSPoint = {
        latitude: baseLat,
        longitude: baseLng,
        altitude: 215,
        accuracy: 10,
        speed: 0,
        heading: 0,
        timestamp: now,
      };

      await setupRunningRide(initialPt);

      // 20 points wandering around with accuracy 40 to 65m
      const jitterOffsets = [
        [15, 10, 42],
        [-20, 15, 55],
        [30, -18, 62],
        [10, 25, 48],
        [-15, -20, 50],
        [22, 18, 58],
        [-10, 31, 65],
        [35, -12, 44],
        [18, -25, 53],
        [-25, 12, 60],
        [20, 20, 46],
        [-18, -15, 52],
        [28, 10, 59],
        [12, -28, 63],
        [-22, 22, 41],
        [19, 15, 47],
        [-28, -14, 56],
        [25, 21, 61],
        [14, -19, 49],
        [-16, 25, 54],
      ];

      for (let i = 0; i < jitterOffsets.length; i++) {
        const [dNorth, dEast, acc] = jitterOffsets[i];
        const pt: RawGPSPoint = {
          latitude: baseLat + dNorth / 111320,
          longitude: baseLng + dEast / (111320 * Math.cos((baseLat * Math.PI) / 180)),
          altitude: 215,
          accuracy: acc,
          speed: 0.2, // slight jitter speed
          heading: 0,
          timestamp: now + (i + 1) * 1000,
        };
        await feedPoints([pt]);
      }

      const finalState = trackingService.getState();
      console.log('Stream 10 Stationary Jitter (40-65m) Results:', {
        distanceKm: finalState.currentDistanceKm,
        durationSeconds: finalState.currentDurationSeconds,
        movingTimeSeconds: finalState.currentMovingTimeSeconds,
        topSpeedKmh: finalState.currentMaxSpeedKmh,
        avgSpeedKmh: finalState.currentAvgSpeedKmh,
        recentPointsCount: finalState.recentPointsCount,
      });

      // Must count strictly 0 distance, 0 moving time, 0 top speed, 0 avg speed
      expect(finalState.currentDistanceKm).toBe(0);
      expect(finalState.currentMovingTimeSeconds).toBe(0);
      expect(finalState.currentMaxSpeedKmh).toBe(0);
      expect(finalState.currentAvgSpeedKmh).toBe(0);
      expect(finalState.recentPointsCount).toBe(1); // Only initial
    });
  });
});
