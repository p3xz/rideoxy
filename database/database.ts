import * as SQLite from 'expo-sqlite';
import {
  CREATE_RIDES_TABLE,
  CREATE_TRACK_POINTS_TABLE,
  CREATE_SETTINGS_TABLE,
  CREATE_FUEL_LOGS_TABLE,
  CREATE_INDEXES,
} from './schema';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let dbInstance: SQLite.SQLiteDatabase | null = null;

export const DB_NAME = 'rideoxy.db';

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  if (!dbPromise) {
    dbPromise = (async () => {
      try {
        const db = await SQLite.openDatabaseAsync(DB_NAME);
        if (!db) {
          throw new Error('SQLite.openDatabaseAsync returned null or undefined');
        }
        await initDatabase(db);
        dbInstance = db;
        return db;
      } catch (err) {
        console.error('[rideoxy] [DB] Fatal error opening or initializing database:', err);
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

  const db = SQLite.openDatabaseSync(DB_NAME);
  initDatabaseSync(db);
  dbInstance = db;
  return db;
}

async function initDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  // Enable foreign keys and WAL mode for better concurrency and data integrity
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  await db.execAsync(CREATE_RIDES_TABLE);
  await db.execAsync(CREATE_TRACK_POINTS_TABLE);
  await db.execAsync(CREATE_SETTINGS_TABLE);
  await db.execAsync(CREATE_FUEL_LOGS_TABLE);
  await db.execAsync(CREATE_INDEXES);
}

function initDatabaseSync(db: SQLite.SQLiteDatabase): void {
  db.execSync('PRAGMA journal_mode = WAL;');
  db.execSync('PRAGMA foreign_keys = ON;');

  db.execSync(CREATE_RIDES_TABLE);
  db.execSync(CREATE_TRACK_POINTS_TABLE);
  db.execSync(CREATE_SETTINGS_TABLE);
  db.execSync(CREATE_FUEL_LOGS_TABLE);
  db.execSync(CREATE_INDEXES);
}

