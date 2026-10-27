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

  // Generic IMU motion detection thresholds (expo-sensors Accelerometer & Gyroscope)
  IMU_ACCEL_STATIONARY_THRESHOLD_G: 0.04,
  IMU_GYRO_STATIONARY_THRESHOLD_RAD_S: 0.08,
  IMU_SAMPLE_WINDOW_MS: 3000,
  IMU_MAX_STATIONARY_DRIFT_METERS: 50,

  // On-device 2D Kalman filter parameters
  KALMAN_PROCESS_NOISE_MS: 4.5,
  KALMAN_ACCURACY_FLOOR_METERS: 4,
};

// Backward-compatible alias for existing imports
export const GPS_FILTER_CONFIG = GPS_FILTER_THRESHOLDS;

export interface ImuSample {
  x: number;
  y: number;
  z: number;
  timestamp?: number;
}

/**
 * Generic on-device IMU motion detector using phone accelerometer and gyroscope readings.
 * Confirms whether the device is physically stationary vs moving to prevent stationary GPS hallucination.
 */
export class ImuMotionDetector {
  private accelSamples: { x: number; y: number; z: number; receivedAt: number }[] = [];
  private gyroSamples: { x: number; y: number; z: number; receivedAt: number }[] = [];
  private readonly windowMs: number;

  constructor(windowMs: number = GPS_FILTER_THRESHOLDS.IMU_SAMPLE_WINDOW_MS) {
    this.windowMs = windowMs;
  }

  public addAccelerometerSample(sample: ImuSample, nowMs: number = Date.now()): void {
    if (
      typeof sample.x !== 'number' ||
      typeof sample.y !== 'number' ||
      typeof sample.z !== 'number' ||
      isNaN(sample.x) ||
      isNaN(sample.y) ||
      isNaN(sample.z)
    ) {
      return;
    }
    this.accelSamples.push({ x: sample.x, y: sample.y, z: sample.z, receivedAt: nowMs });
    this.prune(nowMs);
  }

  public addGyroscopeSample(sample: ImuSample, nowMs: number = Date.now()): void {
    if (
      typeof sample.x !== 'number' ||
      typeof sample.y !== 'number' ||
      typeof sample.z !== 'number' ||
      isNaN(sample.x) ||
      isNaN(sample.y) ||
      isNaN(sample.z)
    ) {
      return;
    }
    this.gyroSamples.push({ x: sample.x, y: sample.y, z: sample.z, receivedAt: nowMs });
    this.prune(nowMs);
  }

  private prune(nowMs: number): void {
    const cutoff = nowMs - this.windowMs;
    while (this.accelSamples.length > 0 && this.accelSamples[0].receivedAt < cutoff) {
      this.accelSamples.shift();
    }
    while (this.gyroSamples.length > 0 && this.gyroSamples[0].receivedAt < cutoff) {
      this.gyroSamples.shift();
    }
  }

  /**
   * Returns true if IMU sensors confirm the device is physically stationary,
   * false if physical motion/vibration is detected, or undefined if no recent IMU data is available.
   */
  public isStationary(nowMs: number = Date.now()): boolean | undefined {
    this.prune(nowMs);

    const hasAccel = this.accelSamples.length > 0;
    const hasGyro = this.gyroSamples.length > 0;

    if (!hasAccel && !hasGyro) {
      return undefined;
    }

    let accelStill = true;
    if (hasAccel) {
      const n = this.accelSamples.length;
      let sumX = 0;
      let sumY = 0;
      let sumZ = 0;
      let maxMagDeviation = 0;

      for (const s of this.accelSamples) {
        sumX += s.x;
        sumY += s.y;
        sumZ += s.z;
        const mag = Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z);
        const dev = Math.abs(mag - 1.0);
        if (dev > maxMagDeviation) {
          maxMagDeviation = dev;
        }
      }

      const meanX = sumX / n;
      const meanY = sumY / n;
      const meanZ = sumZ / n;

      let varianceSum = 0;
      for (const s of this.accelSamples) {
        const dx = s.x - meanX;
        const dy = s.y - meanY;
        const dz = s.z - meanZ;
        varianceSum += dx * dx + dy * dy + dz * dz;
      }
      const rmsDeviationG = Math.sqrt(varianceSum / n);

      accelStill =
        rmsDeviationG < GPS_FILTER_THRESHOLDS.IMU_ACCEL_STATIONARY_THRESHOLD_G &&
        maxMagDeviation < 0.12;
    }

    let gyroStill = true;
    if (hasGyro) {
      const m = this.gyroSamples.length;
      let sumSq = 0;
      for (const g of this.gyroSamples) {
        sumSq += g.x * g.x + g.y * g.y + g.z * g.z;
      }
      const rmsOmega = Math.sqrt(sumSq / m);
      gyroStill = rmsOmega < GPS_FILTER_THRESHOLDS.IMU_GYRO_STATIONARY_THRESHOLD_RAD_S;
    }

    return accelStill && gyroStill;
  }

  public reset(): void {
    this.accelSamples = [];
    this.gyroSamples = [];
  }
}

/**
 * Lightweight on-device 2D Kalman filter for GPS latitude and longitude smoothing.
 * Reduces urban multipath jitter without network calls or external dependencies.
 */
export class GpsKalmanFilter {
  private lat: number = 0;
  private lng: number = 0;
  private variance: number = -1; // < 0 means uninitialized
  private timestamp: number = 0;
  private readonly processNoiseMs: number;
  private readonly accuracyFloorMeters: number;

