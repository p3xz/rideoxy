/**
 * Centralized GPS parameters and thresholds for Rideoxy
 * Designed to preserve real motorcycle ride telemetry while filtering out spikes,
 * stationary drift on real devices (iOS/Android), and stale fixes.
 */
import { Platform } from 'react-native';

export const GPS_FILTER_CONFIG = {
  // Accuracy limits (meters)
  // Stricter on iOS (20m) where CoreLocation provides clean fixes when precise, 25m on Android
  MAX_ACCEPTABLE_ACCURACY_METERS: (Platform.select({ ios: 20, default: 25 }) ?? 25) as number,
  MIN_ACCEPTABLE_ACCURACY_METERS: 0, // Accuracy must be strictly > 0

  // Speed caps (m/s)
  // Real device: 70 m/s (~252 km/h) — rejects extreme teleport spikes
  MAX_SPEED_MS_DEVICE: (Platform.select({ ios: 70, default: 70 }) ?? 70) as number,
  // Emulator/simulator or mocked coordinates: 120 m/s (~432 km/h) — allows 259 km/h emulator playback
  MAX_SPEED_MS_EMULATOR: 120,

  // Stationary detection
  // Distance below max(accuracy, 8m) with reported speed < 1 m/s (or unknown) means phone is still
  STATIONARY_RADIUS_METERS: (Platform.select({ ios: 8, default: 8 }) ?? 8) as number,
  STATIONARY_ENTER_SPEED_MS: (Platform.select({ ios: 1.0, default: 1.0 }) ?? 1.0) as number,
  // Hysteresis: leave still state if moved beyond radius, or speed > 2.0 m/s on 2 consecutive fixes
  STATIONARY_EXIT_SPEED_MS: (Platform.select({ ios: 2.0, default: 2.0 }) ?? 2.0) as number,
  STATIONARY_EXIT_CONSECUTIVE_FIXES: 2,

  // Speed smoothing: moving average over the last 3 accepted moving fixes
  SPEED_SMOOTHING_SAMPLES: 3,

  // Stale age and burst rate limits
  MAX_FIX_AGE_MS: 4000, // 4 seconds max fix age
  MIN_SAMPLE_INTERVAL_MS: 200, // Reject sub-200ms bursts
};

export const GPS_CONFIG = {
  // Accuracy limits (meters)
  BASE_ACCURACY_THRESHOLD_METERS: 25,
  MAX_ACCEPTABLE_ACCURACY_METERS: GPS_FILTER_CONFIG.MAX_ACCEPTABLE_ACCURACY_METERS,

  // Speed limits (km/h)
  MAX_PLAUSIBLE_SPEED_KMH: GPS_FILTER_CONFIG.MAX_SPEED_MS_DEVICE * 3.6,
  MIN_MOVING_SPEED_KMH: 2.5,
  MIN_MOVING_SPEED_MS: GPS_FILTER_CONFIG.STATIONARY_ENTER_SPEED_MS,

  // Distance limits (meters)
  MIN_STATIONARY_DISTANCE_METERS: GPS_FILTER_CONFIG.STATIONARY_RADIUS_METERS,
  MAX_PLAUSIBLE_METERS_PER_SECOND: GPS_FILTER_CONFIG.MAX_SPEED_MS_DEVICE,

  // Hardware polling frequencies
  TRACKING_TIME_INTERVAL_MS: 1000, // 1 second
  TRACKING_DISTANCE_INTERVAL_METERS: 5, // ~5 meters to prevent tiny jitter polling

  // Minimum interval between distinct GPS points to reject sub-second duplicate/burst callbacks (ms)
  MIN_SAMPLE_INTERVAL_MS: GPS_FILTER_CONFIG.MIN_SAMPLE_INTERVAL_MS,

  // UI Throttle: update map and HUD every 500ms minimum
  UI_THROTTLE_INTERVAL_MS: 500,
  MAP_THROTTLE_INTERVAL_MS: 1000,

  // Inactivity / Stale timeouts (ms)
  GPS_STALE_TIMEOUT_MS: 2000,
  GPS_MAX_FIX_AGE_MS: GPS_FILTER_CONFIG.MAX_FIX_AGE_MS,
  GPS_SIGNAL_TIMEOUT_MS: 4000,

  // Notification for Android background service
  BACKGROUND_NOTIFICATION_TITLE: 'Rideoxy Active Ride',
  BACKGROUND_NOTIFICATION_BODY: 'Recording motorcycle telemetry in background...',
};
