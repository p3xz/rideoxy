import { RawGPSPoint } from '../types/ride';
import { GPS_CONFIG } from '../constants/gps';
import { calculateDistanceMeters } from './distance';

export interface GPSValidationResult {
  isValid: boolean;
  reason?: string;
  isStationaryJitter?: boolean;
  /** Single authoritative segment speed derived from coordinates. Used for ALL speed metrics. */
  segmentSpeedKmh?: number;
  /** Haversine distance from previous point in meters. */
  segmentDistanceMeters?: number;
  /** Timestamp delta from previous point in seconds. */
  segmentTimeSeconds?: number;
}

/**
 * Contextual GPS filter that preserves legitimate route points while strongly suppressing
 * stationary GPS drift, impossible jumps, invalid coords, duplicate points, extreme spikes,
 * and stale mock/hardware caches. GPS noise cannot be eliminated entirely by software;
 * this filter strongly suppresses stationary GPS drift and rejects the most common artifacts.
 *
 * CRITICAL DESIGN INVARIANT:
 * All returned metrics (segmentSpeedKmh, segmentDistanceMeters, segmentTimeSeconds) are derived
 * from a SINGLE source of truth: the Haversine coordinate distance divided by the GPS timestamp delta.
 * This ensures avg(speed) <= max(speed) mathematically, because average speed is the
 * time-weighted mean of individual segment speeds.
 */
