import { getDatabase } from './database';

export interface SavedDestination {
  id: string;
  name: string;
  lat: number;
  lng: number;
  created_at: number;
  last_used_at: number | null;
}

interface RawSavedDestination {
  id: string;
  name: string;
  lat: number;
  lng: number;
  created_at: number;
  last_used_at: number | null;
}

function mapRow(row: RawSavedDestination): SavedDestination {
  return {
    id: row.id,
    name: row.name,
    lat: Number(row.lat),
    lng: Number(row.lng),
    created_at: Number(row.created_at),
    last_used_at: row.last_used_at !== null ? Number(row.last_used_at) : null,
  };
}

/**
 * Retrieve saved destinations. If a query string is provided, performs a
 * case-insensitive substring match on name, ordered by most recently used / created.
 */
export async function getSavedDestinations(filterQuery?: string): Promise<SavedDestination[]> {
  const db = await getDatabase();
  const trimmed = filterQuery?.trim();

  if (trimmed) {
    const rows = await db.getAllAsync<RawSavedDestination>(
      `SELECT id, name, lat, lng, created_at, last_used_at 
       FROM saved_destinations 
       WHERE LOWER(name) LIKE '%' || LOWER(?) || '%' 
       ORDER BY COALESCE(last_used_at, created_at) DESC`,
      [trimmed]
    );
    return (rows || []).map(mapRow);
  }

  const rows = await db.getAllAsync<RawSavedDestination>(
    `SELECT id, name, lat, lng, created_at, last_used_at 
     FROM saved_destinations 
     ORDER BY COALESCE(last_used_at, created_at) DESC`
  );
  return (rows || []).map(mapRow);
}

/**
 * Save a new destination with name and coordinates.
 */
export async function saveDestination(input: {
  name: string;
  lat: number;
  lng: number;
}): Promise<SavedDestination> {
  const db = await getDatabase();
  const id = `dest_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();
  const trimmedName = input.name.trim();

  await db.runAsync(
    `INSERT INTO saved_destinations (id, name, lat, lng, created_at, last_used_at)
     VALUES (?, ?, ?, ?, ?, NULL)`,
    [id, trimmedName, input.lat, input.lng, now]
  );

  return {
    id,
    name: trimmedName,
    lat: input.lat,
    lng: input.lng,
    created_at: now,
    last_used_at: null,
  };
}

/**
 * Update the last_used_at timestamp when a saved destination is selected for a ride.
 */
export async function touchDestinationLastUsed(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE saved_destinations SET last_used_at = ? WHERE id = ?',
    [Date.now(), id]
  );
}

/**
 * Delete a saved destination by ID.
 */
export async function deleteSavedDestination(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM saved_destinations WHERE id = ?', [id]);
}

/**
 * Delete all saved destinations (for testing and data reset).
 */
export async function deleteAllSavedDestinations(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM saved_destinations');
}
