import { Coordinates, calculateDistanceMeters } from './distance';
import { RideMode, EstimateSource } from '../types/ride';

export const OLA_AUTOCOMPLETE_URL = 'https://api.olamaps.io/places/v1/autocomplete';
export const OLA_GEOCODE_URL = 'https://api.olamaps.io/places/v1/geocode';
export const OLA_DIRECTIONS_URL = 'https://api.olamaps.io/routing/v1/directions';

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
  source?: 'ola' | 'nominatim';
}

export type GeocodeErrorType =
  | 'not_found'
  | 'rate_limited'
  | 'auth_error'
  | 'network_error'
  | 'timeout'
  | 'parse_error'
  | 'mode_guard'
  | 'not_available';

export type GeocodeResponse =
  | { success: true; results: GeocodeResult[] }
  | { success: false; error: GeocodeErrorType; message: string };

export interface RouteEstimate {
  durationSec: number;
  distanceM: number;
  source: EstimateSource;
  isLowTrust: boolean;
}

export type RouteErrorType =
  | 'no_route'
  | 'network_error'
  | 'timeout'
  | 'parse_error'
  | 'invalid_data'
  | 'rate_limited'
  | 'auth_error'
  | 'mode_guard'
  | 'not_available';

export type RouteResponse =
  | { success: true; estimate: RouteEstimate }
  | { success: false; error: RouteErrorType; message: string };

/** Provider interface allowing Ola/OSRM/Nominatim to be substituted without altering UI or DB logic. */
export interface EtaProvider {
  searchDestination(query: string, mode?: RideMode): Promise<GeocodeResponse>;
  fetchRoute(origin: Coordinates, destination: Coordinates, mode?: RideMode): Promise<RouteResponse>;
}

// ────────────────────────────────────────────────────────────────────────────
// API Key & Circuit Breaker (Session-wide)
// ────────────────────────────────────────────────────────────────────────────

let isOlaCircuitBroken = false;

export function getOlaMapsApiKey(): string {
  return process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY || '';
}

export function isOlaCircuitBreakerTripped(): boolean {
  return isOlaCircuitBroken;
}

export function tripOlaCircuitBreaker(): void {
  isOlaCircuitBroken = true;
  console.warn('[Rideoxy] [ETA] Ola Maps circuit breaker tripped (429 or auth failure). Skipping Ola for the session.');
}

export function resetOlaCircuitBreaker(): void {
  isOlaCircuitBroken = false;
}

// Autocomplete in-memory cache for session (per query string)
const autocompleteCache = new Map<string, GeocodeResult[]>();

export function clearAutocompleteCache(): void {
  autocompleteCache.clear();
}

