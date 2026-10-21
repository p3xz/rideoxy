import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { RawGPSPoint } from '../types/ride';
import { GPS_FILTER_CONFIG, GPS_CONFIG } from '../constants/gps';
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
  /** Explicit override for simulator detection (used in unit tests) */
  isSimulator?: boolean;
  /** Current still state from tracking service */
  isCurrentlyStill?: boolean;
  /** Current count of consecutive fixes above stationary exit speed */
  consecutiveMovingFixes?: number;
  /** Wall-clock time reference for stale age check (defaults to Date.now()) */
  now?: number;
  /** Skip wall-clock stale check (useful for synthetic batch replays) */
  skipStaleCheck?: boolean;
  /** Platform override for accuracy/speed limits in tests */
  platform?: 'ios' | 'android';
  /** Max accuracy limit override in meters */
  maxAccuracyMeters?: number;
}

/**
 * Detects if the current environment is an emulator/simulator or feeding mocked locations.
 */
export function isSimulatorOrMocked(
  point?: RawGPSPoint | null,
  overrideIsSimulator?: boolean
): boolean {
  if (overrideIsSimulator !== undefined) {
    return overrideIsSimulator;
  }
  if (point?.mocked === true) {
    return true;
  }

  // Android emulator signatures
  if (Platform.OS === 'android') {
    const brand = String((Platform.constants as any)?.Brand ?? '').toLowerCase();
    const model = String((Platform.constants as any)?.Model ?? '').toLowerCase();
    const fingerprint = String((Platform.constants as any)?.Fingerprint ?? '').toLowerCase();
    const manufacturer = String((Platform.constants as any)?.Manufacturer ?? '').toLowerCase();

    if (
      brand.includes('generic') ||
      (brand.includes('google') && model.includes('sdk')) ||
      model.includes('emulator') ||
      model.includes('simulator') ||
      model.includes('sdk_gphone') ||
      fingerprint.includes('generic') ||
      fingerprint.includes('vbox') ||
      manufacturer.includes('genymotion')
    ) {
      return true;
    }
  }

  // iOS Simulator signatures
  if (Platform.OS === 'ios') {
    const deviceName = String(Constants.deviceName ?? '').toLowerCase();
    if (deviceName.includes('simulator') || deviceName.includes('emulator')) {
      return true;
    }
  }

  return false;
}

