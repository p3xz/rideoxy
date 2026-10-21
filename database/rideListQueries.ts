import { getDatabase } from './database';
import { Ride } from '../types/ride';

/**
 * Read-only query powering the My Rides list.
 * Returns completed rides plus rides still in progress (running / paused / interrupted).
 */
export async function getRidesForList(): Promise<Ride[]> {
  const db = await getDatabase();
  return db.getAllAsync<Ride>(
    `SELECT * FROM rides
     WHERE status IN ('completed', 'running', 'paused', 'interrupted', 'finishing')
     ORDER BY start_time DESC;`
  );
}
