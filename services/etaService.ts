import { Coordinates, calculateDistanceMeters } from './distance';
import { RideMode, EstimateSource } from '../types/ride';

export const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search';
export const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';
export const USER_AGENT = 'Rideoxy/1.0';
export const REQUEST_TIMEOUT_MS = 6000;
export const MAX_SNAPPED_DISTANCE_M = 500;

export interface GeocodeResult {
  place_id: number | string;
  name: string;
  display_name: string;
  district?: string;
  state?: string;
  lat: number;
  lng: number;
}

export type GeocodeErrorType =
  | 'not_found'
  | 'rate_limited'
  | 'network_error'
  | 'timeout'
  | 'parse_error'
  | 'mode_guard';

export type GeocodeResponse =
  | { success: true; results: GeocodeResult[] }
  | { success: false; error: GeocodeErrorType; message: string };

export interface RouteEstimate {
  durationSec: number;
  distanceM: number;
  source: 'osrm';
  isLowTrust: boolean;
}

export type RouteErrorType =
  | 'no_route'
  | 'network_error'
  | 'timeout'
  | 'parse_error'
  | 'invalid_data'
  | 'rate_limited'
  | 'mode_guard';

export type RouteResponse =
  | { success: true; estimate: RouteEstimate }
  | { success: false; error: RouteErrorType; message: string };

/** Provider interface allowing OSRM/Nominatim to be substituted without altering UI or DB logic. */
export interface EtaProvider {
  searchDestination(query: string, mode?: RideMode): Promise<GeocodeResponse>;
  fetchRoute(origin: Coordinates, destination: Coordinates, mode?: RideMode): Promise<RouteResponse>;
}

/**
 * Fetch helper with AbortController timeout and optional single network-error retry.
 */
async function fetchWithTimeoutAndRetry(
  url: string,
  options: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
  allowRetryOnNetworkError = false
): Promise<Response> {
  const doFetch = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  try {
    return await doFetch();
  } catch (err: any) {
    if (allowRetryOnNetworkError && err?.name !== 'AbortError') {
      // Retry once on pure network errors only
      return await doFetch();
    }
    throw err;
  }
}

/**
 * Default implementation of EtaProvider using Nominatim (geocoding) and OSRM (routing).
 */
