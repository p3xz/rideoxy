/**
 * Centralized GPS parameters and thresholds for Rideoxy
 * Designed to preserve real motorcycle ride telemetry while filtering out spikes,
 * stationary drift on real devices (iOS/Android), and stale fixes.
 */
import { GPS_FILTER_THRESHOLDS } from '../services/gpsFilter';

export const GPS_FILTER_CONFIG = GPS_FILTER_THRESHOLDS;

export const GPS_CONFIG = {
  // Accuracy limits (meters)
  BASE_ACCURACY_THRESHOLD_METERS: 25,
  MAX_ACCEPTABLE_ACCURACY_METERS: GPS_FILTER_THRESHOLDS.ACCURACY_DEMOTE_THRESHOLD_METERS,

  // Speed limits (km/h)
  MAX_PLAUSIBLE_SPEED_KMH: GPS_FILTER_THRESHOLDS.MAX_SPEED_MS_DEVICE * 3.6,
  MIN_MOVING_SPEED_KMH: 2.5,
  MIN_MOVING_SPEED_MS: GPS_FILTER_THRESHOLDS.STATIONARY_ENTER_SPEED_MS,

  // Distance limits (meters)
  MIN_STATIONARY_DISTANCE_METERS: GPS_FILTER_THRESHOLDS.STATIONARY_RADIUS_METERS,
  MAX_PLAUSIBLE_METERS_PER_SECOND: GPS_FILTER_THRESHOLDS.MAX_SPEED_MS_DEVICE,

  // Hardware polling frequencies
  TRACKING_TIME_INTERVAL_MS: 1000, // 1 second
  TRACKING_DISTANCE_INTERVAL_METERS: 5, // ~5 meters to prevent tiny jitter polling

  // Minimum interval between distinct GPS points to reject sub-second duplicate/burst callbacks (ms)
  MIN_SAMPLE_INTERVAL_MS: GPS_FILTER_THRESHOLDS.MIN_SAMPLE_INTERVAL_MS,

  // UI Throttle: update map and HUD every 500ms minimum
  UI_THROTTLE_INTERVAL_MS: 500,
  MAP_THROTTLE_INTERVAL_MS: 1000,

  // Inactivity / Stale timeouts (ms)
  GPS_STALE_TIMEOUT_MS: 2000,
  GPS_MAX_FIRST_FIX_AGE_MS: GPS_FILTER_THRESHOLDS.MAX_FIRST_FIX_AGE_MS,
  GPS_SIGNAL_TIMEOUT_MS: 4000,

  // Notification for Android background service
  BACKGROUND_NOTIFICATION_TITLE: 'Rideoxy Active Ride',
  BACKGROUND_NOTIFICATION_BODY: 'Recording motorcycle telemetry in background...',
};
