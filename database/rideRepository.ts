import { getDatabase } from './database';
import { Ride, RideStatus } from '../types/ride';

export async function createRide(ride: Ride): Promise<void> {
  const db = await getDatabase();
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
  const db = await getDatabase();
  const rows = await db.getAllAsync<Ride>(
    `SELECT * FROM rides WHERE status = 'completed' ORDER BY start_time DESC LIMIT ?;`,
    [limit]
  );
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