/**
 * Contextual GPS filter that preserves legitimate motorcycle route points while
 * strictly suppressing stationary GPS drift on real devices (iOS/Android),
 * rejecting teleport spikes, stale fixes, invalid accuracy, and burst duplicates.
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

  // 2. Accuracy Rejection
  // Reject fixes with null, undefined, <= 0 horizontal accuracy, or accuracy worse than tuned limit
  // (20m on iOS, 25m on Android)
  const maxAccuracy =
    options?.maxAccuracyMeters ??
    (options?.platform === 'android'
      ? 25
      : options?.platform === 'ios'
      ? 20
      : GPS_FILTER_CONFIG.MAX_ACCEPTABLE_ACCURACY_METERS);

  if (
    current.accuracy === null ||
    current.accuracy === undefined ||
    current.accuracy <= GPS_FILTER_CONFIG.MIN_ACCEPTABLE_ACCURACY_METERS ||
    current.accuracy > maxAccuracy
  ) {
    return {
      isValid: false,
      reason: `Accuracy invalid or too poor (${current.accuracy ?? 'null'}m > ${maxAccuracy}m)`,
    };
  }

  // 3. Stale Fix Check (compared to wall-clock time)
  if (!options?.skipStaleCheck) {
    const now = options?.now ?? Date.now();
    if (current.timestamp && now - current.timestamp > GPS_FILTER_CONFIG.MAX_FIX_AGE_MS) {
      return {
        isValid: false,
        reason: `Stale GPS fix (${Math.round((now - current.timestamp) / 1000)}s old)`,
      };
    }
  }

  // First point of a ride: accept baseline location, zero movement/speed
  if (!previous) {
    return {
      isValid: true,
      isStationaryJitter: true,
      segmentSpeedKmh: 0,
      segmentDistanceMeters: 0,
      segmentTimeSeconds: 0,
      distanceFromLastAccepted: 0,
      derivedSpeedMs: 0,
      reportedSpeedMs: current.speed !== null && current.speed >= 0 ? current.speed : null,
      consecutiveMovingFixes: 0,
    };
  }

  // 4. Timestamp Validation (reject duplicate timestamps, backward order, and burst callbacks)
  const timeDeltaMs = current.timestamp - previous.timestamp;
  if (timeDeltaMs <= 0) {
    return { isValid: false, reason: 'Duplicate or backward timestamp' };
  }

  if (timeDeltaMs < GPS_FILTER_CONFIG.MIN_SAMPLE_INTERVAL_MS) {
    return {
      isValid: false,
      reason: `Rapid duplicate/burst sample (< ${GPS_FILTER_CONFIG.MIN_SAMPLE_INTERVAL_MS}ms)`,
    };
  }

  const timeDeltaSeconds = timeDeltaMs / 1000;
  const distanceMeters = calculateDistanceMeters(
    { latitude: previous.latitude, longitude: previous.longitude },
    { latitude: current.latitude, longitude: current.longitude }
  );

  // 5. Speed Derivation & Unknown Speed Handling
  // Coords.speed < 0 (iOS uses -1 for unknown speed) is treated as unknown (null).
  const reportedSpeedMs =
    current.speed !== null && current.speed !== undefined && current.speed >= 0
      ? current.speed
      : null;

  const derivedSpeedMs = timeDeltaSeconds > 0 ? distanceMeters / timeDeltaSeconds : 0;
  const segmentSpeedKmh = derivedSpeedMs * 3.6;

  // 6. Spike Guard
  // The cap is 70 m/s (~252 km/h) on real devices.
  // Raised to 120 m/s (~432 km/h) on emulator/simulator or when coords.mocked === true,
  // allowing emulator route playback (e.g. 259 km/h = 71.9 m/s) without rejection.
  const isSim = isSimulatorOrMocked(current, options?.isSimulator);
  const speedCapMs = isSim
    ? GPS_FILTER_CONFIG.MAX_SPEED_MS_EMULATOR
    : GPS_FILTER_CONFIG.MAX_SPEED_MS_DEVICE;

  const currentAcc = current.accuracy ?? 10;
  const prevAcc = previous.accuracy ?? 10;
  // Jump is allowed up to cap * dt + accuracy uncertainties
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

  // 7. Stationary Detection & Hysteresis
  // Effective stationary radius: max(new fix accuracy, 8 m)
  const effectiveRadius = Math.max(
    current.accuracy ?? GPS_FILTER_CONFIG.STATIONARY_RADIUS_METERS,
    GPS_FILTER_CONFIG.STATIONARY_RADIUS_METERS
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
    effectiveSpeedMs > GPS_FILTER_CONFIG.STATIONARY_EXIT_SPEED_MS;
  const currentConsecutiveMoving = isSpeedAboveExitThreshold
    ? prevConsecutiveMoving + 1
    : 0;

  if (isCurrentlyStill) {
    // In still state: Hysteresis exit check
    // Leave still state ONLY after moving beyond the radius, OR after speed above ~2 m/s on 2 consecutive fixes
    const hasMovedBeyondRadius = distanceToAnchor >= effectiveRadius;
    const hasConsecutiveSpeedExit =
      currentConsecutiveMoving >= GPS_FILTER_CONFIG.STATIONARY_EXIT_CONSECUTIVE_FIXES;

    if (!hasMovedBeyondRadius && !hasConsecutiveSpeedExit) {
      // Remain still: add NO distance, add NO route point, do NOT update top speed
      return {
        isValid: true,
        isStationaryJitter: true,
        segmentSpeedKmh: 0,
        segmentDistanceMeters: 0,
        segmentTimeSeconds: timeDeltaSeconds,
        distanceFromLastAccepted: distanceMeters,
        derivedSpeedMs,
        reportedSpeedMs,
        consecutiveMovingFixes: currentConsecutiveMoving,
      };
    }
    // Exited still state!
  } else {
    // Currently moving: Check if entering still state
    // If distance to last accepted fix is less than max(accuracy, 8m) AND reported speed is under ~1 m/s (or unknown)
    const isReportedSlowOrUnknown =
      reportedSpeedMs === null ||
      reportedSpeedMs < GPS_FILTER_CONFIG.STATIONARY_ENTER_SPEED_MS;
    const isDerivedSlow = derivedSpeedMs < GPS_FILTER_CONFIG.STATIONARY_ENTER_SPEED_MS;

    if (
      distanceToAnchor < effectiveRadius &&
      (isReportedSlowOrUnknown || isDerivedSlow)
    ) {
      // Enter still state!
      return {
        isValid: true,
        isStationaryJitter: true,
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

  // 8. Genuine Movement Fix Accepted
  return {
    isValid: true,
    isStationaryJitter: false,
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
