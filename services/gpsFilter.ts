import { Platform } from 'react-native';
import { RawGPSPoint } from '../types/ride';
import { calculateDistanceMeters } from './distance';

/**
 * Single centralized configuration object for all GPS filter thresholds.
 * Platform.select overrides for iOS and Android.
 */
export const GPS_FILTER_THRESHOLDS = {
  // Horizontal accuracy limits (meters)
  // iOS: 20m, Android: 25m. Fixes worse than this limit are DEMOTED. <= 0 or null are dropped.
  ACCURACY_DEMOTE_THRESHOLD_METERS: (Platform.select({ ios: 20, default: 25 }) ?? 25) as number,
  MIN_ACCURACY_METERS: 0,

  // Speed caps (m/s)
  // Real device in release builds: 70 m/s (~252 km/h) — rejects extreme teleport spikes
  MAX_SPEED_MS_DEVICE: (Platform.select({ ios: 70, default: 70 }) ?? 70) as number,
  // Test environments (mocked === true or __DEV__ === true): 120 m/s (~432 km/h)
  MAX_SPEED_MS_TEST: 120,

  // Stationary detection
  // Distance below max(new fix accuracy, 8m) with reported speed < 1 m/s (or unknown) means phone is still
  STATIONARY_RADIUS_METERS: (Platform.select({ ios: 8, default: 8 }) ?? 8) as number,
  STATIONARY_ENTER_SPEED_MS: (Platform.select({ ios: 1.0, default: 1.0 }) ?? 1.0) as number,

  // Hysteresis: leave still state if moved beyond radius, or speed > 2.0 m/s on 2 consecutive fixes
  STATIONARY_EXIT_SPEED_MS: (Platform.select({ ios: 2.0, default: 2.0 }) ?? 2.0) as number,
  STATIONARY_EXIT_CONSECUTIVE_FIXES: 2,

  // Speed smoothing: moving average over the last 3 accepted moving fixes
  SPEED_SMOOTHING_SAMPLES: 3,

  // First fix age limit (cached fix at ride start): 10 seconds
  MAX_FIRST_FIX_AGE_MS: 10000,

  // Minimum interval between distinct GPS points to reject sub-second duplicate/burst callbacks (ms)
  MIN_SAMPLE_INTERVAL_MS: 200,
};

// Backward-compatible alias for existing imports
export const GPS_FILTER_CONFIG = GPS_FILTER_THRESHOLDS;

export interface GPSValidationResult {
  isValid: boolean;
  reason?: string;
  isStationaryJitter?: boolean;
  /** Fix with accuracy worse than platform limit: valid in stream but contributes 0 distance, 0 speed, no track point */
  isDemoted?: boolean;
  /** Single authoritative segment speed derived from coordinates (km/h). */
  segmentSpeedKmh?: number;
  /** Haversine distance from previous point in meters. */
  segmentDistanceMeters?: number;
  /** Timestamp delta from previous point in seconds. */
  segmentTimeSeconds?: number;
  /** Raw coordinates distance in meters from previous accepted fix. */
  distanceFromLastAccepted?: number;
  /** Coordinate-derived speed in m/s. */
  derivedSpeedMs?: number;
  /** OS-reported speed in m/s, or null if unknown/negative. */
  reportedSpeedMs?: number | null;
  /** Hysteresis moving count state. */
  consecutiveMovingFixes?: number;
}

export interface GpsFilterOptions {
  /** Explicit override for test environment (used in unit tests) */
  isTestEnv?: boolean;
  /** Backward compat alias */
  isSimulator?: boolean;
  /** Current still state from tracking service */
  isCurrentlyStill?: boolean;
  /** Current count of consecutive fixes above stationary exit speed */
  consecutiveMovingFixes?: number;
  /** Wall-clock time reference for stale first fix check (defaults to Date.now()) */
  now?: number;
  /** Skip wall-clock stale check */
  skipStaleCheck?: boolean;
  /** Platform override for accuracy/speed limits in tests ('ios' | 'android') */
  platform?: 'ios' | 'android';
  /** Max accuracy limit override in meters */
  maxAccuracyMeters?: number;
}

