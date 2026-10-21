import {
  OsrmNominatimProvider,
  formatManualMinutesInWords,
  clampManualMinutes,
  isManualMinutesImplausible,
  getEstimateSourceLabel,
} from '../services/etaService';

describe('etaService', () => {
  let provider: OsrmNominatimProvider;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    provider = new OsrmNominatimProvider();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
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
      // Never retry on a NoRoute answer!
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
          // Snapped 1 km away from requested origin
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

  describe('Words Echo and Labels', () => {
    test('formatManualMinutesInWords correctly echoes back hours and minutes', () => {
      expect(formatManualMinutesInWords(100)).toBe('Expected time: 1 hour 40 minutes');
      expect(formatManualMinutesInWords(45)).toBe('Expected time: 45 minutes');
      expect(formatManualMinutesInWords(120)).toBe('Expected time: 2 hours');
      expect(formatManualMinutesInWords(1)).toBe('Expected time: 1 minute');
      expect(formatManualMinutesInWords(60)).toBe('Expected time: 1 hour');
    });

    test('isManualMinutesImplausible flags values over 6 hours (> 360 min)', () => {
      expect(isManualMinutesImplausible(120)).toBe(false);
      expect(isManualMinutesImplausible(360)).toBe(false);
      expect(isManualMinutesImplausible(361)).toBe(true);
      expect(isManualMinutesImplausible(600)).toBe(true);
    });

    test('getEstimateSourceLabel formats osrm vs manual', () => {
      expect(getEstimateSourceLabel('osrm')).toBe('Car routing estimate');
      expect(getEstimateSourceLabel('manual')).toBe('Your estimate');
      expect(getEstimateSourceLabel(null)).toBe('Your estimate');
    });
  });
});
