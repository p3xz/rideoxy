import * as SQLite from 'expo-sqlite';
import {
  CREATE_RIDES_TABLE,
  CREATE_TRACK_POINTS_TABLE,
  CREATE_SETTINGS_TABLE,
  CREATE_FUEL_LOGS_TABLE,
  CREATE_MOTORCYCLES_TABLE,
  CREATE_INDEXES,
} from './schema';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let dbInstance: SQLite.SQLiteDatabase | null = null;

export const DB_NAME = 'rideoxy.db';
export const LEGACY_DB_NAME = 'brovxi.db';

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  if (!dbPromise) {
    dbPromise = (async () => {
      console.log(`[Rideoxy] [DB] Opening database connection: "${DB_NAME}"`);
      const startTime = Date.now();
      try {
        const db = await SQLite.openDatabaseAsync(DB_NAME);
        if (!db) {
          throw new Error('SQLite.openDatabaseAsync returned null or undefined');
        }
        console.log(`[Rideoxy] [DB] Database connection established in ${Date.now() - startTime}ms. Initializing schema...`);
        await initDatabase(db);
        await migrateFromLegacyDatabaseIfPresent(db);
        console.log(`[Rideoxy] [DB] Database schema and PRAGMAs initialized successfully in ${Date.now() - startTime}ms total`);
        dbInstance = db;
        return db;
      } catch (err) {
        console.error('[Rideoxy] [DB] Fatal error opening or initializing database:', err);
        // Reset dbPromise on failure so subsequent attempts can retry rather than caching the rejected promise
        dbPromise = null;
        dbInstance = null;
        throw err;
      }
    })();
  }

  return dbPromise;
}

export function getDatabaseSync(): SQLite.SQLiteDatabase {
  if (dbInstance) {
    return dbInstance;
  }

  console.log(`[Rideoxy] [DB] Opening synchronous database connection: "${DB_NAME}"`);
  const db = SQLite.openDatabaseSync(DB_NAME);
  initDatabaseSync(db);
  dbInstance = db;
  return db;
}

async function initDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  console.log('[Rideoxy] [DB] Configuring WAL mode and foreign keys...');
  // Enable foreign keys and WAL mode for better concurrency and data integrity
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  console.log('[Rideoxy] [DB] Creating tables and indexes if not exists...');
  await db.execAsync(CREATE_RIDES_TABLE);
  await db.execAsync(CREATE_TRACK_POINTS_TABLE);
  await db.execAsync(CREATE_SETTINGS_TABLE);
  await db.execAsync(CREATE_FUEL_LOGS_TABLE);
  await db.execAsync(CREATE_MOTORCYCLES_TABLE);
  await ensureMotorcyclesPhotoUriColumn(db);
  await ensureRidesEtaColumns(db);
  await db.execAsync(CREATE_INDEXES);
  console.log('[Rideoxy] [DB] Tables and indexes ready');
}

/**
 * Safe migration: checks PRAGMA table_info(motorcycles) before adding `photo_uri TEXT`
 * so existing installations upgrade without losing data.
 */
async function ensureMotorcyclesPhotoUriColumn(db: SQLite.SQLiteDatabase): Promise<void> {
  try {
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(motorcycles);');
    const hasPhotoUri = Array.isArray(columns) && columns.some((c) => c.name === 'photo_uri');
    if (!hasPhotoUri) {
      await db.execAsync('ALTER TABLE motorcycles ADD COLUMN photo_uri TEXT;');
    }
  } catch (err) {
    console.warn('[Rideoxy] [DB] ensureMotorcyclesPhotoUriColumn check notice:', err);
  }
}


/**
 * Safe additive migration: checks PRAGMA table_info(rides) before adding ETA and destination columns
 * so existing installations upgrade without losing any data.
 */
async function ensureRidesEtaColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  try {
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(rides);');
    const existing = new Set((columns || []).map((c) => c.name));

    if (!existing.has('ride_mode')) {
      await db.execAsync("ALTER TABLE rides ADD COLUMN ride_mode TEXT NOT NULL DEFAULT 'free';");
    }
    if (!existing.has('destination_name')) {
      await db.execAsync('ALTER TABLE rides ADD COLUMN destination_name TEXT;');
    }
    if (!existing.has('destination_lat')) {
      await db.execAsync('ALTER TABLE rides ADD COLUMN destination_lat REAL;');
    }
    if (!existing.has('destination_lng')) {
      await db.execAsync('ALTER TABLE rides ADD COLUMN destination_lng REAL;');
    }
    if (!existing.has('estimated_duration_sec')) {
      await db.execAsync('ALTER TABLE rides ADD COLUMN estimated_duration_sec INTEGER;');
    }
    if (!existing.has('estimated_distance_m')) {
      await db.execAsync('ALTER TABLE rides ADD COLUMN estimated_distance_m INTEGER;');
    }
    if (!existing.has('estimate_source')) {
      await db.execAsync('ALTER TABLE rides ADD COLUMN estimate_source TEXT;');
    }
  } catch (err) {
    console.warn('[Rideoxy] [DB] ensureRidesEtaColumns check notice:', err);
  }
}