/** Redacts sensitive API keys from logged strings or diagnostics */
export function redactApiKey(urlOrString: string): string {
  return urlOrString.replace(/api_key=([^&]+)/gi, 'api_key=[REDACTED]');
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

// ────────────────────────────────────────────────────────────────────────────
// 1. Primary Provider: Ola Maps
// ────────────────────────────────────────────────────────────────────────────

export class OlaMapsProvider implements EtaProvider {
  private getApiKey(): string {
    return getOlaMapsApiKey();
  }

  async searchDestination(query: string, mode: RideMode = 'destination'): Promise<GeocodeResponse> {
    if (mode !== 'destination') {
      return { success: false, error: 'mode_guard', message: 'Destination search only runs in Destination mode.' };
    }

    const key = this.getApiKey();
    if (!key || isOlaCircuitBroken) {
      return { success: false, error: 'not_available', message: 'Ola Maps is not configured or circuit is broken.' };
    }

    const trimmed = query.trim();
    if (trimmed.length < 3) {
      return { success: false, error: 'not_found', message: 'Minimum 3 characters required.' };
    }

    // Check session cache
    const cacheKey = trimmed.toLowerCase();
    if (autocompleteCache.has(cacheKey)) {
      return { success: true, results: autocompleteCache.get(cacheKey)! };
    }

    const url = `${OLA_AUTOCOMPLETE_URL}?input=${encodeURIComponent(trimmed)}&api_key=${encodeURIComponent(key)}`;

    try {
      const res = await fetchWithTimeoutAndRetry(
        url,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'User-Agent': USER_AGENT,
          },
        },
        REQUEST_TIMEOUT_MS,
        true
      );

      // Circuit Breaker triggers: 429 (Rate Limit) or 401/403 (Auth Failure)
      if (res.status === 429) {
        tripOlaCircuitBreaker();
        return { success: false, error: 'rate_limited', message: 'Ola Maps quota exhausted or rate limited.' };
      }
      if (res.status === 401 || res.status === 403) {
        tripOlaCircuitBreaker();
        return { success: false, error: 'auth_error', message: 'Ola Maps authentication failure.' };
      }
      if (!res.ok) {
        return { success: false, error: 'network_error', message: `Ola Maps responded with status ${res.status}.` };
      }

      let data: any;
      try {
        data = await res.json();
      } catch {
        return { success: false, error: 'parse_error', message: 'Malformed response from Ola Maps.' };
      }

      const predictions = data?.predictions;
      if (!Array.isArray(predictions) || predictions.length === 0) {
        return { success: false, error: 'not_found', message: 'No suggestions found.' };
      }

      // Cap at 5 suggestions
      const capped = predictions.slice(0, 5);
      const results: GeocodeResult[] = [];

      for (const p of capped) {
        const description: string = p.description || '';
        const mainText: string = p.structured_formatting?.main_text || description.split(',')[0].trim() || 'Destination';
        const secondaryText: string = p.structured_formatting?.secondary_text || '';

        // Extract district and state from secondary text
        const secParts = secondaryText.split(',').map((s) => s.trim()).filter(Boolean);
        const state = secParts.length > 1 ? secParts[secParts.length - 2] : secParts[0] || undefined;
        const district = secParts.length > 2 ? secParts[0] : undefined;

        let lat = p.geometry?.location?.lat;
        let lng = p.geometry?.location?.lng ?? p.geometry?.location?.lon;

        // If coordinates missing in autocomplete prediction, geocode place description
        if (typeof lat !== 'number' || typeof lng !== 'number') {
          try {
            const geoUrl = `${OLA_GEOCODE_URL}?address=${encodeURIComponent(description)}&api_key=${encodeURIComponent(key)}`;
            const geoRes = await fetchWithTimeoutAndRetry(geoUrl, { method: 'GET' }, 3000, false);
            if (geoRes.ok) {
              const geoData = await geoRes.json();
              const first = geoData?.geocodingResults?.[0] || geoData?.results?.[0];
              lat = first?.geometry?.location?.lat;
              lng = first?.geometry?.location?.lng ?? first?.geometry?.location?.lon;
            }
          } catch {
            // If geocode fails, continue with fallback
          }
        }

        if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
          results.push({
            place_id: p.place_id || `${lat},${lng}`,
            name: mainText,
            display_name: description,
            district,
            state,
            lat,
            lng,
            source: 'ola',
          });
        }
      }

      if (results.length === 0) {
        return { success: false, error: 'not_found', message: 'Could not resolve place coordinates.' };
      }

      // Cache for session
      autocompleteCache.set(cacheKey, results);
      return { success: true, results };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { success: false, error: 'timeout', message: 'Ola Maps search timed out after 6 seconds.' };
      }
      return { success: false, error: 'network_error', message: 'Could not connect to Ola Maps.' };
    }
  }

  async fetchRoute(
    origin: Coordinates,
    destination: Coordinates,
    mode: RideMode = 'destination'
  ): Promise<RouteResponse> {
    if (mode !== 'destination') {
      return { success: false, error: 'mode_guard', message: 'Route ETA is only computed in Destination mode.' };
    }

    const key = this.getApiKey();
    if (!key || isOlaCircuitBroken) {
      return { success: false, error: 'not_available', message: 'Ola Maps is not configured or circuit is broken.' };
    }

    // Directions API: origin=lat,lng&destination=lat,lng
    const url = `${OLA_DIRECTIONS_URL}?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&mode=driving&api_key=${encodeURIComponent(key)}`;

    try {
      const res = await fetchWithTimeoutAndRetry(
        url,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': USER_AGENT,
          },
        },
        REQUEST_TIMEOUT_MS,
        true
      );

      // Circuit Breaker triggers: 429 or 401/403
      if (res.status === 429) {
        tripOlaCircuitBreaker();
        return { success: false, error: 'rate_limited', message: 'Ola Maps routing rate limited.' };
      }
      if (res.status === 401 || res.status === 403) {
        tripOlaCircuitBreaker();
        return { success: false, error: 'auth_error', message: 'Ola Maps authentication failure.' };
      }
      if (!res.ok) {
        return { success: false, error: 'network_error', message: `Ola Maps routing status ${res.status}.` };
      }

      let data: any;
      try {
        data = await res.json();
      } catch {
        return { success: false, error: 'parse_error', message: 'Malformed response from Ola Maps routing.' };
      }

      // Check routes
      const routes = data?.routes;
      if (!Array.isArray(routes) || routes.length === 0) {
        return { success: false, error: 'no_route', message: 'No road route found to destination.' };
      }

      const primary = routes[0];
      const durationSec = primary.duration;
      const distanceM = primary.distance;

      if (!Number.isFinite(durationSec) || durationSec <= 0) {
        return { success: false, error: 'invalid_data', message: 'Invalid non-positive route duration.' };
      }

      // Snapped waypoint check
      let isLowTrust = false;
      const waypoints = data?.waypoints;
      if (Array.isArray(waypoints) && waypoints.length >= 2) {
        const destWp = waypoints[1];
        let wpLat: number | undefined;
        let wpLng: number | undefined;

        if (Array.isArray(destWp.location)) {
          // [lng, lat]
          wpLng = destWp.location[0];
          wpLat = destWp.location[1];
        } else if (destWp.location && typeof destWp.location === 'object') {
          wpLat = destWp.location.lat;
          wpLng = destWp.location.lng ?? destWp.location.lon;
        }

        if (typeof wpLat === 'number' && typeof wpLng === 'number') {
          const destGap = calculateDistanceMeters(destination, { latitude: wpLat, longitude: wpLng });
          if (destGap > MAX_SNAPPED_DISTANCE_M) {
            isLowTrust = true;
          }
        }
      }

      return {
        success: true,
        estimate: {
          durationSec: Math.round(durationSec),
          distanceM: Math.round(distanceM),
          source: 'ola',
          isLowTrust,
        },
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { success: false, error: 'timeout', message: 'Ola Maps routing timed out after 6 seconds.' };
      }
      return { success: false, error: 'network_error', message: 'Could not connect to Ola Maps routing.' };
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Fallback Provider: OpenStreetMap Nominatim + OSRM
// ────────────────────────────────────────────────────────────────────────────

