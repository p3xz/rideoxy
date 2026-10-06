import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { RawGPSPoint } from '../types/ride';

export const BACKGROUND_LOCATION_TASK = 'brovxi_background_location_task';

type LocationUpdateCallback = (points: RawGPSPoint[]) => void;
let globalLocationCallback: LocationUpdateCallback | null = null;

export function registerLocationUpdateCallback(callback: LocationUpdateCallback | null) {
  globalLocationCallback = callback;
}

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[rideoxy] Background location task error:', error.message);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    if (locations && locations.length > 0) {
      const rawPoints: RawGPSPoint[] = locations.map((loc) => ({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        altitude: loc.coords.altitude,
        speed: loc.coords.speed,
        accuracy: loc.coords.accuracy,
        heading: loc.coords.heading,
        timestamp: loc.timestamp,
      }));

      if (globalLocationCallback) {
        globalLocationCallback(rawPoints);
      }
    }
  }
});