export function validateGPSPoint(
  current: RawGPSPoint,
  previous: RawGPSPoint | null,
  stationaryAnchor?: RawGPSPoint | null
): GPSValidationResult {
  // 1. Basic Coordinate Sanity Check
  if (
    typeof current.latitude !== 'number' ||
    typeof current.longitude !== 'number' ||
    isNaN(current.latitude) ||
    isNaN(current.longitude)
  ) {
    return { isValid: false, reason: 'Invalid coordinate numbers' };
  }

  if (
    current.latitude < -90 ||
    current.latitude > 90 ||
    current.longitude < -180 ||
    current.longitude > 180
  ) {
    return { isValid: false, reason: 'Coordinates out of geographic range' };
  }

  // Null Island check (exact 0,0 usually means uninitialized GPS)
  if (Math.abs(current.latitude) < 0.0001 && Math.abs(current.longitude) < 0.0001) {
    return { isValid: false, reason: 'Null Island (0,0) coordinate' };
  }

  // 2. Severe Accuracy Rejection
  if (
    current.accuracy !== null &&
    current.accuracy > GPS_CONFIG.MAX_ACCEPTABLE_ACCURACY_METERS
  ) {
    return { isValid: false, reason: `Accuracy too poor (${Math.round(current.accuracy)}m)` };
  }

  // 3. Stale Hardware Cache Check (wall-clock comparison)
  const now = Date.now();
  if (current.timestamp && now - current.timestamp > GPS_CONFIG.GPS_MAX_FIX_AGE_MS) {
    return { isValid: false, reason: `Stale GPS fix (${Math.round((now - current.timestamp) / 1000)}s old)` };
  }

  // First point of a ride: accept position, zero movement
  if (!previous) {
    return {
      isValid: true,
      isStationaryJitter: true,
      segmentSpeedKmh: 0,
      segmentDistanceMeters: 0,
      segmentTimeSeconds: 0,
    };
  }

  // 4. Timestamp Validation (reject duplicate timestamps and rapid bursts)
  const timeDeltaMs = current.timestamp - previous.timestamp;
  if (timeDeltaMs <= 0) {
    return { isValid: false, reason: 'Duplicate or backward timestamp' };
  }

  if (timeDeltaMs < GPS_CONFIG.MIN_SAMPLE_INTERVAL_MS) {
    return { isValid: false, reason: `Rapid duplicate/burst sample (< ${GPS_CONFIG.MIN_SAMPLE_INTERVAL_MS}ms)` };
  }

  const timeDeltaSeconds = timeDeltaMs / 1000;
  const distanceMeters = calculateDistanceMeters(
    { latitude: previous.latitude, longitude: previous.longitude },
    { latitude: current.latitude, longitude: current.longitude }
  );

  // 5. Point-to-Point Velocity Check (single authoritative speed)
  const segmentSpeedMs = distanceMeters / timeDeltaSeconds;
  const segmentSpeedKmh = segmentSpeedMs * 3.6;

  // If segment speed exceeds maximum plausible motorcycle velocity, reject the entire segment
  if (segmentSpeedKmh > GPS_CONFIG.MAX_PLAUSIBLE_SPEED_KMH) {
    return {
      isValid: false,
      reason: `Impossible speed (${Math.round(segmentSpeedKmh)} km/h, ${Math.round(distanceMeters)}m in ${timeDeltaSeconds.toFixed(1)}s)`,
      segmentDistanceMeters: distanceMeters,
      segmentTimeSeconds: timeDeltaSeconds,
    };
  }

  // 6. Contextual Physics & Stationary Detection (Accuracy + Doppler Speed + Stationary Anchor)
  const osSpeedMs =
    current.speed !== null && current.speed !== undefined && current.speed >= 0
      ? current.speed
      : null;

  const currentAcc = current.accuracy ?? 15;
  const prevAcc = previous.accuracy ?? 15;
  const effectiveAccuracy = Math.max(currentAcc, prevAcc);

  // Measure displacement from stationary anchor if device is currently anchored
  const anchorDisplacementMeters = stationaryAnchor
    ? calculateDistanceMeters(
        { latitude: stationaryAnchor.latitude, longitude: stationaryAnchor.longitude },
        { latitude: current.latitude, longitude: current.longitude }
      )
    : distanceMeters;

  // A. Anchored Stationary Jitter: If anchored and displacement from anchor is within stationary radius,
  // hold device stationary. Incoming noise cannot drift the reference point.
  if (stationaryAnchor && anchorDisplacementMeters < GPS_CONFIG.MIN_STATIONARY_DISTANCE_METERS) {
    return {
      isValid: true,
      isStationaryJitter: true,
      segmentSpeedKmh: 0,
      segmentDistanceMeters: 0,
      segmentTimeSeconds: timeDeltaSeconds,
    };
  }

  // B. Stationary Jitter via Accuracy Bubble & OS Speed:
  // If displacement from anchor is smaller than the GPS accuracy bubble AND OS Doppler speed indicates stationary/stopped
  if (
    osSpeedMs !== null &&
    osSpeedMs < GPS_CONFIG.MIN_MOVING_SPEED_MS &&
    anchorDisplacementMeters < Math.min(effectiveAccuracy, 6.0)
  ) {
    return {
      isValid: true,
      isStationaryJitter: true,
      segmentSpeedKmh: 0,
      segmentDistanceMeters: 0,
      segmentTimeSeconds: timeDeltaSeconds,
    };
  }

  // C. Consecutive step stationary: negligible point-to-point delta with sub-moving speed
  if (
    distanceMeters < GPS_CONFIG.MIN_STATIONARY_DISTANCE_METERS &&
    (segmentSpeedMs < GPS_CONFIG.MIN_MOVING_SPEED_MS || (osSpeedMs !== null && osSpeedMs < GPS_CONFIG.MIN_MOVING_SPEED_MS))
  ) {
    return {
      isValid: true,
      isStationaryJitter: true,
      segmentSpeedKmh: 0,
      segmentDistanceMeters: 0,
      segmentTimeSeconds: timeDeltaSeconds,
    };
  }

  // 7. Contextual Accuracy & Velocity Continuity during poor GPS
  if (
    current.accuracy !== null &&
    current.accuracy > GPS_CONFIG.BASE_ACCURACY_THRESHOLD_METERS
  ) {
    const reportedSpeedKmh = (osSpeedMs ?? 0) * 3.6;
    const speedDifference = Math.abs(segmentSpeedKmh - reportedSpeedKmh);

    // If there is a massive discrepancy during poor accuracy, reject
    if (speedDifference > 60 && segmentSpeedKmh > 80) {
      return {
        isValid: false,
        reason: 'Inconsistent velocity during poor accuracy',
        segmentDistanceMeters: distanceMeters,
        segmentTimeSeconds: timeDeltaSeconds,
      };
    }
  }

  // 8. Authoritative Coordinate-Derived Speed for Accepted Movement
  const finalSpeedKmh = Math.min(segmentSpeedKmh, GPS_CONFIG.MAX_PLAUSIBLE_SPEED_KMH);

  // If final speed is below moving threshold and distance is tiny, mark stationary
  if (finalSpeedKmh < GPS_CONFIG.MIN_MOVING_SPEED_KMH && distanceMeters < GPS_CONFIG.MIN_STATIONARY_DISTANCE_METERS) {
    return {
      isValid: true,
      isStationaryJitter: true,
      segmentSpeedKmh: 0,
      segmentDistanceMeters: 0,
      segmentTimeSeconds: timeDeltaSeconds,
    };
  }

  return {
    isValid: true,
    isStationaryJitter: false,
    segmentSpeedKmh: Math.round(finalSpeedKmh * 10) / 10,
    segmentDistanceMeters: distanceMeters,
    segmentTimeSeconds: timeDeltaSeconds,
  };
}
