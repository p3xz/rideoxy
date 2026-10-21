import * as Location from 'expo-location';
import { BACKGROUND_LOCATION_TASK, registerLocationUpdateCallback } from '../tasks/locationTask';
import { GPS_CONFIG } from '../constants/gps';
import { Colors } from '../constants/theme';
import { RawGPSPoint } from '../types/ride';

export interface LocationPermissionStatus {
  foregroundGranted: boolean;
  backgroundGranted: boolean;
  canTrack: boolean;
  isReducedAccuracy?: boolean;
}

export type GpsModalMode = 'explainer' | 'denied' | 'reduced_accuracy';

export interface GpsExplainerRequest {
  mode: GpsModalMode;
  resolve: (proceed: boolean) => void;
}

let explainerHandler: ((req: GpsExplainerRequest) => void) | null = null;

export function registerGpsExplainerHandler(handler: ((req: GpsExplainerRequest) => void) | null) {
  explainerHandler = handler;
}

export function isReducedAccuracyResponse(response: any): boolean {
  if (!response) return false;
  return (
    response.accuracy === 'reduced' ||
    response.accuracy === 'coarse' ||
    response.ios?.accuracy === 'reduced' ||
    response.ios?.accuracy === 'coarse' ||
    response.android?.accuracy === 'coarse'
  );
}

export async function checkLocationPermissions(): Promise<LocationPermissionStatus> {
  const foreground = await Location.getForegroundPermissionsAsync();
  const background = await Location.getBackgroundPermissionsAsync();
  const isReducedAccuracy = isReducedAccuracyResponse(foreground);

  return {
    foregroundGranted: foreground.granted,
    backgroundGranted: background.granted,
    canTrack: foreground.granted && !isReducedAccuracy,
    isReducedAccuracy,
  };
}

export async function requestLocationPermissions(): Promise<LocationPermissionStatus> {
  const currentFg = await Location.getForegroundPermissionsAsync();
  const handler = explainerHandler;

  // If already granted, check if iOS Approximate (reduced accuracy) is active
  if (currentFg.granted) {
    if (isReducedAccuracyResponse(currentFg)) {
      if (handler) {
        await new Promise<boolean>((resolve) => {
          handler({ mode: 'reduced_accuracy', resolve });
        });
      }
      return {
        foregroundGranted: true,
        backgroundGranted: false,
        canTrack: false,
        isReducedAccuracy: true,
      };
    }

    let backgroundGranted = false;
    try {
      const bg = await Location.getBackgroundPermissionsAsync();
      backgroundGranted = bg.granted;
      if (!bg.granted && bg.canAskAgain) {
        const reqBg = await Location.requestBackgroundPermissionsAsync();
        backgroundGranted = reqBg.granted;
      }
    } catch (err) {
      console.warn('[Rideoxy] Background permission check skipped:', err);
    }

    return {
      foregroundGranted: true,
      backgroundGranted,
      canTrack: true,
      isReducedAccuracy: false,
    };
  }

  // Not granted: if permanently denied, show settings redirect
  if (!currentFg.canAskAgain && currentFg.status === 'denied') {
    if (handler) {
      await new Promise<boolean>((resolve) => {
        handler({ mode: 'denied', resolve });
      });
    }
    return {
      foregroundGranted: false,
      backgroundGranted: false,
      canTrack: false,
      isReducedAccuracy: false,
    };
  }

  // If undetermined or can ask again: Show explainer dialog first before system prompt
  if (handler) {
    const userAgreed = await new Promise<boolean>((resolve) => {
      handler({ mode: 'explainer', resolve });
    });
    if (!userAgreed) {
      return {
        foregroundGranted: false,
        backgroundGranted: false,
        canTrack: false,
        isReducedAccuracy: false,
      };
    }
  }

  // 1. Request Foreground first
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) {
    return {
      foregroundGranted: false,
      backgroundGranted: false,
      canTrack: false,
      isReducedAccuracy: false,
    };
  }

  // Check if user selected "Approximate" in system dialog
  if (isReducedAccuracyResponse(foreground)) {
    if (handler) {
      await new Promise<boolean>((resolve) => {
        handler({ mode: 'reduced_accuracy', resolve });
      });
    }
    return {
      foregroundGranted: true,
      backgroundGranted: false,
      canTrack: false,
      isReducedAccuracy: true,
    };
  }

  // 2. Request Background if foreground is granted
  let backgroundGranted = false;
  try {
    const background = await Location.requestBackgroundPermissionsAsync();
    backgroundGranted = background.granted;
  } catch (err) {
    console.warn('[Rideoxy] Background permission request skipped or unavailable:', err);
  }

  return {
    foregroundGranted: true,
    backgroundGranted,
    canTrack: true,
    isReducedAccuracy: false,
  };
}

export async function getCurrentGPSFix(): Promise<RawGPSPoint | null> {
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      altitude: location.coords.altitude,
      speed: location.coords.speed,
      accuracy: location.coords.accuracy,
      heading: location.coords.heading,
      timestamp: location.timestamp,
      mocked: (location as any).mocked ?? (location.coords as any)?.mocked ?? false,
    };
  } catch (err) {
    console.warn('[Rideoxy] Failed to get initial GPS fix:', err);
    return null;
  }
}

