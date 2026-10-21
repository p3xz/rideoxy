import { FuelLog } from '../../types/fuel';
import { buildWindow, RangeSpec, sumIntoBuckets } from '../charts/chartMath';
import { convertLitresToGallons } from '../../services/fuelCalculation';
import { VolumeUnit } from '../../types/fuel';

export type FuelRangeKey = '7d' | '30d' | '6m';

/** 7d = daily, 30d = 5-day bins, 6m = monthly, so bars never get cramped. */
export const FUEL_RANGES: Record<FuelRangeKey, RangeSpec> = {
  '7d': { kind: 'days', count: 7, size: 1 },
  '30d': { kind: 'days', count: 6, size: 5 },
  '6m': { kind: 'months', count: 6, size: 0 },
};

export const FUEL_RANGE_OPTIONS: { key: FuelRangeKey; label: string }[] = [
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: '6m', label: 'Last 6 months' },
];

export interface FuelBarPoint {
  label: string;
  value: number;
}

/** Fuel volume per bucket in the user's volume unit (L or gal). */
export function computeFuelBars(
  logs: FuelLog[],
  range: FuelRangeKey,
  volumeUnit: VolumeUnit,
  now: Date = new Date()
): { bars: FuelBarPoint[]; hasData: boolean } {
  const win = buildWindow(FUEL_RANGES[range], now);
  const items = logs.map((l) => ({
    t: new Date(l.timestamp).getTime(),
    value: Number.isFinite(l.fuelAddedLitres) ? l.fuelAddedLitres : 0,
  }));
  const totals = sumIntoBuckets(items, win.buckets);
  const converted = totals.map((litres) => (volumeUnit === 'gal' ? convertLitresToGallons(litres) : litres));
  return {
    bars: win.buckets.map((b, i) => ({ label: b.label, value: converted[i] })),
    hasData: totals.some((t) => t > 0),
  };
}
