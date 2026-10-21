import { computeRoutePace, ENDPOINT_TOLERANCE_METERS } from '../services/paceService';
import { clampManualMinutes } from '../services/etaService';
import { Ride } from '../types/ride';

describe('paceService', () => {
  const baseDestinationRide: Partial<Ride> = {
    id: 'test_ride_1',
    ride_mode: 'destination',
    destination_name: 'Nandi Hills',
    destination_lat: 13.3702,
    destination_lng: 77.6835,
    estimate_source: 'osrm',
  };

  const exactEndpoint = {
    latitude: 13.3702,
    longitude: 77.6835,
  };

  test('Fixture 1: 75 min vs 36 min = 39 minutes faster, 52 percent ahead', () => {
    const ride: Partial<Ride> = {
      ...baseDestinationRide,
      estimated_duration_sec: 75 * 60, // 4500s
      duration: 36 * 60, // 2160s
      moving_time: 35 * 60,
    };

    const pace = computeRoutePace(ride, exactEndpoint);
    expect(pace.hasPace).toBe(true);
    expect(pace.verdictSuppressed).toBe(false);
    expect(pace.verdict).toBe('faster');
    expect(pace.deltaMinutes).toBe(39);
    expect(pace.percentAhead).toBe(52);
    expect(pace.verdictTitle).toBe('39 MINUTES FASTER');
    expect(pace.verdictDescription).toBe('You reached your destination 52% ahead of the estimated time.');
  });

  test('Fixture 2: 35 min vs 26 min = 9 minutes faster, 26 percent ahead', () => {
    const ride: Partial<Ride> = {
      ...baseDestinationRide,
      estimated_duration_sec: 35 * 60, // 2100s
      duration: 26 * 60, // 1560s
      moving_time: 25 * 60,
    };

    const pace = computeRoutePace(ride, exactEndpoint);
    expect(pace.hasPace).toBe(true);
    expect(pace.verdictSuppressed).toBe(false);
    expect(pace.verdict).toBe('faster');
    expect(pace.deltaMinutes).toBe(9);
    expect(pace.percentAhead).toBe(26);
    expect(pace.verdictTitle).toBe('9 MINUTES FASTER');
    expect(pace.verdictDescription).toBe('You reached your destination 26% ahead of the estimated time.');
  });

  test('Slower case: 30 min vs 40 min = 10 minutes slower, 33 percent behind', () => {
    const ride: Partial<Ride> = {
      ...baseDestinationRide,
      estimated_duration_sec: 30 * 60, // 1800s
      duration: 40 * 60, // 2400s
      moving_time: 38 * 60,
    };

    const pace = computeRoutePace(ride, exactEndpoint);
    expect(pace.hasPace).toBe(true);
    expect(pace.verdictSuppressed).toBe(false);
    expect(pace.verdict).toBe('slower');
    expect(pace.deltaMinutes).toBe(10);
    expect(pace.percentAhead).toBe(33);
    expect(pace.verdictTitle).toBe('10 MINUTES SLOWER');
    expect(pace.verdictDescription).toBe('You reached your destination 33% behind the estimated time.');
  });

  test('On-time case inside 2% dead band: 50 min vs 50.5 min', () => {
    const ride: Partial<Ride> = {
      ...baseDestinationRide,
      estimated_duration_sec: 50 * 60, // 3000s
      duration: Math.round(50.5 * 60), // 3030s (ratio = -30/3000 = -0.01, inside 2%)
      moving_time: 50 * 60,
    };

    const pace = computeRoutePace(ride, exactEndpoint);
    expect(pace.hasPace).toBe(true);
    expect(pace.verdictSuppressed).toBe(false);
    expect(pace.verdict).toBe('on_time');
    expect(pace.verdictTitle).toBe('RIGHT ON TIME');
    expect(pace.verdictDescription).toBe('You reached your destination right on time.');
  });

  test('Short-ride guard: estimated under 5 minutes (< 300s) shows minute difference only', () => {
    const ride: Partial<Ride> = {
      ...baseDestinationRide,
      estimated_duration_sec: 4 * 60, // 240s (< 300s)
      duration: 3 * 60, // 180s (1 min faster)
      moving_time: 3 * 60,
    };

    const pace = computeRoutePace(ride, exactEndpoint);
    expect(pace.hasPace).toBe(true);
    expect(pace.verdictSuppressed).toBe(false);
    expect(pace.verdict).toBe('faster');
    expect(pace.deltaMinutes).toBe(1);
    expect(pace.percentAhead).toBeNull();
    expect(pace.verdictTitle).toBe('1 MINUTE FASTER');
    expect(pace.verdictDescription).toBe('You reached your destination 1 minute ahead of the estimated time.');
  });

  test('Endpoint guard at 1.4 km (1400m): verdict shows', () => {
    // 1400m roughly 0.012 degrees latitude away
    const pointAt1400m = {
      latitude: 13.3702 + (1400 / 111320),
      longitude: 77.6835,
    };

    const ride: Partial<Ride> = {
      ...baseDestinationRide,
      estimated_duration_sec: 35 * 60,
      duration: 26 * 60,
      moving_time: 25 * 60,
    };

    const pace = computeRoutePace(ride, pointAt1400m);
    expect(pace.hasPace).toBe(true);
    expect(pace.verdictSuppressed).toBe(false);
    expect(pace.verdict).toBe('faster');
  });

  test('Endpoint guard at 1.6 km (1600m): verdict suppressed', () => {
    // 1600m roughly 0.0145 degrees latitude away
    const pointAt1600m = {
      latitude: 13.3702 + (1600 / 111320),
      longitude: 77.6835,
    };

    const ride: Partial<Ride> = {
      ...baseDestinationRide,
      estimated_duration_sec: 35 * 60,
      duration: 26 * 60,
      moving_time: 25 * 60,
    };

    const pace = computeRoutePace(ride, pointAt1600m);
    expect(pace.hasPace).toBe(true);
    expect(pace.verdictSuppressed).toBe(true);
    expect(pace.suppressReason).toBe('endpoint_missed');
    expect(pace.verdictTitle).toBe('ENDED SHORT OF DESTINATION');
  });

  test('Stop-gap trigger: moving time gap > 10 minutes (600s)', () => {
    const rideWithStopGap: Partial<Ride> = {
      ...baseDestinationRide,
      estimated_duration_sec: 60 * 60,
      duration: 60 * 60, // 3600s
      moving_time: 45 * 60, // 2700s (gap = 900s > 600s)
    };

    const pace = computeRoutePace(rideWithStopGap, exactEndpoint);
    expect(pace.hasStopGap).toBe(true);

    const rideWithoutStopGap: Partial<Ride> = {
      ...baseDestinationRide,
      estimated_duration_sec: 60 * 60,
      duration: 60 * 60, // 3600s
      moving_time: 55 * 60, // 3300s (gap = 300s <= 600s)
    };

    const paceNoGap = computeRoutePace(rideWithoutStopGap, exactEndpoint);
    expect(paceNoGap.hasStopGap).toBe(false);
  });

  test('Manual clamp boundaries: 1 minute through 12 hours (720 min)', () => {
    expect(clampManualMinutes(-5)).toBe(1);
    expect(clampManualMinutes(0)).toBe(1);
    expect(clampManualMinutes(1)).toBe(1);
    expect(clampManualMinutes(45)).toBe(45);
    expect(clampManualMinutes(720)).toBe(720);
    expect(clampManualMinutes(999)).toBe(720);
  });

  test('Mode guard: Free ride has no pace and never renders card', () => {
    const freeRide: Partial<Ride> = {
      id: 'free_ride',
      ride_mode: 'free',
      duration: 1800,
      moving_time: 1700,
    };

    const pace = computeRoutePace(freeRide, exactEndpoint);
    expect(pace.hasPace).toBe(false);
  });

  test('Sanity guards: rides ended within seconds (< 15s) suppress verdict', () => {
    const quickRide: Partial<Ride> = {
      ...baseDestinationRide,
      estimated_duration_sec: 1800,
      duration: 5, // 5 seconds
      moving_time: 0,
    };

    const pace = computeRoutePace(quickRide, exactEndpoint);
    expect(pace.hasPace).toBe(true);
    expect(pace.verdictSuppressed).toBe(true);
    expect(pace.suppressReason).toBe('too_short');
  });
});