/**
 * Pinned test environment detection:
 * - coords.mocked === true (Android mocked coordinates)
 * - __DEV__ === true (iOS Simulator and Android emulator dev builds)
 * Release builds on physical devices always evaluate to false, using the 70 m/s cap.
 */
export function isTestEnvironment(
  point?: RawGPSPoint | null,
  overrideIsTest?: boolean
): boolean {
  if (overrideIsTest !== undefined) {
    return overrideIsTest;
  }
  if (point?.mocked === true) {
    return true;
  }
  if (typeof __DEV__ !== 'undefined' && __DEV__ === true) {
    return true;
  }
  return false;
}

// Backward-compatible alias
export const isSimulatorOrMocked = isTestEnvironment;

/**
 * Contextual GPS filter that preserves legitimate motorcycle route points while
 * strictly suppressing stationary GPS drift on real devices (iOS/Android),
 * demoting poor-accuracy fixes, and rejecting teleport spikes, stale initial fixes, and burst duplicates.
 */
export function validateGPSPoint(
  current: RawGPSPoint,
  previous: RawGPSPoint | null,
  stationaryAnchor?: RawGPSPoint | null,
  options?: GpsFilterOptions
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

  // Null Island check (exact 0,0 indicates uninitialized GPS hardware)
  if (Math.abs(current.latitude) < 0.0001 && Math.abs(current.longitude) < 0.0001) {
    return { isValid: false, reason: 'Null Island (0,0) coordinate' };
  }

  // 2. Horizontal Accuracy Check
  // Reject fixes with null, undefined, or <= 0 accuracy (there is no position to trust at all)
  if (
    current.accuracy === null ||
    current.accuracy === undefined ||
    current.accuracy <= GPS_FILTER_THRESHOLDS.MIN_ACCURACY_METERS
  ) {
    return {
      isValid: false,
      reason: `Accuracy invalid (${current.accuracy ?? 'null'}m <= 0)`,
    };
  }

  // Demote threshold: iOS 20m, Android 25m (or explicit platform override)
  const accuracyDemoteThreshold =
    options?.maxAccuracyMeters ??
    (options?.platform === 'android'
      ? 25
      : options?.platform === 'ios'
      ? 20
      : GPS_FILTER_THRESHOLDS.ACCURACY_DEMOTE_THRESHOLD_METERS);
  const isDemoted = current.accuracy > accuracyDemoteThreshold;

  // 3. Stale First Fix Check
  // The age check applies ONLY when no fix has been accepted yet in the current ride (cached first fix case).
  // Every later fix is governed by the monotonic timestamp rule.
  if (!previous && !options?.skipStaleCheck) {
    const now = options?.now ?? Date.now();
    if (current.timestamp && now - current.timestamp > GPS_FILTER_THRESHOLDS.MAX_FIRST_FIX_AGE_MS) {
      return {
        isValid: false,
        reason: `Cached first fix older than 10s rejected (${Math.round((now - current.timestamp) / 1000)}s old)`,
      };
    }
  }

  // First point of a ride: accept baseline location
  if (!previous) {
    return {
      isValid: true,
      isStationaryJitter: true,
      isDemoted,
      segmentSpeedKmh: 0,
      segmentDistanceMeters: 0,
      segmentTimeSeconds: 0,
      distanceFromLastAccepted: 0,
      derivedSpeedMs: 0,
      reportedSpeedMs: current.speed !== null && current.speed >= 0 ? current.speed : null,
      consecutiveMovingFixes: 0,
      reason: isDemoted ? `First fix demoted due to accuracy > ${accuracyDemoteThreshold}m` : undefined,
    };
  }

  // 4. Monotonic Timestamp Validation (reject duplicate timestamps, backward order, and burst callbacks)
  const timeDeltaMs = current.timestamp - previous.timestamp;
  if (timeDeltaMs <= 0) {
    return { isValid: false, reason: 'Duplicate or backward timestamp' };
  }

  if (timeDeltaMs < GPS_FILTER_THRESHOLDS.MIN_SAMPLE_INTERVAL_MS) {
    return {
      isValid: false,
      reason: `Rapid duplicate/burst sample (< ${GPS_FILTER_THRESHOLDS.MIN_SAMPLE_INTERVAL_MS}ms)`,
    };
  }

  const timeDeltaSeconds = timeDeltaMs / 1000;
  const distanceMeters = calculateDistanceMeters(
    { latitude: previous.latitude, longitude: previous.longitude },
    { latitude: current.latitude, longitude: current.longitude }
  );

  // 5. Speed Derivation & Unknown Speed Handling
  // Coords.speed < 0 (iOS uses -1 for unknown) is treated as unknown (null).
  const reportedSpeedMs =
    current.speed !== null && current.speed !== undefined && current.speed >= 0
      ? current.speed
      : null;

  const derivedSpeedMs = timeDeltaSeconds > 0 ? distanceMeters / timeDeltaSeconds : 0;
  const segmentSpeedKmh = derivedSpeedMs * 3.6;

  // 6. Spike Guard
  // The cap is 70 m/s (~252 km/h) on real devices in release builds.
  // Raised to 120 m/s (~432 km/h) ONLY in test environments (coords.mocked === true or __DEV__ === true).
  const isTest = isTestEnvironment(current, options?.isTestEnv ?? options?.isSimulator);
  const speedCapMs = isTest
    ? GPS_FILTER_THRESHOLDS.MAX_SPEED_MS_TEST
    : GPS_FILTER_THRESHOLDS.MAX_SPEED_MS_DEVICE;

  const currentAcc = current.accuracy ?? 10;
  const prevAcc = previous.accuracy ?? 10;
  const maxAllowedJumpMeters = speedCapMs * timeDeltaSeconds + currentAcc + prevAcc;

  if (derivedSpeedMs > speedCapMs || distanceMeters > maxAllowedJumpMeters) {
    return {
      isValid: false,
      reason: `Impossible speed / spike jump rejected (${Math.round(distanceMeters)}m in ${timeDeltaSeconds.toFixed(
        1
      )}s, ${Math.round(segmentSpeedKmh)} km/h > cap ${Math.round(speedCapMs * 3.6)} km/h)`,
      segmentDistanceMeters: distanceMeters,
      segmentTimeSeconds: timeDeltaSeconds,
      distanceFromLastAccepted: distanceMeters,
      derivedSpeedMs,
      reportedSpeedMs,
    };
  }

  // 7. Demoted Poor-Accuracy Fixes (iOS > 20m, Android > 25m)
  // Demoted fixes contribute NO distance, NO track point, NO top speed, and NEVER move the stationary anchor.
  if (isDemoted) {
    return {
      isValid: true,
      isDemoted: true,
      isStationaryJitter: false,
      segmentSpeedKmh: 0,
      segmentDistanceMeters: 0,
      segmentTimeSeconds: timeDeltaSeconds,
      distanceFromLastAccepted: distanceMeters,
      derivedSpeedMs,
      reportedSpeedMs,
      consecutiveMovingFixes: options?.consecutiveMovingFixes ?? 0,
      reason: `Accuracy poor (${current.accuracy?.toFixed(1)}m > ${accuracyDemoteThreshold}m) - demoted`,
    };
  }

  // 8. Stationary Detection & Hysteresis
  // Effective stationary radius: max(new fix accuracy, 8 m)
  const effectiveRadius = Math.max(
    current.accuracy ?? GPS_FILTER_THRESHOLDS.STATIONARY_RADIUS_METERS,
    GPS_FILTER_THRESHOLDS.STATIONARY_RADIUS_METERS
  );

  // Measure displacement against stationary anchor if available, otherwise previous accepted fix
  const anchor = stationaryAnchor || previous;
  const distanceToAnchor = calculateDistanceMeters(
    { latitude: anchor.latitude, longitude: anchor.longitude },
    { latitude: current.latitude, longitude: current.longitude }
  );

  const isCurrentlyStill =
    options?.isCurrentlyStill ??
    (stationaryAnchor !== null && stationaryAnchor !== undefined);
  const prevConsecutiveMoving = options?.consecutiveMovingFixes ?? 0;

  // Speed evaluated for moving vs still
  const effectiveSpeedMs = reportedSpeedMs !== null ? reportedSpeedMs : derivedSpeedMs;
  const isSpeedAboveExitThreshold =
    effectiveSpeedMs > GPS_FILTER_THRESHOLDS.STATIONARY_EXIT_SPEED_MS;
  const currentConsecutiveMoving = isSpeedAboveExitThreshold
    ? prevConsecutiveMoving + 1
    : 0;

  if (isCurrentlyStill) {
    // In still state: Hysteresis exit check
    // Leave still state ONLY after moving beyond the radius, OR after speed above ~2 m/s on 2 consecutive fixes
    const hasMovedBeyondRadius = distanceToAnchor >= effectiveRadius;
    const hasConsecutiveSpeedExit =
      currentConsecutiveMoving >= GPS_FILTER_THRESHOLDS.STATIONARY_EXIT_CONSECUTIVE_FIXES;

    if (!hasMovedBeyondRadius && !hasConsecutiveSpeedExit) {
      // Remain still: add NO distance, add NO track point, do NOT update top speed
      return {
        isValid: true,
        isStationaryJitter: true,
        isDemoted: false,
        segmentSpeedKmh: 0,
        segmentDistanceMeters: 0,
        segmentTimeSeconds: timeDeltaSeconds,
        distanceFromLastAccepted: distanceMeters,
        derivedSpeedMs,
        reportedSpeedMs,
        consecutiveMovingFixes: currentConsecutiveMoving,
      };
    }
    // Exited still state
  } else {
    // Currently moving: Check if entering still state
    // If distance to anchor/last accepted fix is less than max(accuracy, 8m) AND reported speed is under ~1 m/s (or unknown/derived < 1m/s)
    const isReportedSlowOrUnknown =
      reportedSpeedMs === null ||
      reportedSpeedMs < GPS_FILTER_THRESHOLDS.STATIONARY_ENTER_SPEED_MS;
    const isDerivedSlow = derivedSpeedMs < GPS_FILTER_THRESHOLDS.STATIONARY_ENTER_SPEED_MS;

    if (
      distanceToAnchor < effectiveRadius &&
      (isReportedSlowOrUnknown || isDerivedSlow)
    ) {
      // Enter still state
      return {
        isValid: true,
        isStationaryJitter: true,
        isDemoted: false,
        segmentSpeedKmh: 0,
        segmentDistanceMeters: 0,
        segmentTimeSeconds: timeDeltaSeconds,
        distanceFromLastAccepted: distanceMeters,
        derivedSpeedMs,
        reportedSpeedMs,
        consecutiveMovingFixes: 0,
      };
    }
  }

  // 9. Genuine Movement Fix Accepted
  return {
    isValid: true,
    isStationaryJitter: false,
    isDemoted: false,
    segmentSpeedKmh: Math.round(segmentSpeedKmh * 10) / 10,
    segmentDistanceMeters: distanceMeters,
    segmentTimeSeconds: timeDeltaSeconds,
    distanceFromLastAccepted: distanceMeters,
    derivedSpeedMs,
    reportedSpeedMs,
    consecutiveMovingFixes: isSpeedAboveExitThreshold
      ? prevConsecutiveMoving + 1
      : 0,
  };
}
