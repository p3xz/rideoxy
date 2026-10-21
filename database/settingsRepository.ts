import { getDatabase } from './database';

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    [key]
  );
  return row ? row.value : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
    [key, value]
  );
}

export async function getBikeName(): Promise<string> {
  const bike = await getSetting('bike_name');
  return bike || '';
}

export async function setBikeName(name: string): Promise<void> {
  await setSetting('bike_name', name.trim());
}

export const EXPERIMENTAL_FEATURES_KEY = 'experimental_features_enabled';

export async function isExperimentalEnabled(): Promise<boolean> {
  const val = await getSetting(EXPERIMENTAL_FEATURES_KEY);
  return val === 'true';
}

export async function setExperimentalEnabled(enabled: boolean): Promise<void> {
  await setSetting(EXPERIMENTAL_FEATURES_KEY, enabled ? 'true' : 'false');
}
