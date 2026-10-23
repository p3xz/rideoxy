import React from 'react';

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({
    write: jest.fn().mockResolvedValue(undefined),
    uri: 'file:///cache/mock.gpx',
  })),
  Paths: {
    cache: 'file:///cache',
  },
}));

import { generateGPXString } from '../services/gpxExport';
import { formatDistance, formatDuration } from '../services/distance';
import { formatRideTime, formatNumber } from '../components/ui/format';
import { computeRangeStats, STATS_RANGES } from '../components/stats/rangeStats';
import { projectRoute } from '../components/ui/RouteThumb';
import { Ride, TrackPoint } from '../types/ride';

describe('Persona 6: History Hoarder Edge Case Testing Suite', () => {
  const baseRide: Ride = {
    id: 'test-ride-1',
    start_time: 1700000000000,
    end_time: 1700003600000,
    duration: 3600,
    moving_time: 3200,
    distance: 42.5,
    average_speed: 47.8,
    max_speed: 85.0,
    status: 'completed',
    created_at: 1700000000000,
    ride_mode: 'free',
  };

  describe('Scenario 1 & 2: Edge Case Rides in Detail Screen & Repositories', () => {
    test('Zero track points: pace calculation returns null/--', () => {
      const zeroRide: Ride = { ...baseRide, distance: 0, moving_time: 0 };
      const paceSecPerKm =
        zeroRide.distance > 0 && zeroRide.moving_time
          ? Math.round(zeroRide.moving_time / zeroRide.distance)
          : null;
      expect(paceSecPerKm).toBeNull();
      const paceDisplay = paceSecPerKm ? `${Math.floor(paceSecPerKm / 60)}` : '--';
      expect(paceDisplay).toBe('--');
    });

    test('3-second ride (0.01 km): pace calculation and duration formatting', () => {
      const shortRide: Ride = { ...baseRide, distance: 0.01, duration: 3, moving_time: 3 };
      const paceSecPerKm =
        shortRide.distance > 0 && shortRide.moving_time
          ? Math.round(shortRide.moving_time / shortRide.distance)
          : null;
      expect(paceSecPerKm).toBe(300); // 300 sec/km = 5 min/km
      const paceMinutes = Math.floor(paceSecPerKm! / 60);
      const paceSeconds = paceSecPerKm! % 60;
      const paceDisplay = `${paceMinutes}:${String(paceSeconds).padStart(2, '0')}`;
      expect(paceDisplay).toBe('5:00');

      // Duration formatting for 3s
      expect(formatDuration(3)).toBe('0m 03s');
      // Format ride time in Stats tab
      const rideTime = formatRideTime(3);
      expect(rideTime.value).toBe('1'); // Rounding bug: 3s is displayed as 1 min!
      expect(rideTime.unit).toBe('min');
    });

    test('NULL distance in formatDistance causes TypeError crash', () => {
      expect(() => {
        formatDistance(null as unknown as number, 'km');
      }).toThrow(TypeError);
    });

    test('NaN in formatDuration results in NaN output string', () => {
      const res = formatDuration(NaN);
      expect(res).toBe('NaNm NaNs');
    });

    test('projectRoute with 0 or 1 coordinates returns empty array cleanly without crashing', () => {
      expect(projectRoute([], 60, 11)).toEqual([]);
      expect(projectRoute([[77.59, 12.97]], 60, 11)).toEqual([]);
    });

    test('projectRoute with identical coordinates (0 span) returns empty array without crashing', () => {
      expect(
        projectRoute(
          [
            [77.59, 12.97],
            [77.59, 12.97],
          ],
          60,
          11
        )
      ).toEqual([]);
    });
  });

  describe('Scenario 3: GPX Export Edge Cases', () => {
    test('Zero track points produces valid GPX 1.1 structure with empty <trkseg>', async () => {
      const gpx = await generateGPXString(baseRide, []);
      expect(gpx).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(gpx).toContain('<gpx version="1.1"');
      expect(gpx).toContain('<trkseg>');
      expect(gpx).toContain('</trkseg>');
      expect(gpx).not.toContain('<trkpt');
    });

    test('3-second ride (0.01 km) loses distance precision in GPX description', async () => {
      const shortRide: Ride = { ...baseRide, distance: 0.01, duration: 3, moving_time: 3, max_speed: 12.4 };
      const pts: TrackPoint[] = [
        { id: 1, ride_id: shortRide.id, latitude: 12.97, longitude: 77.59, altitude: 900, speed: 3.4, accuracy: 3, heading: 0, timestamp: shortRide.start_time },
      ];
      const gpx = await generateGPXString(shortRide, pts);
      // Notice: 0.01 km is rounded to 0.0 km
      expect(gpx).toContain('Distance: 0.0 km');
      expect(gpx).toContain('Moving Time: 0 min');
    });

    test('Trackpoint with undefined altitude throws TypeError when calling toFixed', async () => {
      const badPt: any = {
        id: 1,
        ride_id: baseRide.id,
        latitude: 12.97,
        longitude: 77.59,
        altitude: undefined, // undefined !== null is TRUE!
        speed: 10,
        accuracy: 3,
        heading: 0,
        timestamp: baseRide.start_time,
      };
      await expect(generateGPXString(baseRide, [badPt])).rejects.toThrow(TypeError);
    });

    test('Trackpoint with undefined speed throws TypeError when calling toFixed', async () => {
      const badPt: any = {
        id: 1,
        ride_id: baseRide.id,
        latitude: 12.97,
        longitude: 77.59,
        altitude: 900,
        speed: undefined, // undefined !== null is TRUE!
        accuracy: 3,
        heading: 0,
        timestamp: baseRide.start_time,
      };
      await expect(generateGPXString(baseRide, [badPt])).rejects.toThrow(TypeError);
    });

    test('50,000 track points marathon ride generates GPX without stack overflow', async () => {
      const pts: TrackPoint[] = [];
      const startTime = baseRide.start_time;
      for (let i = 0; i < 50000; i++) {
        pts.push({
          id: i,
          ride_id: baseRide.id,
          latitude: 12.97 + i * 0.0001,
          longitude: 77.59 + i * 0.0001,
          altitude: 800 + (i % 100),
          speed: 15,
          accuracy: 3,
          heading: 90,
          timestamp: startTime + i * 600,
        });
      }
      const gpx = await generateGPXString(baseRide, pts);
      expect(gpx.length).toBeGreaterThan(5 * 1024 * 1024); // > 5MB
      expect(gpx).toContain('</trkseg>');
    });
  });

  describe('Scenario 5: 500 Rides Scale & Stats Aggregation', () => {
    test('computeRangeStats with 500 rides handles zeros and gaps without returning NaN', () => {
      const now = new Date(1700000000000);
      const rides: Ride[] = [];
      for (let i = 0; i < 500; i++) {
        rides.push({
          ...baseRide,
          id: `ride-${i}`,
          start_time: now.getTime() - i * 86400000,
          distance: i % 10 === 0 ? 0 : 15.5 + (i % 5),
          duration: 1800,
          moving_time: 1500,
        });
      }

      const stats = computeRangeStats(rides, STATS_RANGES['30d'], now);
      expect(Number.isFinite(stats.totalDistanceKm)).toBe(true);
      expect(Number.isFinite(stats.avgRideDistanceKm)).toBe(true);
      expect(Number.isFinite(stats.totalSeconds)).toBe(true);
      expect(Number.isNaN(stats.totalDistanceKm)).toBe(false);
      expect(Number.isNaN(stats.avgRideDistanceKm)).toBe(false);

      for (const pt of stats.series) {
        expect(Number.isFinite(pt.distanceKm)).toBe(true);
        expect(Number.isNaN(pt.distanceKm)).toBe(false);
      }
    });
  });
});
