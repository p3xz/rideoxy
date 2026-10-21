import {
  niceMax,
  axisTicks,
  smoothPath,
  roundedTopBarPath,
  buildWindow,
  sumIntoBuckets,
  labelStep,
} from '../components/charts/chartMath';
import { computeRangeStats, STATS_RANGES, percentDelta } from '../components/stats/rangeStats';
import { computeFuelBars } from '../components/fuel/fuelBars';
import { Ride } from '../types/ride';
import { FuelLog } from '../types/fuel';

const NOW = new Date(2026, 3, 12, 15, 0, 0); // Apr 12, 2026

function ride(daysAgo: number, km: number, seconds = 600): Ride {
  const t = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - daysAgo, 9, 0, 0).getTime();
  return {
    id: `r-${daysAgo}-${km}`,
    start_time: t,
    end_time: t + seconds * 1000,
    duration: seconds,
    moving_time: seconds,
    distance: km,
    average_speed: 40,
    max_speed: 80,
    status: 'completed',
    created_at: t,
  };
}

describe('chartMath', () => {
  test('niceMax rounds to 1/2/5/10 multiples and handles zero / invalid', () => {
    expect(niceMax(0)).toBe(5);
    expect(niceMax(-3)).toBe(5);
    expect(niceMax(NaN)).toBe(5);
    expect(niceMax(0.7)).toBe(1);
    expect(niceMax(3.2)).toBe(5);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(13)).toBe(20);
    expect(niceMax(41)).toBe(50);
    expect(niceMax(862)).toBe(1000);
  });

  test('axisTicks returns 0, half, max', () => {
    expect(axisTicks(10)).toEqual([0, 5, 10]);
  });

  test('smoothPath handles 0, 1 and many points without NaN', () => {
    expect(smoothPath([])).toBe('');
    expect(smoothPath([{ x: 5, y: 5 }])).toBe('M 5 5');
    const d = smoothPath([
      { x: 0, y: 10 },
      { x: 10, y: 0 },
      { x: 20, y: 10 },
    ]);
    expect(d.startsWith('M 0.00 10.00')).toBe(true);
    expect(d).not.toMatch(/NaN/);
  });

  test('roundedTopBarPath returns empty for zero height', () => {
    expect(roundedTopBarPath(0, 0, 10, 0, 4)).toBe('');
    expect(roundedTopBarPath(0, 0, 10, 20, 4)).not.toMatch(/NaN/);
  });

  test('labelStep thins labels on narrow plots', () => {
    expect(labelStep(1, 300)).toBe(1);
    expect(labelStep(12, 300)).toBeGreaterThan(1);
    expect(labelStep(7, 300)).toBe(2);
  });

  test('buildWindow creates contiguous buckets for each range', () => {
    const w7 = buildWindow(STATS_RANGES['7d'], NOW);
    expect(w7.buckets).toHaveLength(7);
    for (let i = 1; i < w7.buckets.length; i++) {
      expect(w7.buckets[i].start).toBe(w7.buckets[i - 1].end);
    }
    expect(NOW.getTime()).toBeGreaterThanOrEqual(w7.buckets[6].start);
    expect(NOW.getTime()).toBeLessThan(w7.buckets[6].end);
    expect(w7.prevEnd).toBe(w7.start);

    const w1y = buildWindow(STATS_RANGES['1y'], NOW);
    expect(w1y.buckets).toHaveLength(12);
    expect(w1y.buckets[11].label).toBe('Apr');
    expect(w1y.buckets[0].label).toBe('May');
  });

  test('sumIntoBuckets ignores out-of-window and non-finite values', () => {
    const w = buildWindow(STATS_RANGES['7d'], NOW);
    const totals = sumIntoBuckets(
      [
        { t: NOW.getTime(), value: 5 },
        { t: NOW.getTime(), value: NaN },
        { t: 0, value: 99 },
      ],
      w.buckets
    );
    expect(totals[6]).toBe(5);
    expect(totals.reduce((a, b) => a + b, 0)).toBe(5);
  });
});

describe('rangeStats', () => {
  test('empty rides: zeros, null deltas, no data, no NaN', () => {
    const s = computeRangeStats([], STATS_RANGES['30d'], NOW);
    expect(s.hasData).toBe(false);
    expect(s.totalDistanceKm).toBe(0);
    expect(s.avgRideDistanceKm).toBe(0);
    expect(s.deltas).toEqual({ distance: null, rides: null, avgDistance: null, time: null });
    expect(s.series).toHaveLength(10);
    expect(s.series.every((p) => p.distanceKm === 0)).toBe(true);
  });

  test('single ride: totals, avg equals distance, no deltas without prior data', () => {
    const s = computeRangeStats([ride(1, 20)], STATS_RANGES['7d'], NOW);
    expect(s.hasData).toBe(true);
    expect(s.totalRides).toBe(1);
    expect(s.totalDistanceKm).toBe(20);
    expect(s.avgRideDistanceKm).toBe(20);
    expect(s.deltas.distance).toBeNull();
    expect(s.series[5].distanceKm).toBe(20);
  });

  test('delta vs previous period', () => {
    const rides = [ride(1, 30), ride(2, 30), ride(9, 30)]; // 60 now vs 30 previous (7d)
    const s = computeRangeStats(rides, STATS_RANGES['7d'], NOW);
    expect(s.totalDistanceKm).toBe(60);
    expect(s.deltas.distance).toBeCloseTo(100, 5);
    expect(s.deltas.rides).toBeCloseTo(100, 5);
    expect(s.deltas.avgDistance).toBeCloseTo(0, 5);
  });

  test('percentDelta guards divide-by-zero', () => {
    expect(percentDelta(5, 0)).toBeNull();
    expect(percentDelta(NaN, 3)).toBeNull();
    expect(percentDelta(6, 3)).toBe(100);
  });

  test('zero-distance rides do not produce NaN', () => {
    const s = computeRangeStats([ride(1, 0, 0)], STATS_RANGES['7d'], NOW);
    expect(s.totalRides).toBe(1);
    expect(Number.isFinite(s.avgRideDistanceKm)).toBe(true);
    expect(s.totalSeconds).toBe(0);
  });
});

describe('fuel bars', () => {
  const base: FuelLog = {
    id: 'f1',
    vehicleId: 'default',
    odometer: 1000,
    fuelAddedLitres: 10,
    pricePerLitre: 100,
    totalCost: 1000,
    currency: 'INR',
    fuelType: 'petrol',
    fullTank: true,
    timestamp: new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - 1, 10).toISOString(),
    inputMode: 'litres',
    manuallyAdjusted: false,
    createdAt: 1,
  };

  test('no logs: no data', () => {
    const r = computeFuelBars([], '7d', 'L', NOW);
    expect(r.hasData).toBe(false);
    expect(r.bars).toHaveLength(7);
  });

  test('single log lands in one bucket and converts to gallons', () => {
    const l = computeFuelBars([base], '7d', 'L', NOW);
    expect(l.hasData).toBe(true);
    expect(l.bars.filter((b) => b.value > 0)).toHaveLength(1);
    expect(l.bars[5].value).toBe(10);
    const g = computeFuelBars([base], '7d', 'gal', NOW);
    expect(g.bars[5].value).toBeCloseTo(2.6417, 3);
  });

  test('30d groups into 6 bins and 6m into 6 months', () => {
    expect(computeFuelBars([base], '30d', 'L', NOW).bars).toHaveLength(6);
    expect(computeFuelBars([base], '6m', 'L', NOW).bars).toHaveLength(6);
  });
});
