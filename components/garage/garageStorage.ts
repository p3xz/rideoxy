import * as FileSystem from 'expo-file-system/legacy';
import { getDatabase } from '../../database/database';
import { getSetting, setSetting, getBikeName, setBikeName } from '../../database/settingsRepository';

export const GARAGE_STORAGE_KEY = 'garage_motorcycles_v1';

export interface GarageMotorcycle {
  id: string;
  name: string;
  category?: string;
  engineCc?: number | null;
  odometerKm?: number | null;
  purchaseDate?: string | null;
  photo_uri?: string | null;
  imageUri?: string | null;
  isDefault: boolean;
  createdAt: number;
}

interface RawMotorcycleRow {
  id: string;
  name: string;
  category: string | null;
  engine_cc: number | null;
  odometer_km: number | null;
  purchase_date: string | null;
  photo_uri: string | null;
  is_default: number;
  created_at: number;
}

function mapRowToMotorcycle(row: RawMotorcycleRow): GarageMotorcycle {
  return {
    id: row.id,
    name: row.name,
    category: row.category ?? undefined,
    engineCc: row.engine_cc !== null ? Number(row.engine_cc) : null,
    odometerKm: row.odometer_km !== null ? Number(row.odometer_km) : null,
    purchaseDate: row.purchase_date ?? null,
    photo_uri: row.photo_uri ?? null,
    imageUri: row.photo_uri ?? null,
    isDefault: row.is_default === 1,
    createdAt: Number(row.created_at) || Date.now(),
  };
}

/**
 * Deletes a locally stored motorcycle photo file if present.
 */
export async function deleteBikePhotoFile(photoUri?: string | null): Promise<void> {
  if (!photoUri || typeof photoUri !== 'string') return;
  try {
    await FileSystem.deleteAsync(photoUri, { idempotent: true });
  } catch (err) {
    console.warn('[Rideoxy] Notice deleting bike photo file:', err);
  }
}

/**
 * Copies a picked image from temporary cache into `FileSystem.documentDirectory + 'bikes/<id>.jpg'`
 * and deletes any previous photo file if being replaced.
 */
export async function persistBikePhotoFile(
  bikeId: string,
  sourceUri: string,
  previousPhotoUri?: string | null
): Promise<string> {
  const docDir = FileSystem.documentDirectory;
  if (!docDir) {
    return sourceUri;
  }

  const bikesDir = `${docDir}bikes/`;
  const targetUri = `${docDir}bikes/${bikeId}.jpg`;

  if (sourceUri === targetUri) {
    return targetUri;
  }

  try {
    const dirInfo = await FileSystem.getInfoAsync(bikesDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(bikesDir, { intermediates: true });
    }

    if (previousPhotoUri && previousPhotoUri !== sourceUri) {
      await deleteBikePhotoFile(previousPhotoUri);
    } else {
      await deleteBikePhotoFile(targetUri);
    }

    await FileSystem.copyAsync({
      from: sourceUri,
      to: targetUri,
    });

    return targetUri;
  } catch (err) {
    console.warn('[Rideoxy] Falling back to source photo URI after copy notice:', err);
    return sourceUri;
  }
}

/**
 * Loads saved motorcycles from the SQLite `motorcycles` table, seamlessly migrating
 * any existing records from `app_settings` (`garage_motorcycles_v1` or `bike_name`).
 */
export async function loadGarageMotorcycles(): Promise<GarageMotorcycle[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<RawMotorcycleRow>(
    'SELECT * FROM motorcycles ORDER BY is_default DESC, created_at ASC;'
  );

  if (rows && rows.length > 0) {
    const list = rows.map(mapRowToMotorcycle);
    if (!list.some((b) => b.isDefault)) {
      list[0].isDefault = true;
    }
    const defaultBike = list.find((b) => b.isDefault) || list[0];
    const currentLegacy = await getBikeName();
    if (defaultBike.name !== currentLegacy) {
      await setBikeName(defaultBike.name);
    }
    return list;
  }

  // Migrate from app_settings if `motorcycles` table is currently empty
  const [rawJson, legacyBikeName] = await Promise.all([
    getSetting(GARAGE_STORAGE_KEY),
    getBikeName(),
  ]);

  const trimmedLegacy = (legacyBikeName || '').trim();
  let migrated: GarageMotorcycle[] = [];

  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed)) {
        migrated = parsed
          .filter(
            (item): item is GarageMotorcycle =>
              item &&
              typeof item === 'object' &&
              typeof item.name === 'string' &&
              item.name.trim().length > 0
          )
          .map((item) => ({
            ...item,
            photo_uri: item.photo_uri ?? item.imageUri ?? null,
            imageUri: item.photo_uri ?? item.imageUri ?? null,
          }));
      }
    } catch (err) {
      console.warn('[Rideoxy] Failed to parse garage_motorcycles_v1 JSON:', err);
    }
  }

  if (migrated.length === 0 && trimmedLegacy) {
    migrated = [
      {
        id: 'default',
        name: trimmedLegacy,
        photo_uri: null,
        imageUri: null,
        isDefault: true,
        createdAt: Date.now(),
      },
    ];
  }

  if (migrated.length > 0) {
    return saveGarageMotorcycles(migrated);
  }

  return [];
}

