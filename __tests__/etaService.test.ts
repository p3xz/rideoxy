import {
  OlaMapsProvider,
  OsrmNominatimProvider,
  FallbackEtaProvider,
  resetOlaCircuitBreaker,
  clearAutocompleteCache,
  formatManualMinutesInWords,
  clampManualMinutes,
  isManualMinutesImplausible,
  getEstimateSourceLabel,
  redactApiKey,
} from '../services/etaService';

describe('etaService', () => {
  let originalFetch: typeof global.fetch;
  let originalApiKey: string | undefined;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalApiKey = process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY;
    resetOlaCircuitBreaker();
    clearAutocompleteCache();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY = originalApiKey;
    resetOlaCircuitBreaker();
    clearAutocompleteCache();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. OSRM & Nominatim Provider (Baseline / Fallback)
  // ──────────────────────────────────────────────────────────────────────────

  describe('OsrmNominatimProvider', () => {
    let provider: OsrmNominatimProvider;

    beforeEach(() => {
      provider = new OsrmNominatimProvider();
    });

    describe('Mode Guard', () => {
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

      test('Free ride mode makes zero network calls and rejects route ETA request', async () => {
        const fetchSpy = jest.fn();
        global.fetch = fetchSpy;

        const origin = { latitude: 12.9716, longitude: 77.5946 };
        const dest = { latitude: 13.3702, longitude: 77.6835 };

        const res = await provider.fetchRoute(origin, dest, 'free');
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error).toBe('mode_guard');
        }
        expect(fetchSpy).not.toHaveBeenCalled();
      });
    });

    describe('Nominatim Geocoding', () => {
      test('Success with recorded fixture: parses name, district, state, and coordinates', async () => {
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
        }
      });

      test('Empty results: returns typed not_found error', async () => {
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => [],
        });

        const res = await provider.searchDestination('NonExistentPlaceXYZ', 'destination');
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

      test('Malformed JSON: returns typed parse_error', async () => {
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => {
            throw new Error('Unexpected token < in JSON at position 0');
          },
        });

        const res = await provider.searchDestination('Mysore', 'destination');
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error).toBe('parse_error');
        }
      });
    });

    describe('OSRM Routing', () => {
      const origin = { latitude: 12.9716, longitude: 77.5946 };
      const dest = { latitude: 13.3702, longitude: 77.6835 };

      test('Success with recorded fixture: reads duration and distance', async () => {
        const fixture = {
          code: 'Ok',
          routes: [
            {
              duration: 3600, // 1 hour
              distance: 60000, // 60 km
            },
          ],
          waypoints: [
            { location: [77.5946, 12.9716], name: 'Start Point' },
            { location: [77.6835, 13.3702], name: 'End Point' },
          ],
        };

        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => fixture,
        });

        const res = await provider.fetchRoute(origin, dest, 'destination');
        expect(res.success).toBe(true);
        if (res.success) {
          expect(res.estimate.durationSec).toBe(3600);
          expect(res.estimate.distanceM).toBe(60000);
          expect(res.estimate.source).toBe('osrm');
          expect(res.estimate.isLowTrust).toBe(false);
        }
      });

      test('NoRoute: returns typed no_route without retry', async () => {
        const fetchSpy = jest.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            code: 'NoRoute',
            routes: [],
          }),
        });
        global.fetch = fetchSpy;

        const res = await provider.fetchRoute(origin, dest, 'destination');
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error).toBe('no_route');
        }
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      });

      test('Snapped waypoint far from requested (> 500m): marks isLowTrust = true', async () => {
        const fixture = {
          code: 'Ok',
          routes: [
            {
              duration: 2400,
              distance: 40000,
            },
          ],
          waypoints: [
            { location: [77.5946, 12.9806], name: 'Distant Waypoint' },
            { location: [77.6835, 13.3702], name: 'End Point' },
          ],
        };

        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => fixture,
        });

        const res = await provider.fetchRoute(origin, dest, 'destination');
        expect(res.success).toBe(true);
        if (res.success) {
          expect(res.estimate.isLowTrust).toBe(true);
        }
      });

      test('Timeout (AbortError): returns typed timeout error', async () => {
        global.fetch = jest.fn().mockImplementation(() => {
          const error = new Error('The user aborted a request.');
          error.name = 'AbortError';
          return Promise.reject(error);
        });

        const res = await provider.fetchRoute(origin, dest, 'destination');
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error).toBe('timeout');
        }
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Ola Maps Primary Provider
  // ──────────────────────────────────────────────────────────────────────────

  describe('OlaMapsProvider', () => {
    let olaProvider: OlaMapsProvider;
    const origin = { latitude: 12.9716, longitude: 77.5946 };
    const dest = { latitude: 13.3702, longitude: 77.6835 };

    beforeEach(() => {
      olaProvider = new OlaMapsProvider();
      process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY = 'test_ola_api_key_12345';
    });

    test('Free ride mode makes zero network calls and rejects search and routing', async () => {
      const fetchSpy = jest.fn();
      global.fetch = fetchSpy;

      const searchRes = await olaProvider.searchDestination('Nandi Hills', 'free');
      expect(searchRes.success).toBe(false);
      if (!searchRes.success) {
        expect(searchRes.error).toBe('mode_guard');
      }

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

      const searchRes = await olaProvider.searchDestination('Nandi Hills', 'destination');
      expect(searchRes.success).toBe(false);
      if (!searchRes.success) {
        expect(searchRes.error).toBe('not_available');
      }

      const routeRes = await olaProvider.fetchRoute(origin, dest, 'destination');
      expect(routeRes.success).toBe(false);
      if (!routeRes.success) {
        expect(routeRes.error).toBe('not_available');
      }

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    test('Autocomplete success with recorded fixture: parses predictions and geometry', async () => {
      const fixture = {
        predictions: [
          {
            place_id: 'ola_place_nandi',
            description: 'Nandi Hills, Chikkaballapura, Karnataka, India',
            structured_formatting: {
              main_text: 'Nandi Hills',
              secondary_text: 'Chikkaballapura, Karnataka, India',
            },
            geometry: {
              location: {
                lat: 13.3702,
                lng: 77.6835,
              },
            },
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => fixture,
      });

      const res = await olaProvider.searchDestination('Nandi', 'destination');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.results).toHaveLength(1);
        const item = res.results[0];
        expect(item.name).toBe('Nandi Hills');
        expect(item.lat).toBe(13.3702);
        expect(item.lng).toBe(77.6835);
        expect(item.source).toBe('ola');
      }
    });

    test('Autocomplete session caching: second identical query makes zero network calls', async () => {
      const fixture = {
        predictions: [
          {
            place_id: 'ola_1',
            description: 'Nandi Hills, Karnataka',
            geometry: { location: { lat: 13.37, lng: 77.68 } },
          },
        ],
      };

      const fetchSpy = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => fixture,
      });
      global.fetch = fetchSpy;

      const first = await olaProvider.searchDestination('nandi hills', 'destination');
      expect(first.success).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Repeat with same query
      const second = await olaProvider.searchDestination('nandi hills', 'destination');
      expect(second.success).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1); // Cached!
    });

    test('HTTP 429 trips circuit breaker and returns rate_limited', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Rate limit exceeded' }),
      });

      const res = await olaProvider.searchDestination('Bangalore', 'destination');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('rate_limited');
      }

      // Next call should be blocked by circuit breaker without network calls
      const fetchSpy = jest.fn();
      global.fetch = fetchSpy;
      const blockedRes = await olaProvider.searchDestination('Mysore', 'destination');
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

      // Subsequent call should immediately fail due to circuit breaker
      const nextRes = await olaProvider.fetchRoute(origin, dest, 'destination');
      expect(nextRes.success).toBe(false);
      if (!nextRes.success) {
        expect(nextRes.error).toBe('not_available');
      }
    });

    test('Routing success with recorded fixture: parses duration and distance', async () => {
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
          // Snapped endpoint ~1.1 km away in latitude
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
  // 3. FallbackEtaProvider (Chain: Ola -> OSM)
  // ──────────────────────────────────────────────────────────────────────────

  describe('FallbackEtaProvider', () => {
    let fallback: FallbackEtaProvider;
    const origin = { latitude: 12.9716, longitude: 77.5946 };
    const dest = { latitude: 13.3702, longitude: 77.6835 };

    beforeEach(() => {
      fallback = new FallbackEtaProvider();
    });

    test('When Ola key is present and Ola succeeds, returns Ola source without hitting OSM', async () => {
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
      // Should have called OSRM directly (1 call)
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    test('When Ola returns 429, trips circuit breaker and falls back to OSRM', async () => {
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
        // First call: Ola returns 429
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
  // 4. Utility Functions & Labels
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
      const url = 'https://api.olamaps.io/places/v1/autocomplete?input=test&api_key=SECRET_TOKEN_999';
      expect(redactApiKey(url)).toBe('https://api.olamaps.io/places/v1/autocomplete?input=test&api_key=[REDACTED]');
    });
  });
});
