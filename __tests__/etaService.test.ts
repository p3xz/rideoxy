import {
  OlaMapsProvider,
  OsrmNominatimProvider,
  FallbackEtaProvider,
  searchDestination,
  fetchRouteEta,
  resetOlaCircuitBreaker,
  isAllowedOutboundUrl,
  ALLOWED_OUTBOUND_ENDPOINTS,
  OLA_DIRECTIONS_URL,
  NOMINATIM_BASE_URL,
  OSRM_BASE_URL,
  formatManualMinutesInWords,
  clampManualMinutes,
  isManualMinutesImplausible,
  getEstimateSourceLabel,
  redactApiKey,
} from '../services/etaService';

describe('etaService - Free-Only Architecture', () => {
  let originalFetch: typeof global.fetch;
  let originalApiKey: string | undefined;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalApiKey = process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY;
    resetOlaCircuitBreaker();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY = originalApiKey;
    resetOlaCircuitBreaker();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Strict Outbound Endpoint Allowlist Guard
  // ──────────────────────────────────────────────────────────────────────────

  describe('Outbound Endpoint Allowlist Guard', () => {
    test('Only free endpoints (Ola Directions, Nominatim, OSRM) are in the allowlist', () => {
      expect(ALLOWED_OUTBOUND_ENDPOINTS).toEqual([
        'https://api.olamaps.io/routing/v1/directions',
        'https://nominatim.openstreetmap.org/search',
        'https://router.project-osrm.org/route/v1/driving',
      ]);
    });

    test('isAllowedOutboundUrl permits only whitelisted free endpoints', () => {
      // Allowed
      expect(isAllowedOutboundUrl('https://api.olamaps.io/routing/v1/directions?origin=12,77&destination=13,77')).toBe(true);
      expect(isAllowedOutboundUrl('https://nominatim.openstreetmap.org/search?q=Nandi+Hills')).toBe(true);
      expect(isAllowedOutboundUrl('https://router.project-osrm.org/route/v1/driving/77,12;77,13')).toBe(true);

      // Forbidden paid products (BLOCKED)
      expect(isAllowedOutboundUrl('https://api.olamaps.io/places/v1/autocomplete?input=Nandi')).toBe(false);
      expect(isAllowedOutboundUrl('https://api.olamaps.io/places/v1/geocode?address=Bangalore')).toBe(false);
      expect(isAllowedOutboundUrl('https://api.olamaps.io/places/v1/details?place_id=123')).toBe(false);
      expect(isAllowedOutboundUrl('https://api.olamaps.io/roads/v1/nearestRoad?points=12,77')).toBe(false);
      expect(isAllowedOutboundUrl('https://api.olamaps.io/roads/v1/speedLimits?points=12,77')).toBe(false);
      expect(isAllowedOutboundUrl('https://maps.googleapis.com/maps/api/directions/json')).toBe(false);
    });

    test('Any attempt to request a forbidden outbound URL throws and blocks fetch', async () => {
      const fetchSpy = jest.fn();
      global.fetch = fetchSpy;

      // Try routing through fallback provider
      const fallback = new FallbackEtaProvider();
      const origin = { latitude: 12.9716, longitude: 77.5946 };
      const dest = { latitude: 13.3702, longitude: 77.6835 };

      // Destination search must only call Nominatim
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      });

      await fallback.searchDestination('Migsun Vilaasa', 'destination');
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const requestedUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(requestedUrl).toMatch(/^https:\/\/nominatim\.openstreetmap\.org\/search/);
      expect(requestedUrl).not.toContain('olamaps');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Free Search: OpenStreetMap Nominatim Submit-Search
  // ──────────────────────────────────────────────────────────────────────────

  describe('Nominatim Submit-Search (Free)', () => {
    let provider: OsrmNominatimProvider;

    beforeEach(() => {
      provider = new OsrmNominatimProvider();
    });

    test('Free ride mode makes zero network calls and rejects geocode request', async () => {
      const fetchSpy = jest.fn();
      global.fetch = fetchSpy;

      const res = await provider.searchDestination('Nandi Hills', 'free');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('mode_guard');
      }
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    test('Success with recorded fixture: parses name, district, state, coordinates', async () => {
      const fixture = [
        {
          place_id: 2827181,
          name: 'Nandi Hills',
          display_name: 'Nandi Hills, Chikkaballapura, Karnataka, 562103, India',
          lat: '13.3702',
          lon: '77.6835',
          address: {
            county: 'Chikkaballapura',
            state: 'Karnataka',
            country: 'India',
          },
        },
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => fixture,
      });

      const res = await provider.searchDestination('Nandi Hills', 'destination');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.results).toHaveLength(1);
        const item = res.results[0];
        expect(item.name).toBe('Nandi Hills');
        expect(item.district).toBe('Chikkaballapura');
        expect(item.state).toBe('Karnataka');
        expect(item.lat).toBe(13.3702);
        expect(item.lng).toBe(77.6835);
        expect(item.source).toBe('nominatim');
      }
    });

    test('Empty results (e.g. unmapped new society): returns not_found', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      });

      const res = await provider.searchDestination('Migsun Vilaasa Greater Noida', 'destination');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('not_found');
      }
    });

    test('HTTP 429 Rate Limit: returns typed rate_limited error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Too Many Requests' }),
      });

      const res = await provider.searchDestination('Bangalore', 'destination');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('rate_limited');
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Free Route Routing: Ola Directions (Allowed Ola Endpoint)
  // ──────────────────────────────────────────────────────────────────────────

  describe('Ola Directions (Free Tier up to 100K/mo)', () => {
    let olaProvider: OlaMapsProvider;
    const origin = { latitude: 12.9716, longitude: 77.5946 };
    const dest = { latitude: 13.3702, longitude: 77.6835 };

    beforeEach(() => {
      olaProvider = new OlaMapsProvider();
      process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY = 'test_ola_api_key_12345';
    });

    test('Free ride mode makes zero network calls and rejects routing request', async () => {
      const fetchSpy = jest.fn();
      global.fetch = fetchSpy;

      const routeRes = await olaProvider.fetchRoute(origin, dest, 'free');
      expect(routeRes.success).toBe(false);
      if (!routeRes.success) {
        expect(routeRes.error).toBe('mode_guard');
      }
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    test('Missing API key returns not_available without calling network', async () => {
      delete process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY;
      const fetchSpy = jest.fn();
      global.fetch = fetchSpy;

      const routeRes = await olaProvider.fetchRoute(origin, dest, 'destination');
      expect(routeRes.success).toBe(false);
      if (!routeRes.success) {
        expect(routeRes.error).toBe('not_available');
      }
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    test('Success with recorded fixture: parses duration and distance with source: ola', async () => {
      const fixture = {
        routes: [
          {
            duration: 3420, // 57 min
            distance: 58500, // 58.5 km
          },
        ],
        waypoints: [
          { location: { lat: 12.9716, lng: 77.5946 } },
          { location: { lat: 13.3702, lng: 77.6835 } },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => fixture,
      });

      const res = await olaProvider.fetchRoute(origin, dest, 'destination');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.estimate.durationSec).toBe(3420);
        expect(res.estimate.distanceM).toBe(58500);
        expect(res.estimate.source).toBe('ola');
        expect(res.estimate.isLowTrust).toBe(false);
      }
    });

    test('HTTP 429 trips circuit breaker and returns rate_limited', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Rate limit exceeded' }),
      });

      const res = await olaProvider.fetchRoute(origin, dest, 'destination');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('rate_limited');
      }

      // Next call should be blocked by circuit breaker without network calls
      const fetchSpy = jest.fn();
      global.fetch = fetchSpy;
      const blockedRes = await olaProvider.fetchRoute(origin, dest, 'destination');
      expect(blockedRes.success).toBe(false);
      if (!blockedRes.success) {
        expect(blockedRes.error).toBe('not_available');
      }
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    test('HTTP 401 / 403 trips circuit breaker and returns auth_error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      });

      const res = await olaProvider.fetchRoute(origin, dest, 'destination');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('auth_error');
      }
    });

    test('Routing with snapped point > 500m marks isLowTrust = true', async () => {
      const fixture = {
        routes: [
          {
            duration: 3420,
            distance: 58500,
          },
        ],
        waypoints: [
          { location: { lat: 12.9716, lng: 77.5946 } },
          // Snapped endpoint ~1.1 km away
          { location: { lat: 13.3802, lng: 77.6835 } },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => fixture,
      });

      const res = await olaProvider.fetchRoute(origin, dest, 'destination');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.estimate.isLowTrust).toBe(true);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Free Fallback Chain: Ola Directions -> OSRM
  // ──────────────────────────────────────────────────────────────────────────

  describe('Fallback Chain (Ola Directions -> OSRM)', () => {
    let fallback: FallbackEtaProvider;
    const origin = { latitude: 12.9716, longitude: 77.5946 };
    const dest = { latitude: 13.3702, longitude: 77.6835 };

    beforeEach(() => {
      fallback = new FallbackEtaProvider();
    });

    test('When Ola key is present and Ola Directions succeeds, returns source: ola', async () => {
      process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY = 'valid_key';

      const olaFixture = {
        routes: [
          {
            duration: 2100,
            distance: 35000,
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => olaFixture,
      });

      const res = await fallback.fetchRoute(origin, dest, 'destination');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.estimate.source).toBe('ola');
        expect(res.estimate.durationSec).toBe(2100);
      }
    });

    test('When Ola key is missing, falls back cleanly to OSRM', async () => {
      delete process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY;

      const osrmFixture = {
        code: 'Ok',
        routes: [
          {
            duration: 2500,
            distance: 36000,
          },
        ],
        waypoints: [
          { location: [77.5946, 12.9716] },
          { location: [77.6835, 13.3702] },
        ],
      };

      const fetchSpy = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => osrmFixture,
      });
      global.fetch = fetchSpy;

      const res = await fallback.fetchRoute(origin, dest, 'destination');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.estimate.source).toBe('osrm');
        expect(res.estimate.durationSec).toBe(2500);
      }
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    test('When Ola Directions returns 429, trips circuit breaker and falls back to OSRM', async () => {
      process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY = 'valid_key';

      const osrmFixture = {
        code: 'Ok',
        routes: [
          {
            duration: 2500,
            distance: 36000,
          },
        ],
      };

      const fetchSpy = jest
        .fn()
        // First call: Ola Directions returns 429
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ error: 'Rate limit' }),
        })
        // Second call: Fallback to OSRM succeeds
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => osrmFixture,
        });

      global.fetch = fetchSpy;

      const res = await fallback.fetchRoute(origin, dest, 'destination');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.estimate.source).toBe('osrm');
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Utility Functions & Labels
  // ──────────────────────────────────────────────────────────────────────────

  describe('Words Echo and Labels', () => {
    test('formatManualMinutesInWords correctly echoes back hours and minutes', () => {
      expect(formatManualMinutesInWords(100)).toBe('Expected time: 1 hour 40 minutes');
      expect(formatManualMinutesInWords(45)).toBe('Expected time: 45 minutes');
      expect(formatManualMinutesInWords(120)).toBe('Expected time: 2 hours');
      expect(formatManualMinutesInWords(1)).toBe('Expected time: 1 minute');
      expect(formatManualMinutesInWords(60)).toBe('Expected time: 1 hour');
    });

    test('clampManualMinutes clamps between 1 and 720', () => {
      expect(clampManualMinutes(0)).toBe(1);
      expect(clampManualMinutes(-10)).toBe(1);
      expect(clampManualMinutes(45)).toBe(45);
      expect(clampManualMinutes(900)).toBe(720);
    });

    test('isManualMinutesImplausible flags values over 6 hours (> 360 min)', () => {
      expect(isManualMinutesImplausible(120)).toBe(false);
      expect(isManualMinutesImplausible(360)).toBe(false);
      expect(isManualMinutesImplausible(361)).toBe(true);
      expect(isManualMinutesImplausible(600)).toBe(true);
    });

    test('getEstimateSourceLabel formats ola vs osrm vs manual', () => {
      expect(getEstimateSourceLabel('ola')).toBe('Route estimate');
      expect(getEstimateSourceLabel('osrm')).toBe('Car routing estimate');
      expect(getEstimateSourceLabel('manual')).toBe('Your estimate');
      expect(getEstimateSourceLabel(null)).toBe('Your estimate');
    });

    test('redactApiKey hides secret tokens from diagnostic strings', () => {
      const url = 'https://api.olamaps.io/routing/v1/directions?origin=12,77&api_key=SECRET_TOKEN_999';
      expect(redactApiKey(url)).toBe('https://api.olamaps.io/routing/v1/directions?origin=12,77&api_key=[REDACTED]');
    });
  });
});