/**
 * Persists the motorcycle list to the SQLite `motorcycles` table and synchronizes
 * `bike_name` and `garage_motorcycles_v1` in `app_settings`.
 */
export async function saveGarageMotorcycles(
  motorcycles: GarageMotorcycle[]
): Promise<GarageMotorcycle[]> {
  const db = await getDatabase();
  const normalized = motorcycles
    .map((b) => {
      const resolvedPhoto = b.photo_uri !== undefined ? b.photo_uri : (b.imageUri ?? null);
      return {
        ...b,
        name: b.name.trim(),
        category: b.category?.trim() || undefined,
        purchaseDate: b.purchaseDate?.trim() || undefined,
        photo_uri: resolvedPhoto,
        imageUri: resolvedPhoto,
      };
    })
    .filter((b) => b.name.length > 0);

  if (normalized.length > 0 && !normalized.some((b) => b.isDefault)) {
    normalized[0].isDefault = true;
  }

  await db.runAsync('DELETE FROM motorcycles;');
  for (const bike of normalized) {
    await db.runAsync(
      `INSERT OR REPLACE INTO motorcycles (
        id, name, category, engine_cc, odometer_km, purchase_date, photo_uri, is_default, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        bike.id,
        bike.name,
        bike.category ?? null,
        bike.engineCc ?? null,
        bike.odometerKm ?? null,
        bike.purchaseDate ?? null,
        bike.photo_uri ?? null,
        bike.isDefault ? 1 : 0,
        bike.createdAt || Date.now(),
      ]
    );
  }

  const defaultBike = normalized.find((b) => b.isDefault) || normalized[0] || null;

  await Promise.all([
    setSetting(GARAGE_STORAGE_KEY, JSON.stringify(normalized)),
    setBikeName(defaultBike ? defaultBike.name : ''),
  ]);

  return normalized;
}

/**
 * Updates only the photo_uri for a specific motorcycle (or creates a default entry if empty).
 */
export async function updateMotorcyclePhotoUri(
  bikeId: string,
  newPhotoUri: string | null
): Promise<GarageMotorcycle[]> {
  const list = await loadGarageMotorcycles();
  const target = list.find((b) => b.id === bikeId);

  if (target) {
    const oldUri = target.photo_uri ?? target.imageUri;
    let finalUri: string | null = null;
    if (newPhotoUri) {
      finalUri = await persistBikePhotoFile(bikeId, newPhotoUri, oldUri);
    } else if (oldUri) {
      await deleteBikePhotoFile(oldUri);
    }
    const updated = list.map((b) =>
      b.id === bikeId
        ? { ...b, photo_uri: finalUri, imageUri: finalUri }
        : b
    );
    return saveGarageMotorcycles(updated);
  }

  return list;
}

/**
 * Returns the default motorcycle's saved `photo_uri` if one exists.
 */
export async function getDefaultBikePhotoUri(): Promise<string | null> {
  try {
    const list = await loadGarageMotorcycles();
    const def = list.find((b) => b.isDefault) || list[0];
    return def?.photo_uri ?? def?.imageUri ?? null;
  } catch {
    return null;
  }
}

/**
 * Formats distance numbers cleanly matching the prototype (e.g., 12,480 or 2.6 or 0).
 */
export function formatGarageDistance(km: number): string {
  if (!Number.isFinite(km) || km <= 0) return '0';
  if (km < 100 && Math.round(km * 10) % 10 !== 0) {
    return km.toFixed(1);
  }
  return Math.round(km).toLocaleString('en-US');
}

/**
 * Resolves the most accurate real odometer value for a motorcycle without inventing data.
 */
export function resolveMotorcycleOdometerKm(
  bike: GarageMotorcycle | null,
  latestFuelOdometerKm: number | null,
  totalRideDistanceKm: number
): number | null {
  if (bike?.odometerKm != null && Number.isFinite(bike.odometerKm) && bike.odometerKm >= 0) {
    if (latestFuelOdometerKm != null && latestFuelOdometerKm > bike.odometerKm) {
      return latestFuelOdometerKm;
    }
    return bike.odometerKm;
  }
  if (latestFuelOdometerKm != null && latestFuelOdometerKm > 0) {
    return latestFuelOdometerKm;
  }
  if (totalRideDistanceKm > 0) {
    return totalRideDistanceKm;
  }
  return null;
}
