import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { UI } from '../../constants/ui';
import {
  CURRENCIES,
  CurrencyCode,
  DistanceUnit,
  VolumeUnit,
  FuelEfficiencyUnit,
  FuelPreferences,
  DEFAULT_FUEL_PREFERENCES,
} from '../../types/fuel';
import {
  getFuelPreferences,
  setFuelPreferences,
} from '../../database/fuelPreferencesRepository';
import { SegmentedPills } from '../ui/SegmentedPills';
import { SheetLabel } from '../ui/InfoSheet';

const DISTANCE_OPTIONS: { key: DistanceUnit; label: string }[] = [
  { key: 'km', label: 'Kilometres' },
  { key: 'mi', label: 'Miles' },
];
const VOLUME_OPTIONS: { key: VolumeUnit; label: string }[] = [
  { key: 'L', label: 'Litres' },
  { key: 'gal', label: 'Gallons' },
];
const EFFICIENCY_OPTIONS: { key: FuelEfficiencyUnit; label: string }[] = [
  { key: 'km/L', label: 'km/L' },
  { key: 'L/100km', label: 'L/100km' },
  { key: 'mpg (US)', label: 'mpg (US)' },
  { key: 'mpg (UK)', label: 'mpg (UK)' },
];
const CURRENCY_OPTIONS = (Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => ({
  key: code,
  label: `${CURRENCIES[code].symbol} ${code}`,
}));

const APPEARANCE_OPTIONS = [
  { key: 'dark', label: 'Dark (Default)' },
];

/** Units + currency + appearance controls. */
export const PreferencesPanel: React.FC<{ onChanged?: (prefs: FuelPreferences) => void }> = ({
  onChanged,
}) => {
  const [prefs, setPrefs] = useState<FuelPreferences>(DEFAULT_FUEL_PREFERENCES);

  useEffect(() => {
    let active = true;
    getFuelPreferences()
      .then((p) => active && setPrefs(p))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const update = async (patch: Partial<FuelPreferences>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    await setFuelPreferences(patch);
    onChanged?.(next);
  };

  return (
    <View>
      <SheetLabel>APPEARANCE</SheetLabel>
      <SegmentedPills
        options={APPEARANCE_OPTIONS}
        value="dark"
        onChange={() => {}}
      />
      <Text style={styles.note} maxFontSizeMultiplier={1.3}>
        Rideoxy is precision-crafted with a high-contrast dark cockpit theme optimized for night riding, OLED efficiency, and glare reduction. Light theme is disabled by design.
      </Text>

      <SheetLabel>DISTANCE UNIT</SheetLabel>
      <SegmentedPills
        options={DISTANCE_OPTIONS}
        value={prefs.distanceUnit}
        onChange={(k) => update({ distanceUnit: k })}
      />

      <SheetLabel>FUEL VOLUME UNIT</SheetLabel>
      <SegmentedPills
        options={VOLUME_OPTIONS}
        value={prefs.volumeUnit}
        onChange={(k) => update({ volumeUnit: k })}
      />

      <SheetLabel>FUEL EFFICIENCY UNIT</SheetLabel>
      <SegmentedPills
        wrap
        options={EFFICIENCY_OPTIONS}
        value={prefs.efficiencyUnit}
        onChange={(k) => update({ efficiencyUnit: k })}
      />

      <SheetLabel>DEFAULT CURRENCY (NEW ENTRIES)</SheetLabel>
      <SegmentedPills
        wrap
        options={CURRENCY_OPTIONS}
        value={prefs.currency}
        onChange={(k) => update({ currency: k })}
      />

      <SheetLabel>NOTIFICATIONS & PRIVACY</SheetLabel>
      <Text style={styles.note} maxFontSizeMultiplier={1.3}>
        Rideoxy never sends push notifications or marketing alerts. Everything runs strictly on your device.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  note: {
    color: UI.textSecondary,
    fontSize: 12.5,
    lineHeight: 18,
    paddingBottom: 8,
    marginTop: 2,
  },
});
