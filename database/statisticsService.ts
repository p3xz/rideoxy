import { getDatabase } from './database';
import { OverallStatistics, HomeStatistics, PersonalRecords } from '../types/statistics';
import { Ride } from '../types/ride';

/**
 * Service to calculate riding statistics dynamically from SQLite records.
 * Whenever a ride is saved or deleted, these queries ensure 100% accurate,
 * real-time recalculation without relying on cached or hardcoded counters.
 */

export async function getOverallStatistics(): Promise<OverallStatistics> {
  const db = await getDatabase();

  // Get current month start in ms
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const aggregateRow = await db.getFirstAsync<{
    total_distance: number | null;
    total_rides: number | null;
    total_duration: number | null;
    total_moving_time: number | null;
    top_speed: number | null;
    longest_distance: number | null;
    longest_duration: number | null;
  }>(`
    SELECT 
      SUM(distance) as total_distance,
      COUNT(*) as total_rides,
      SUM(duration) as total_duration,
      SUM(moving_time) as total_moving_time,
      MAX(max_speed) as top_speed,
      MAX(distance) as longest_distance,
      MAX(duration) as longest_duration
    FROM rides 
    WHERE status = 'completed';
  `);

  const monthRow = await db.getFirstAsync<{ month_distance: number | null }>(`
    SELECT SUM(distance) as month_distance
    FROM rides
    WHERE status = 'completed' AND start_time >= ?;
  `, [startOfMonth]);


  const totalDistance = aggregateRow?.total_distance ?? 0.0;
  const totalRides = aggregateRow?.total_rides ?? 0;
  const totalDuration = aggregateRow?.total_duration ?? 0;
  const totalMovingTime = aggregateRow?.total_moving_time ?? 0;
  const topSpeed = aggregateRow?.top_speed ?? 0.0;
  const longestDistance = aggregateRow?.longest_distance ?? 0.0;
  const longestDuration = aggregateRow?.longest_duration ?? 0;
  const thisMonthDistance = monthRow?.month_distance ?? 0.0;

  // Overall average speed: Total distance / total moving hours
  let overallAverageSpeed = 0.0;
  if (totalMovingTime > 0) {
    overallAverageSpeed = totalDistance / (totalMovingTime / 3600);
  } else if (totalRides > 0 && totalDuration > 0) {
    overallAverageSpeed = totalDistance / (totalDuration / 3600);
  }

  const averageRideDistance = totalRides > 0 ? totalDistance / totalRides : 0.0;

  return {
    totalDistanceKm: Math.round(totalDistance * 10) / 10,
    totalRidesCount: totalRides,
    totalDurationSeconds: totalDuration,
    totalMovingTimeSeconds: totalMovingTime,
    overallAverageSpeedKmh: Math.round(overallAverageSpeed * 10) / 10,
    topSpeedKmh: Math.round(topSpeed * 10) / 10,
    longestRideDistanceKm: Math.round(longestDistance * 10) / 10,
    longestRideDurationSeconds: longestDuration,
    averageRideDistanceKm: Math.round(averageRideDistance * 10) / 10,
    thisMonthDistanceKm: Math.round(thisMonthDistance * 10) / 10,
  };
}

export async function getHomeStatistics(): Promise<HomeStatistics> {
  const overall = await getOverallStatistics();
  return {
    thisMonthKm: overall.thisMonthDistanceKm,
    totalKm: overall.totalDistanceKm,
    totalRides: overall.totalRidesCount,
    topSpeedKmh: overall.topSpeedKmh,
    avgSpeedKmh: overall.overallAverageSpeedKmh,
  };
}

export async function getPersonalRecords(): Promise<PersonalRecords> {
  const db = await getDatabase();

  const topSpeedRide = await db.getFirstAsync<Ride>(`
    SELECT * FROM rides 
    WHERE status = 'completed' AND max_speed > 0 
    ORDER BY max_speed DESC, start_time DESC LIMIT 1;
  `);

  const longestDistanceRide = await db.getFirstAsync<Ride>(`
    SELECT * FROM rides 
    WHERE status = 'completed' AND distance > 0 
    ORDER BY distance DESC, start_time DESC LIMIT 1;
  `);

  const longestDurationRide = await db.getFirstAsync<Ride>(`
    SELECT * FROM rides 
    WHERE status = 'completed' AND duration > 0 
    ORDER BY duration DESC, start_time DESC LIMIT 1;
  `);

  const highestAvgSpeedRide = await db.getFirstAsync<Ride>(`
    SELECT * FROM rides 
    WHERE status = 'completed' AND average_speed > 0 AND distance > 2.0
    ORDER BY average_speed DESC, start_time DESC LIMIT 1;
  `);

  return {
    topSpeedKmh: topSpeedRide ? Math.round(topSpeedRide.max_speed * 10) / 10 : 0.0,
    topSpeedRideId: topSpeedRide?.id ?? null,
    longestDistanceKm: longestDistanceRide ? Math.round(longestDistanceRide.distance * 10) / 10 : 0.0,
    longestDistanceRideId: longestDistanceRide?.id ?? null,
    longestDurationSeconds: longestDurationRide?.duration ?? 0,
    longestDurationRideId: longestDurationRide?.id ?? null,
    highestAverageSpeedKmh: highestAvgSpeedRide ? Math.round(highestAvgSpeedRide.average_speed * 10) / 10 : 0.0,
    highestAverageSpeedRideId: highestAvgSpeedRide?.id ?? null,
  };
}