export class OsrmNominatimProvider implements EtaProvider {
  /**
   * Geocode a destination place name using OpenStreetMap Nominatim.
   * Search is executed on explicit SUBMIT only, never per keystroke.
   */
  async searchDestination(query: string, mode: RideMode = 'destination'): Promise<GeocodeResponse> {
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
          source: 'nominatim',
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

// ────────────────────────────────────────────────────────────────────────────
// 3. Fallback Chain Provider (Ola Maps -> Nominatim/OSRM)
// ────────────────────────────────────────────────────────────────────────────

export class FallbackEtaProvider implements EtaProvider {
  private ola = new OlaMapsProvider();
  private osrm = new OsrmNominatimProvider();

  async searchDestination(query: string, mode: RideMode = 'destination'): Promise<GeocodeResponse> {
    if (mode !== 'destination') {
      return { success: false, error: 'mode_guard', message: 'Destination search only runs in Destination mode.' };
    }

    // Attempt 1: Ola Maps (if key present and circuit unbroken)
    if (getOlaMapsApiKey() && !isOlaCircuitBroken) {
      const olaRes = await this.ola.searchDestination(query, mode);
      if (olaRes.success && olaRes.results.length > 0) {
        return olaRes;
      }
      // If Ola fails (auth, 429, timeout, network), fall through to Nominatim
    }

    // Attempt 2: OpenStreetMap Nominatim
    return this.osrm.searchDestination(query, mode);
  }

  async fetchRoute(
    origin: Coordinates,
    destination: Coordinates,
    mode: RideMode = 'destination'
  ): Promise<RouteResponse> {
    if (mode !== 'destination') {
      return { success: false, error: 'mode_guard', message: 'Route ETA is only computed in Destination mode.' };
    }

    // Attempt 1: Ola Maps (if key present and circuit unbroken)
    if (getOlaMapsApiKey() && !isOlaCircuitBroken) {
      const olaRes = await this.ola.fetchRoute(origin, destination, mode);
      if (olaRes.success) {
        return olaRes;
      }
      // If Ola fails, fall through to OSRM
    }

    // Attempt 2: OSRM
    return this.osrm.fetchRoute(origin, destination, mode);
  }
}

/** Singleton fallback provider instance */
export const etaProvider: EtaProvider = new FallbackEtaProvider();

/** Public API functions */
export async function searchDestination(
  query: string,
  mode: RideMode = 'destination'
): Promise<GeocodeResponse> {
  return etaProvider.searchDestination(query, mode);
}

export async function fetchRouteEta(
  origin: Coordinates,
  destination: Coordinates,
  mode: RideMode = 'destination'
): Promise<RouteResponse> {
  return etaProvider.fetchRoute(origin, destination, mode);
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers: Manual Minutes & Source Labels
// ────────────────────────────────────────────────────────────────────────────

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
 * ola -> "Route estimate"
 * osrm -> "Car routing estimate"
 * manual -> "Your estimate"
 */
export function getEstimateSourceLabel(source: EstimateSource | null | undefined): string {
  if (source === 'ola') {
    return 'Route estimate';
  }
  if (source === 'osrm') {
    return 'Car routing estimate';
  }
  return 'Your estimate';
}