  constructor(
    processNoiseMs: number = GPS_FILTER_THRESHOLDS.KALMAN_PROCESS_NOISE_MS,
    accuracyFloorMeters: number = GPS_FILTER_THRESHOLDS.KALMAN_ACCURACY_FLOOR_METERS
  ) {
    this.processNoiseMs = processNoiseMs;
    this.accuracyFloorMeters = accuracyFloorMeters;
  }

  public isInitialized(): boolean {
    return this.variance >= 0;
  }

  public reset(anchorPoint?: RawGPSPoint | null): void {
    if (anchorPoint) {
      const effAcc = Math.max((anchorPoint.accuracy ?? 10) - this.accuracyFloorMeters, 1);
      this.lat = anchorPoint.latitude;
      this.lng = anchorPoint.longitude;
      this.variance = effAcc * effAcc;
      this.timestamp = anchorPoint.timestamp;
    } else {
      this.lat = 0;
      this.lng = 0;
      this.variance = -1;
      this.timestamp = 0;
    }
  }

  public process(point: RawGPSPoint): RawGPSPoint {
    const effAcc = Math.max((point.accuracy ?? 10) - this.accuracyFloorMeters, 1);
    const measurementVariance = effAcc * effAcc;

    if (this.variance < 0) {
      this.lat = point.latitude;
      this.lng = point.longitude;
      this.variance = measurementVariance;
      this.timestamp = point.timestamp;
      return { ...point };
    }

    const dtSeconds = (point.timestamp - this.timestamp) / 1000;
    if (dtSeconds > 0) {
      const processStepSigma = this.processNoiseMs * dtSeconds;
      this.variance += processStepSigma * processStepSigma;
      this.timestamp = point.timestamp;
    }

    const kalmanGain = this.variance / (this.variance + measurementVariance);
    this.lat = this.lat + kalmanGain * (point.latitude - this.lat);
    this.lng = this.lng + kalmanGain * (point.longitude - this.lng);
    this.variance = (1 - kalmanGain) * this.variance;

    return {
      ...point,
      latitude: this.lat,
      longitude: this.lng,
    };
  }
}

/**
 * Convenience helper to apply on-device Kalman smoothing across a sequence of GPS points.
 */
export function smoothGPSTrace(
  points: RawGPSPoint[],
  processNoiseMs?: number
): RawGPSPoint[] {
  const filter = new GpsKalmanFilter(processNoiseMs);
  return points.map((pt) => filter.process(pt));
}

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
  /** Kalman-smoothed GPS fix when moving and kalmanFilter is provided. */
  smoothedPoint?: RawGPSPoint;
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
  /** Whether on-device IMU (accelerometer + gyroscope) confirms the device is physically stationary */
  imuIsStationary?: boolean;
  /** Optional Kalman filter instance to smooth accepted moving fixes */
  kalmanFilter?: GpsKalmanFilter;
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

  // 8. Stationary Detection & Hysteresis (strengthened with IMU motion confirmation)
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

  // If on-device IMU (accelerometer + gyroscope) confirms the phone is physically stationary,
  // suppress GPS wandering / stationary hallucination within multipath drift bounds.
  if (
    options?.imuIsStationary === true &&
    distanceToAnchor < GPS_FILTER_THRESHOLDS.IMU_MAX_STATIONARY_DRIFT_METERS
  ) {
    if (options.kalmanFilter) {
      options.kalmanFilter.reset(anchor);
    }
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
      if (options?.kalmanFilter) {
        options.kalmanFilter.reset(anchor);
      }
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
      if (options?.kalmanFilter) {
        options.kalmanFilter.reset(anchor);
      }
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

  // 9. Genuine Movement Fix Accepted (apply Kalman smoothing if filter provided)
  let finalDistanceMeters = distanceMeters;
  let finalDerivedSpeedMs = derivedSpeedMs;
  let finalSegmentSpeedKmh = Math.round(segmentSpeedKmh * 10) / 10;
  let smoothedPoint: RawGPSPoint | undefined;

  if (options?.kalmanFilter) {
    if (!options.kalmanFilter.isInitialized()) {
      options.kalmanFilter.reset(previous);
    }
    smoothedPoint = options.kalmanFilter.process(current);
    finalDistanceMeters = calculateDistanceMeters(
      { latitude: previous.latitude, longitude: previous.longitude },
      { latitude: smoothedPoint.latitude, longitude: smoothedPoint.longitude }
    );
    finalDerivedSpeedMs = timeDeltaSeconds > 0 ? finalDistanceMeters / timeDeltaSeconds : 0;
    finalSegmentSpeedKmh = Math.round(finalDerivedSpeedMs * 3.6 * 10) / 10;
  }

  return {
    isValid: true,
    isStationaryJitter: false,
    isDemoted: false,
    segmentSpeedKmh: finalSegmentSpeedKmh,
    segmentDistanceMeters: finalDistanceMeters,
    segmentTimeSeconds: timeDeltaSeconds,
    distanceFromLastAccepted: distanceMeters,
    derivedSpeedMs: finalDerivedSpeedMs,
    reportedSpeedMs,
    consecutiveMovingFixes: isSpeedAboveExitThreshold
      ? prevConsecutiveMoving + 1
      : 0,
    smoothedPoint,
  };
}