// Authoritative tracking subscription state
let activeTrackingMode: 'none' | 'background' | 'foreground' = 'none';
let foregroundSubscription: Location.LocationSubscription | null = null;

export function getActiveTrackingMode(): 'none' | 'background' | 'foreground' {
  return activeTrackingMode;
}

/**
 * Starts a single authoritative location subscription.
 * Prioritizes background tracking (with foreground service on Android / CoreLocation background on iOS).
 * Uses accuracy: BestForNavigation, activityType: AutomotiveNavigation, pausesUpdatesAutomatically: false,
 * showsBackgroundLocationIndicator: true, distanceInterval: ~5m, timeInterval: 1000ms.
 */
export async function startLocationTracking(
  onLocation: (point: RawGPSPoint) => void
): Promise<{ success: boolean; mode: 'background' | 'foreground' }> {
  // If already tracking, return the existing active mode without creating duplicate subscriptions
  if (activeTrackingMode !== 'none') {
    return { success: true, mode: activeTrackingMode };
  }

  // Check current permissions including reduced accuracy check
  const permissions = await checkLocationPermissions();
  if (permissions.isReducedAccuracy) {
    return { success: false, mode: 'none' as any };
  }

  let backgroundStarted = false;
  if (permissions.backgroundGranted) {
    try {
      const isRegistered = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (!isRegistered) {
        await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
          accuracy: Location.Accuracy.BestForNavigation,
          activityType: Location.ActivityType.AutomotiveNavigation,
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
          timeInterval: GPS_CONFIG.TRACKING_TIME_INTERVAL_MS,
          distanceInterval: GPS_CONFIG.TRACKING_DISTANCE_INTERVAL_METERS,
          foregroundService: {
            notificationTitle: GPS_CONFIG.BACKGROUND_NOTIFICATION_TITLE,
            notificationBody: GPS_CONFIG.BACKGROUND_NOTIFICATION_BODY,
            notificationColor: Colors.primary,
          },
        });
      }

      // Route background task updates to the single authoritative callback
      registerLocationUpdateCallback((points) => {
        for (const pt of points) {
          onLocation(pt);
        }
      });

      activeTrackingMode = 'background';
      backgroundStarted = true;
      console.log('[Rideoxy] [LocationService] Authoritative location subscription started: BACKGROUND mode');
      return { success: true, mode: 'background' };
    } catch (bgErr) {
      console.warn('[Rideoxy] [LocationService] Background location start failed, falling back to foreground:', bgErr);
    }
  }

  // Fallback to foreground watcher if background not granted or failed
  try {
    if (foregroundSubscription) {
      foregroundSubscription.remove();
      foregroundSubscription = null;
    }

    foregroundSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: GPS_CONFIG.TRACKING_TIME_INTERVAL_MS,
        distanceInterval: GPS_CONFIG.TRACKING_DISTANCE_INTERVAL_METERS,
      },
      (location) => {
        onLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          altitude: location.coords.altitude,
          speed: location.coords.speed,
          accuracy: location.coords.accuracy,
          heading: location.coords.heading,
          timestamp: location.timestamp,
          mocked: (location as any).mocked ?? (location.coords as any)?.mocked ?? false,
        });
      }
    );

    activeTrackingMode = 'foreground';
    console.log('[Rideoxy] [LocationService] Authoritative location subscription started: FOREGROUND mode');
    return { success: true, mode: 'foreground' };
  } catch (fgErr) {
    console.error('[Rideoxy] [LocationService] Foreground location watcher failed to start:', fgErr);
    activeTrackingMode = 'none';
    return { success: false, mode: 'none' as any };
  }
}

/**
 * Stops any and all active location subscriptions cleanly and idempotently.
 */
export async function stopLocationTracking(): Promise<void> {
  // 1. Remove foreground watcher if active
  if (foregroundSubscription) {
    foregroundSubscription.remove();
    foregroundSubscription = null;
  }

  // 2. Stop background location task if active
  try {
    const isRegistered = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch (err) {
    console.warn('[Rideoxy] [LocationService] Error stopping background location updates:', err);
  }

  // 3. Clear TaskManager callback
  registerLocationUpdateCallback(null);

  activeTrackingMode = 'none';
  console.log('[Rideoxy] [LocationService] All location subscriptions stopped cleanly');
}

// Backwards-compatible aliases
export async function startBackgroundLocationTracking(): Promise<boolean> {
  const res = await startLocationTracking(() => {});
  return res.success && res.mode === 'background';
}

export async function stopBackgroundLocationTracking(): Promise<void> {
  await stopLocationTracking();
}

export async function startForegroundLocationWatching(
  onLocation: (point: RawGPSPoint) => void
): Promise<void> {
  await startLocationTracking(onLocation);
}

export function stopForegroundLocationWatching(): void {
  stopLocationTracking();
}
