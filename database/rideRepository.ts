import { getDatabase } from './database';
import { Ride, RideStatus, EstimateSource } from '../types/ride';

export async function createRide(ride: Ride): Promise<void> {
  const startTime = Date.now();
  console.log('[Rideoxy] [RideRepo] createRide: acquiring DB connection for rideId:', ride.id);
  const db = await getDatabase();
  console.log(`[Rideoxy] [RideRepo] createRide: inserting ride into database...`);
  await db.runAsync(
    `INSERT INTO rides (id, start_time, end_time, duration, moving_time, distance, average_speed, max_speed, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      ride.id,
      ride.start_time,
      ride.end_time ?? null,
      ride.duration,
      ride.moving_time,
      ride.distance,
      ride.average_speed,
      ride.max_speed,
      ride.status,
      ride.created_at,
    ]
  );
  console.log(`[Rideoxy] [RideRepo] createRide completed in ${Date.now() - startTime}ms`);
}

export async function updateRide(
  id: string,
  updates: Partial<Omit<Ride, 'id' | 'created_at'>>
): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (updates.end_time !== undefined) {
    fields.push('end_time = ?');
    values.push(updates.end_time);
  }
  if (updates.duration !== undefined) {
    fields.push('duration = ?');
    values.push(updates.duration);
  }
  if (updates.moving_time !== undefined) {
    fields.push('moving_time = ?');
    values.push(updates.moving_time);
  }
  if (updates.distance !== undefined) {
    fields.push('distance = ?');
    values.push(updates.distance);
  }
  if (updates.average_speed !== undefined) {
    fields.push('average_speed = ?');
    values.push(updates.average_speed);
  }
  if (updates.max_speed !== undefined) {
    fields.push('max_speed = ?');
    values.push(updates.max_speed);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }

  if (fields.length === 0) return;

  values.push(id);
  await db.runAsync(
    `UPDATE rides SET ${fields.join(', ')} WHERE id = ?;`,
    values
  );
}

export async function getRideById(id: string): Promise<Ride | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Ride>(
    `SELECT * FROM rides WHERE id = ?;`,
    [id]
  );
  return row ?? null;
}

export async function getActiveRide(): Promise<Ride | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Ride>(
    `SELECT * FROM rides WHERE status IN ('running', 'paused') ORDER BY start_time DESC LIMIT 1;`
  );
  return row ?? null;
}

export async function getAllCompletedRides(): Promise<Ride[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Ride>(
    `SELECT * FROM rides WHERE status = 'completed' ORDER BY start_time DESC;`
  );
  return rows;
}

export async function getRecentCompletedRides(limit: number = 5): Promise<Ride[]> {
  const startTime = Date.now();
  console.log(`[Rideoxy] [RideRepo] getRecentCompletedRides: acquiring DB for limit=${limit}...`);
  const db = await getDatabase();
  console.log(`[Rideoxy] [RideRepo] getRecentCompletedRides: executing query...`);
  const rows = await db.getAllAsync<Ride>(
    `SELECT * FROM rides WHERE status = 'completed' ORDER BY start_time DESC LIMIT ?;`,
    [limit]
  );
  console.log(`[Rideoxy] [RideRepo] getRecentCompletedRides: fetched ${rows.length} rows in ${Date.now() - startTime}ms`);
  return rows;
}

export async function deleteRide(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM track_points WHERE ride_id = ?;`, [id]);
  await db.runAsync(`DELETE FROM rides WHERE id = ?;`, [id]);
}

export async function deleteAllRides(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM track_points;`);
  await db.runAsync(`DELETE FROM rides;`);
}

export async function setRideEstimate(
  rideId: string,
  estimate: {
    estimated_duration_sec: number | null;
    estimated_distance_m: number | null;
    estimate_source: EstimateSource | null;
  }
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE rides
     SET estimated_duration_sec = ?, estimated_distance_m = ?, estimate_source = ?
     WHERE id = ?;`,
    [
      estimate.estimated_duration_sec,
      estimate.estimated_distance_m,
      estimate.estimate_source,
      rideId,
    ]
  );
}
