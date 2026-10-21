export const CREATE_RIDES_TABLE = `
  CREATE TABLE IF NOT EXISTS rides (
    id TEXT PRIMARY KEY NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    duration INTEGER NOT NULL DEFAULT 0,
    moving_time INTEGER NOT NULL DEFAULT 0,
    distance REAL NOT NULL DEFAULT 0.0,
    average_speed REAL NOT NULL DEFAULT 0.0,
    max_speed REAL NOT NULL DEFAULT 0.0,
    status TEXT NOT NULL DEFAULT 'running',
    created_at INTEGER NOT NULL,
    ride_mode TEXT NOT NULL DEFAULT 'free',
    destination_name TEXT,
    destination_lat REAL,
    destination_lng REAL,
    estimated_duration_sec INTEGER,
    estimated_distance_m INTEGER,
    estimate_source TEXT
  );
`;

export const CREATE_TRACK_POINTS_TABLE = `
  CREATE TABLE IF NOT EXISTS track_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ride_id TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    altitude REAL,
    speed REAL,
    accuracy REAL,
    heading REAL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY(ride_id) REFERENCES rides(id) ON DELETE CASCADE
  );
`;

export const CREATE_SETTINGS_TABLE = `
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
`;

export const CREATE_FUEL_LOGS_TABLE = `
  CREATE TABLE IF NOT EXISTS fuel_logs (
    id TEXT PRIMARY KEY NOT NULL,
    vehicle_id TEXT NOT NULL DEFAULT 'default',
    odometer REAL NOT NULL,
    fuel_added_litres REAL NOT NULL,
    price_per_litre REAL NOT NULL,
    total_cost REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    fuel_type TEXT NOT NULL DEFAULT 'petrol',
    full_tank INTEGER NOT NULL DEFAULT 1,
    timestamp TEXT NOT NULL,
    input_mode TEXT NOT NULL DEFAULT 'litres',
    manually_adjusted INTEGER NOT NULL DEFAULT 0,
    note TEXT,
    created_at INTEGER NOT NULL
  );
`;

export const CREATE_MOTORCYCLES_TABLE = `
  CREATE TABLE IF NOT EXISTS motorcycles (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    engine_cc INTEGER,
    odometer_km REAL,
    purchase_date TEXT,
    photo_uri TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
`;

export const CREATE_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_track_points_ride_time ON track_points(ride_id, timestamp);
  CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
  CREATE INDEX IF NOT EXISTS idx_rides_created_at ON rides(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_fuel_logs_vehicle ON fuel_logs(vehicle_id);
  CREATE INDEX IF NOT EXISTS idx_fuel_logs_odometer ON fuel_logs(vehicle_id, odometer ASC);
  CREATE INDEX IF NOT EXISTS idx_fuel_logs_created_at ON fuel_logs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_motorcycles_default ON motorcycles(is_default DESC, created_at ASC);
`;

