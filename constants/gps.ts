/**
 * Centralized GPS parameters and thresholds for Rideoxy
 * Designed to preserve real motorcycle ride telemetry while filtering out spikes and stale fixes.
 */

export const GPS_CONFIG = {
  // Accuracy limits (meters)
  // Base threshold for high accuracy
  BASE_ACCURACY_THRESHOLD_METERS: 35,
  // Hard upper limit beyond which coordinate is severely unreliable
  MAX_ACCEPTABLE_ACCURACY_METERS: 75,

  // Speed limits (km/h)
  // Extreme speed check for motorcycle jump rejection
  MAX_PLAUSIBLE_SPEED_KMH: 260,
  // Minimum speed threshold to count as "moving" for moving_time calculations (approx 2.5 km/h = 0.7 m/s)
  MIN_MOVING_SPEED_KMH: 2.5,
  MIN_MOVING_SPEED_MS: 0.7,

  // Distance limits (meters)
  // Distance below which movement is treated as stationary if point-to-point delta is negligible
  MIN_STATIONARY_DISTANCE_METERS: 2.0,
  // Maximum plausible distance jump in 1 second for motorcycle (260 km/h = ~72 m/s)
  MAX_PLAUSIBLE_METERS_PER_SECOND: 75,

  // Hardware polling frequencies
  TRACKING_TIME_INTERVAL_MS: 1000, // 1 second
  TRACKING_DISTANCE_INTERVAL_METERS: 0, // 0 meters ensures continuous time-based updates even when stopping/slowing down

  // UI Throttle: update map and HUD every 500ms minimum
  UI_THROTTLE_INTERVAL_MS: 500,
  MAP_THROTTLE_INTERVAL_MS: 1000,

  // Inactivity / Stale timeouts (ms)
  // If no fresh GPS fix is received within 2.0s, current speed decays to 0 km/h immediately
  GPS_STALE_TIMEOUT_MS: 2000,
  // Maximum acceptable age of an incoming GPS fix compared to wall-clock time
  GPS_MAX_FIX_AGE_MS: 4000,
  // Inactivity timeout before marking GPS signal as searching
  GPS_SIGNAL_TIMEOUT_MS: 4000,

  // Notification for Android background service
  BACKGROUND_NOTIFICATION_TITLE: 'Rideoxy Active Ride',
  BACKGROUND_NOTIFICATION_BODY: 'Recording motorcycle telemetry in background...',
};
