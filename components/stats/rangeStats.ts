import { Ride } from '../../types/ride';
import { buildWindow, RangeSpec, sumIntoBuckets } from '../charts/chartMath';

export type StatsRangeKey = '7d' | '30d' | '6m' | '1y';

/** 7 Days = daily, 30 Days = every 3 days, 6 Months / 1 Year = monthly. */
export const STATS_RANGES: Record<StatsRangeKey, RangeSpec> = {
  '7d': { kind: 'days', count: 7, size: 1 },
  '30d': { kind: 'days', count: 10, size: 3 },
  '6m': { kind: 'months', count: 6, size: 0 },
  '1y': { kind: 'months', count: 12, size: 0 },
};

export const STATS_RANGE_OPTIONS: { key: StatsRangeKey; label: string }[] = [
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: '6m', label: '6 Months' },
  { key: '1y', label: '1 Year' },
];

export interface RangeSeriesPoint {
  label: string;
  tooltipLabel: string;
  /** Distance in km for the bucket. */
  distanceKm: number;
}

export interface RangeDeltas {
  distance: number | null;
  rides: number | null;
  avgDistance: number | null;
  time: number | null;
}

export interface RangeStats {
  totalDistanceKm: number;
  totalRides: number;
  avgRideDistanceKm: number;
  totalSeconds: number;
  deltas: RangeDeltas;
  series: RangeSeriesPoint[];
  hasData: boolean;
}

/** Percent change; `null` (hide chip) when there is no prior data to compare against. */
export function percentDelta(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

function rideSeconds(r: Ride): number {
  const s = r.moving_time > 0 ? r.moving_time : r.duration;
  return Number.isFinite(s) && s > 0 ? s : 0;
}

function rideKm(r: Ride): number {
  return Number.isFinite(r.distance) && r.distance > 0 ? r.distance : 0;
}

interface Totals {
  distance: number;
  rides: number;
  seconds: number;
}

function totalsFor(rides: Ride[], start: number, end: number): Totals {
  let distance = 0;
  let count = 0;
  let seconds = 0;
  for (const r of rides) {
    if (r.start_time >= start && r.start_time < end) {
      distance += rideKm(r);
      count += 1;
      seconds += rideSeconds(r);
    }
  }
  return { distance, rides: count, seconds };
}

/** Computes range totals, previous-period deltas and the distance trend series. Never returns NaN. */
export function computeRangeStats(completedRides: Ride[], spec: RangeSpec, now: Date = new Date()): RangeStats {
  const win = buildWindow(spec, now);
  const cur = totalsFor(completedRides, win.start, win.end);
  const prev = totalsFor(completedRides, win.prevStart, win.prevEnd);

  const avgCur = cur.rides > 0 ? cur.distance / cur.rides : 0;
  const avgPrev = prev.rides > 0 ? prev.distance / prev.rides : 0;

  const items = completedRides.map((r) => ({ t: r.start_time, value: rideKm(r) }));
  const perBucket = sumIntoBuckets(items, win.buckets);
  const series: RangeSeriesPoint[] = win.buckets.map((b, i) => ({
    label: b.label,
    tooltipLabel: b.tooltipLabel,
    distanceKm: perBucket[i],
  }));

  return {
    totalDistanceKm: cur.distance,
    totalRides: cur.rides,
    avgRideDistanceKm: avgCur,
    totalSeconds: cur.seconds,
    deltas: {
      distance: percentDelta(cur.distance, prev.distance),
      rides: percentDelta(cur.rides, prev.rides),
      avgDistance: percentDelta(avgCur, avgPrev),
      time: percentDelta(cur.seconds, prev.seconds),
    },
    series,
    hasData: cur.rides > 0,
  };
}