function ensureRidesEtaColumnsSync(db: SQLite.SQLiteDatabase): void {
  try {
    const columns = db.getAllSync<{ name: string }>('PRAGMA table_info(rides);');
    const existing = new Set((columns || []).map((c) => c.name));

    if (!existing.has('ride_mode')) {
      db.execSync("ALTER TABLE rides ADD COLUMN ride_mode TEXT NOT NULL DEFAULT 'free';");
    }
    if (!existing.has('destination_name')) {
      db.execSync('ALTER TABLE rides ADD COLUMN destination_name TEXT;');
    }
    if (!existing.has('destination_lat')) {
      db.execSync('ALTER TABLE rides ADD COLUMN destination_lat REAL;');
    }
    if (!existing.has('destination_lng')) {
      db.execSync('ALTER TABLE rides ADD COLUMN destination_lng REAL;');
    }
    if (!existing.has('estimated_duration_sec')) {
      db.execSync('ALTER TABLE rides ADD COLUMN estimated_duration_sec INTEGER;');
    }
    if (!existing.has('estimated_distance_m')) {
      db.execSync('ALTER TABLE rides ADD COLUMN estimated_distance_m INTEGER;');
    }
    if (!existing.has('estimate_source')) {
      db.execSync('ALTER TABLE rides ADD COLUMN estimate_source TEXT;');
    }
  } catch (err) {
    console.warn('[Rideoxy] [DB] ensureRidesEtaColumnsSync check notice:', err);
  }
}

function initDatabaseSync(db: SQLite.SQLiteDatabase): void {
  db.execSync('PRAGMA journal_mode = WAL;');
  db.execSync('PRAGMA foreign_keys = ON;');

  db.execSync(CREATE_RIDES_TABLE);
  db.execSync(CREATE_TRACK_POINTS_TABLE);
  db.execSync(CREATE_SETTINGS_TABLE);
  db.execSync(CREATE_FUEL_LOGS_TABLE);
  db.execSync(CREATE_MOTORCYCLES_TABLE);
  ensureRidesEtaColumnsSync(db);
  db.execSync(CREATE_INDEXES);
}

/**
 * Backwards compatibility: Seamlessly migrates existing user data from
 * legacy brovxi.db to rideoxy.db if upgrading on an existing device.
 */
async function migrateFromLegacyDatabaseIfPresent(db: SQLite.SQLiteDatabase): Promise<void> {
  try {
    const rideCountRow = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM rides;');
    if (rideCountRow && rideCountRow.count === 0) {
      let legacyDb: SQLite.SQLiteDatabase | null = null;
      try {
        legacyDb = await SQLite.openDatabaseAsync(LEGACY_DB_NAME);
        const legacyRides = await legacyDb.getAllAsync<any>('SELECT * FROM rides;');
        if (legacyRides && legacyRides.length > 0) {
          console.log(`[Rideoxy] [DB Migration] Found ${legacyRides.length} rides in legacy ${LEGACY_DB_NAME}. Migrating to ${DB_NAME}...`);
          for (const ride of legacyRides) {
            await db.runAsync(
              `INSERT OR IGNORE INTO rides (id, start_time, end_time, duration, moving_time, distance, average_speed, max_speed, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [ride.id, ride.start_time, ride.end_time, ride.duration, ride.moving_time, ride.distance, ride.average_speed, ride.max_speed, ride.status, ride.created_at]
            );
          }

          const legacyPoints = await legacyDb.getAllAsync<any>('SELECT * FROM track_points;');
          for (const pt of legacyPoints) {
            await db.runAsync(
              `INSERT OR IGNORE INTO track_points (id, ride_id, latitude, longitude, altitude, speed, accuracy, heading, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [pt.id, pt.ride_id, pt.latitude, pt.longitude, pt.altitude, pt.speed, pt.accuracy, pt.heading, pt.timestamp]
            );
          }

          const legacySettings = await legacyDb.getAllAsync<any>('SELECT * FROM app_settings;');
          for (const s of legacySettings) {
            await db.runAsync(
              `INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)`,
              [s.key, s.value]
            );
          }

          const legacyFuel = await legacyDb.getAllAsync<any>('SELECT * FROM fuel_logs;');
          for (const f of legacyFuel) {
            await db.runAsync(
              `INSERT OR IGNORE INTO fuel_logs (id, vehicle_id, odometer, fuel_added_litres, price_per_litre, total_cost, currency, fuel_type, full_tank, timestamp, input_mode, manually_adjusted, note, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [f.id, f.vehicle_id, f.odometer, f.fuel_added_litres, f.price_per_litre, f.total_cost, f.currency, f.fuel_type, f.full_tank, f.timestamp, f.input_mode, f.manually_adjusted, f.note, f.created_at]
            );
          }
          console.log('[Rideoxy] [DB Migration] Legacy data migration completed successfully.');
        }
      } catch {
        // No legacy database present or readable, which is expected for new installs
      } finally {
        if (legacyDb) {
          try {
            await legacyDb.closeAsync();
          } catch (_) {}
        }
      }
    }
  } catch (err) {
    console.warn('[Rideoxy] [DB Migration] Legacy migration check notice:', err);
  }
}

export async function getDatabaseSize(): Promise<number> {
  try {
    const db = await getDatabase();
    const pageCountRow = await db.getFirstAsync<{ page_count: number }>('PRAGMA page_count;');
    const pageSizeRow = await db.getFirstAsync<{ page_size: number }>('PRAGMA page_size;');
    const pageCount = pageCountRow?.page_count ?? 0;
    const pageSize = pageSizeRow?.page_size ?? 4096;
    return pageCount * pageSize;
  } catch {
    return 0;
  }
}
