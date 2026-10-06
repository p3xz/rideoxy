import * as Location from 'expo-location';
import { BACKGROUND_LOCATION_TASK } from '../tasks/locationTask';
import { GPS_CONFIG } from '../constants/gps';
import { Colors } from '../constants/theme';
import { RawGPSPoint } from '../types/ride';

export interface LocationPermissionStatus {
  foregroundGranted: boolean;
  backgroundGranted: boolean;
  canTrack: boolean;
}

export async function checkLocationPermissions(): Promise<LocationPermissionStatus> {
  const foreground = await Location.getForegroundPermissionsAsync();
  const background = await Location.getBackgroundPermissionsAsync();

  return {
    foregroundGranted: foreground.granted,
    backgroundGranted: background.granted,
    canTrack: foreground.granted,
  };
}

export async function requestLocationPermissions(): Promise<LocationPermissionStatus> {
  // 1. Request Foreground first
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) {
    return {
      foregroundGranted: false,
      backgroundGranted: false,
      canTrack: false,
    };
  }

  // 2. Request Background if foreground is granted
  let backgroundGranted = false;
  try {
    const background = await Location.requestBackgroundPermissionsAsync();
    backgroundGranted = background.granted;
  } catch (err) {
    console.warn('[rideoxy] Background permission request skipped or unavailable:', err);
  }

  return {
    foregroundGranted: true,
    backgroundGranted,
    canTrack: true,
  };
}

export async function getCurrentGPSFix(): Promise<RawGPSPoint | null> {
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      altitude: location.coords.altitude,
      speed: location.coords.speed,
      accuracy: location.coords.accuracy,
      heading: location.coords.heading,
      timestamp: location.timestamp,
    };
  } catch (err) {
    console.warn('[rideoxy] Failed to get initial GPS fix:', err);
    return null;
  }
}

export async function startBackgroundLocationTracking(): Promise<boolean> {
  try {
    const isRegistered = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (!isRegistered) {
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: GPS_CONFIG.TRACKING_TIME_INTERVAL_MS,
        distanceInterval: GPS_CONFIG.TRACKING_DISTANCE_INTERVAL_METERS,
        foregroundService: {
          notificationTitle: GPS_CONFIG.BACKGROUND_NOTIFICATION_TITLE,
          notificationBody: GPS_CONFIG.BACKGROUND_NOTIFICATION_BODY,
          notificationColor: Colors.primary,
        },
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
      });
    }
    return true;
  } catch (err) {
    console.warn('[rideoxy] Could not start background location updates:', err);
    return false;
  }
}

export async function stopBackgroundLocationTracking(): Promise<void> {
  try {
    const isRegistered = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch (err) {
    console.warn('[rideoxy] Error stopping background location updates:', err);
  }
}

let foregroundSubscription: Location.LocationSubscription | null = null;

export async function startForegroundLocationWatching(
  onLocation: (point: RawGPSPoint) => void
): Promise<void> {
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
      });
    }
  );
}

export function stopForegroundLocationWatching(): void {
  if (foregroundSubscription) {
    foregroundSubscription.remove();
    foregroundSubscription = null;
  }
}
