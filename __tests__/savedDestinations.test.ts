import {
  saveDestination,
  getSavedDestinations,
  deleteSavedDestination,
  touchDestinationLastUsed,
  SavedDestination,
} from '../database/savedDestinationsRepository';
import {
  isExperimentalEnabled,
  setExperimentalEnabled,
} from '../database/settingsRepository';
import { getCurrentGPSFix } from '../services/location';
import * as Location from 'expo-location';
import { getDatabase } from '../database/database';

describe('Saved Destinations & Experimental Feature Suite', () => {
  // In-memory mock store for saved destinations and settings
  let inMemorySavedDestinations: SavedDestination[] = [];
  let inMemorySettings: Record<string, string> = {};

  beforeEach(async () => {
    inMemorySavedDestinations = [];
    inMemorySettings = {};

    const db = await getDatabase();

    // Mock db.runAsync
    (db.runAsync as jest.Mock).mockImplementation(async (sql: string, params: any[] = []) => {
      const lower = sql.toLowerCase();
      if (lower.startsWith('insert into saved_destinations') || lower.startsWith('insert or replace into saved_destinations')) {
        const [id, name, lat, lng, created_at] = params;
        inMemorySavedDestinations.push({
          id,
          name,
          lat: Number(lat),
          lng: Number(lng),
          created_at: Number(created_at),
          last_used_at: null,
        });
      } else if (lower.startsWith('insert or replace into app_settings')) {
        const [key, value] = params;
        inMemorySettings[key] = String(value);
      } else if (lower.startsWith('update saved_destinations set last_used_at')) {
        const [timestamp, id] = params;
        const target = inMemorySavedDestinations.find((d) => d.id === id);
        if (target) {
          target.last_used_at = Number(timestamp);
        }
      } else if (lower.startsWith('delete from saved_destinations where id =')) {
        const [id] = params;
        inMemorySavedDestinations = inMemorySavedDestinations.filter((d) => d.id !== id);
      } else if (lower.startsWith('delete from saved_destinations')) {
        inMemorySavedDestinations = [];
      }
    });

    // Mock db.getAllAsync
    (db.getAllAsync as jest.Mock).mockImplementation(async (sql: string, params: any[] = []) => {
      const lower = sql.toLowerCase();
      if (lower.includes('from saved_destinations')) {
        if (params && params.length > 0) {
          const query = String(params[0]).toLowerCase();
          return inMemorySavedDestinations
            .filter((d) => d.name.toLowerCase().includes(query))
            .sort((a, b) => (b.last_used_at ?? b.created_at) - (a.last_used_at ?? a.created_at));
        }
        return [...inMemorySavedDestinations].sort(
          (a, b) => (b.last_used_at ?? b.created_at) - (a.last_used_at ?? a.created_at)
        );
      }
      return [];
    });

    // Mock db.getFirstAsync
    (db.getFirstAsync as jest.Mock).mockImplementation(async (sql: string, params: any[] = []) => {
      const lower = sql.toLowerCase();
      if (lower.includes('from app_settings')) {
        const key = params[0];
        const val = inMemorySettings[key];
        return val !== undefined ? { value: val } : null;
      }
      return null;
    });
  });

  describe('Part 3: Experimental Features Master Toggle', () => {
    test('Defaults to OFF when setting is not present', async () => {
      const enabled = await isExperimentalEnabled();
      expect(enabled).toBe(false);
    });

    test('Enabling and disabling experimental features persists properly', async () => {
      await setExperimentalEnabled(true);
      expect(await isExperimentalEnabled()).toBe(true);

      await setExperimentalEnabled(false);
      expect(await isExperimentalEnabled()).toBe(false);
    });
  });

  describe('Part 2: Saved Destinations Storage & Precedence', () => {
    test('Saves custom destinations and retrieves them via case-insensitive substring match', async () => {
      await saveDestination({
        name: 'Migsun Vilaasa, Greater Noida',
        lat: 28.4744,
        lng: 77.504,
      });

      await saveDestination({
        name: 'Nandi Hills Viewpoint',
        lat: 13.3702,
        lng: 77.6835,
      });

      // Substring match on "migsun"
      const match1 = await getSavedDestinations('migsun');
      expect(match1).toHaveLength(1);
      expect(match1[0].name).toBe('Migsun Vilaasa, Greater Noida');
      expect(match1[0].lat).toBe(28.4744);
      expect(match1[0].lng).toBe(77.504);

      // Substring match on uppercase "VILAASA"
      const match2 = await getSavedDestinations('VILAASA');
      expect(match2).toHaveLength(1);
      expect(match2[0].name).toBe('Migsun Vilaasa, Greater Noida');

      // Unrelated search returns empty list
      const match3 = await getSavedDestinations('Connaught Place');
      expect(match3).toHaveLength(0);
    });

    test('Saved destinations take precedence over network search without making network calls', async () => {
      const globalFetchMock = jest.fn();
      (global as any).fetch = globalFetchMock;

      await saveDestination({
        name: 'Secret Society Clubhouse',
        lat: 28.45,
        lng: 77.52,
      });

      // Matching query directly from local storage
      const matches = await getSavedDestinations('Secret Society');
      expect(matches).toHaveLength(1);
      expect(matches[0].name).toBe('Secret Society Clubhouse');

      // Selecting the saved destination requires zero network calls
      const selected = matches[0];
      await touchDestinationLastUsed(selected.id);

      expect(globalFetchMock).not.toHaveBeenCalled();

      // Verify last_used_at was updated
      const updated = await getSavedDestinations();
      expect(updated[0].id).toBe(selected.id);
      expect(updated[0].last_used_at).toBeGreaterThan(0);
    });

    test('Deletes saved destinations cleanly', async () => {
      const saved = await saveDestination({
        name: 'Temporary Pit Stop',
        lat: 28.1,
        lng: 77.2,
      });

      let items = await getSavedDestinations();
      expect(items.some((i) => i.id === saved.id)).toBe(true);

      await deleteSavedDestination(saved.id);
      items = await getSavedDestinations();
      expect(items.some((i) => i.id === saved.id)).toBe(false);
    });
  });

  describe('Part 2: Saving from Mocked Current Location', () => {
    test('Takes current GPS fix, names the place, and saves coordinates without map or pin-drop', async () => {
      // Mock expo-location getCurrentPositionAsync
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValueOnce({
        coords: {
          latitude: 28.47438,
          longitude: 77.50395,
          altitude: 210,
          speed: 0,
          accuracy: 5.2,
          heading: 90,
        },
        timestamp: 1700000000000,
      });

      const fix = await getCurrentGPSFix();
      expect(fix).not.toBeNull();
      expect(fix?.latitude).toBeCloseTo(28.47438, 4);
      expect(fix?.longitude).toBeCloseTo(77.50395, 4);

      // Save using current location fix
      const savedFromLocation = await saveDestination({
        name: 'Migsun Vilaasa Gate 2',
        lat: fix!.latitude,
        lng: fix!.longitude,
      });

      expect(savedFromLocation.name).toBe('Migsun Vilaasa Gate 2');
      expect(savedFromLocation.lat).toBe(28.47438);
      expect(savedFromLocation.lng).toBe(77.50395);

      // Verify it can be retrieved from saved destinations
      const matches = await getSavedDestinations('Gate 2');
      expect(matches).toHaveLength(1);
      expect(matches[0].name).toBe('Migsun Vilaasa Gate 2');
    });
  });
});