export class OsrmNominatimProvider implements EtaProvider {
  /**
   * Geocode a destination place name using OpenStreetMap Nominatim.
   * Search is executed on explicit SUBMIT only, never per keystroke.
   */
  async searchDestination(query: string, mode: RideMode = 'destination'): Promise<GeocodeResponse> {
    // Mode Guard: Free rides must never perform network calls
    if (mode !== 'destination') {
      return {
        success: false,
        error: 'mode_guard',
        message: 'Destination search is only available in Destination mode.',
      };
    }

    const trimmed = query.trim();
    if (!trimmed) {
      return {
        success: false,
        error: 'not_found',
        message: 'Please enter a destination name.',
      };
    }

    const url = `${NOMINATIM_BASE_URL}?format=jsonv2&limit=5&countrycodes=in&q=${encodeURIComponent(trimmed)}`;

    try {
      const res = await fetchWithTimeoutAndRetry(
        url,
        {
          method: 'GET',
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'application/json',
          },
        },
        REQUEST_TIMEOUT_MS,
        true // Allow 1 retry on network error
      );

      if (res.status === 429) {
        return {
          success: false,
          error: 'rate_limited',
          message: 'Destination search is temporarily busy. You can enter expected minutes manually.',
        };
      }

      if (!res.ok) {
        return {
          success: false,
          error: 'network_error',
          message: `Location service responded with status ${res.status}. You can enter minutes manually.`,
        };
      }

      let data: any;
      try {
        data = await res.json();
      } catch {
        return {
          success: false,
          error: 'parse_error',
          message: 'Received invalid response from search provider.',
        };
      }

      if (!Array.isArray(data) || data.length === 0) {
        return {
          success: false,
          error: 'not_found',
          message: 'Destination not found. Check spelling, try a nearby town, or enter minutes manually.',
        };
      }

      const results: GeocodeResult[] = data.map((item: any) => {
        const addr = item.address || {};
        const parts = (item.display_name || '').split(',').map((p: string) => p.trim());
        const primaryName = item.name || parts[0] || 'Unknown Place';
        const district =
          addr.county ||
          addr.state_district ||
          addr.city_district ||
          (parts.length > 2 ? parts[parts.length - 3] : undefined);
        const state = addr.state || (parts.length > 1 ? parts[parts.length - 2] : undefined);

        return {
          place_id: item.place_id || `${item.lat},${item.lon}`,
          name: primaryName,
          display_name: item.display_name,
          district: district || undefined,
          state: state || undefined,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        };
      });

      return {
        success: true,
        results,
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return {
          success: false,
          error: 'timeout',
          message: 'Search timed out after 6 seconds. You can enter minutes manually.',
        };
      }
      return {
        success: false,
        error: 'network_error',
        message: 'Could not connect to location services. You can enter minutes manually or switch to Free Ride.',
      };
    }
  }

  /**
   * Route between origin and destination coordinates using OSRM driving profile.
   * Longitude first in OSRM path: {startLng},{startLat};{destLng},{destLat}
   */
  async fetchRoute(
    origin: Coordinates,
    destination: Coordinates,
    mode: RideMode = 'destination'
  ): Promise<RouteResponse> {
    // Mode Guard: Free rides must never perform network calls
    if (mode !== 'destination') {
      return {
        success: false,
        error: 'mode_guard',
        message: 'Route ETA is only computed in Destination mode.',
      };
    }

    const coordsPath = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
    const url = `${OSRM_BASE_URL}/${coordsPath}?overview=false`;

    try {
      const res = await fetchWithTimeoutAndRetry(
        url,
        {
          method: 'GET',
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'application/json',
          },
        },
        REQUEST_TIMEOUT_MS,
        true // Allow 1 retry on network error ONLY
      );

      if (res.status === 429) {
        return {
          success: false,
          error: 'rate_limited',
          message: 'Routing service temporarily rate limited.',
        };
      }

      if (!res.ok) {
        return {
          success: false,
          error: 'network_error',
          message: `Routing service returned HTTP ${res.status}.`,
        };
      }

      let data: any;
      try {
        data = await res.json();
      } catch {
        return {
          success: false,
          error: 'parse_error',
          message: 'Malformed JSON received from routing service.',
        };
      }

      // Check OSRM code
      if (data.code !== 'Ok' || !Array.isArray(data.routes) || data.routes.length === 0) {
        return {
          success: false,
          error: 'no_route',
          message: 'No road route found to the destination.',
        };
      }

      const primaryRoute = data.routes[0];
      const durationSec = primaryRoute.duration;
      const distanceM = primaryRoute.distance;

      // Sanity check: duration must be positive and finite
      if (!Number.isFinite(durationSec) || durationSec <= 0) {
        return {
          success: false,
          error: 'invalid_data',
          message: 'Invalid non-positive route duration received.',
        };
      }

      // Snapped waypoint sanity check (compare snapped coordinates with requested)
      let isLowTrust = false;
      if (Array.isArray(data.waypoints) && data.waypoints.length >= 2) {
        const originSnapped = data.waypoints[0].location; // [lng, lat]
        const destSnapped = data.waypoints[1].location; // [lng, lat]

        if (Array.isArray(originSnapped) && Array.isArray(destSnapped)) {
          const originGap = calculateDistanceMeters(origin, {
            longitude: originSnapped[0],
            latitude: originSnapped[1],
          });
          const destGap = calculateDistanceMeters(destination, {
            longitude: destSnapped[0],
            latitude: destSnapped[1],
          });

          if (originGap > MAX_SNAPPED_DISTANCE_M || destGap > MAX_SNAPPED_DISTANCE_M) {
            isLowTrust = true;
          }
        }
      }

      return {
        success: true,
        estimate: {
          durationSec: Math.round(durationSec),
          distanceM: Math.round(distanceM),
          source: 'osrm',
          isLowTrust,
        },
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return {
          success: false,
          error: 'timeout',
          message: 'Routing request timed out after 6 seconds.',
        };
      }
      return {
        success: false,
        error: 'network_error',
        message: 'Could not connect to routing service.',
      };
    }
  }
}

/** Singleton provider instance */
export const etaProvider: EtaProvider = new OsrmNominatimProvider();

/** Convenience wrapper functions */
export async function searchDestination(query: string, mode: RideMode = 'destination'): Promise<GeocodeResponse> {
  return etaProvider.searchDestination(query, mode);
}

export async function fetchRouteEta(
  origin: Coordinates,
  destination: Coordinates,
  mode: RideMode = 'destination'
): Promise<RouteResponse> {
  return etaProvider.fetchRoute(origin, destination, mode);
}

/**
 * Clamps manual expected minutes between 1 minute (60s) and 12 hours (720 min).
 */
export function clampManualMinutes(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes < 1) return 1;
  if (minutes > 720) return 720;
  return Math.round(minutes);
}

/**
 * Formats manual minutes into plain english words so typos are instantly spotted.
 * Examples:
 * 100 -> "Expected time: 1 hour 40 minutes"
 * 45  -> "Expected time: 45 minutes"
 * 120 -> "Expected time: 2 hours"
 * 1   -> "Expected time: 1 minute"
 */
export function formatManualMinutesInWords(minutes: number): string {
  const clamped = clampManualMinutes(minutes);
  const hours = Math.floor(clamped / 60);
  const mins = clamped % 60;

  if (hours === 0) {
    return `Expected time: ${mins} ${mins === 1 ? 'minute' : 'minutes'}`;
  }
  if (mins === 0) {
    return `Expected time: ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }
  return `Expected time: ${hours} ${hours === 1 ? 'hour' : 'hours'} ${mins} ${mins === 1 ? 'minute' : 'minutes'}`;
}

/**
 * Flags implausible values (e.g. over 6 hours / 360 minutes).
 */
export function isManualMinutesImplausible(minutes: number): boolean {
  return minutes > 360;
}

/**
 * Formats the source label for the UI tiles:
 * osrm -> "Car routing estimate"
 * manual -> "Your estimate"
 */
export function getEstimateSourceLabel(source: EstimateSource | null | undefined): string {
  if (source === 'osrm') {
    return 'Car routing estimate';
  }
  return 'Your estimate';
}
