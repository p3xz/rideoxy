import { MONTHS_SHORT, MONTHS_LONG } from '../ui/format';

/**
 * Rounds a raw maximum up to a "nice" axis value (1, 2, 5, 10 × 10^n).
 * Zero / negative / non-finite input returns a sensible default of 5.
 */
export function niceMax(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 5;
  const exp = Math.floor(Math.log10(raw));
  const base = Math.pow(10, exp);
  const f = raw / base;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * base;
}

/** Y-axis tick values: 0, half, max (3 gridlines). */
export function axisTicks(max: number): number[] {
  return [0, max / 2, max];
}

export function formatAxisValue(v: number): string {
  if (!Number.isFinite(v)) return '0';
  if (Math.abs(v) >= 1000) return `${Number((v / 1000).toFixed(1))}k`;
  return String(Number(v.toFixed(1)));
}

/** Every Nth label index to render so labels never collide. */
export function labelStep(count: number, plotWidth: number, minLabelWidth = 46): number {
  if (count <= 1) return 1;
  const maxLabels = Math.max(1, Math.floor(plotWidth / minLabelWidth));
  return Math.max(1, Math.ceil(count / maxLabels));
}

/**
 * Smooth cubic-bezier path through points (Catmull-Rom → Bezier), with control point
 * y-values clamped between neighbours so the curve never overshoots below zero.
 */
export function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const t = 0.18;
    const lo = Math.min(p1.y, p2.y);
    const hi = Math.max(p1.y, p2.y);
    const c1y = Math.min(hi, Math.max(lo, p1.y + (p2.y - p0.y) * t));
    const c2y = Math.min(hi, Math.max(lo, p2.y - (p3.y - p1.y) * t));
    const c1x = p1.x + (p2.x - p0.x) * t;
    const c2x = p2.x - (p3.x - p1.x) * t;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

/** Bar with rounded top corners and a square base. */
export function roundedTopBarPath(x: number, y: number, w: number, h: number, radius: number): string {
  if (h <= 0 || w <= 0) return '';
  const r = Math.max(0, Math.min(radius, w / 2, h));
  return (
    `M ${x} ${y + h} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} ` +
    `L ${x + w - r} ${y} Q ${x + w} ${y} ${x + w} ${y + r} L ${x + w} ${y + h} Z`
  );
}

// ---------------------------------------------------------------------------
// Time bucketing
// ---------------------------------------------------------------------------

export interface TimeBucket {
  start: number; // inclusive ms
  end: number; // exclusive ms
  label: string; // axis label
  tooltipLabel: string; // tooltip date text
}

export interface RangeSpec {
  kind: 'days' | 'months';
  /** Number of buckets. */
  count: number;
  /** Days per bucket (days kind only). */
  size: number;
}

export interface RangeWindow {
  buckets: TimeBucket[];
  start: number;
  end: number;
  prevStart: number;
  prevEnd: number;
}

function dayLabel(d: Date): string {
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/** Builds contiguous buckets ending "now", plus the equally sized previous window for deltas. */
export function buildWindow(spec: RangeSpec, now: Date = new Date()): RangeWindow {
  const buckets: TimeBucket[] = [];

  if (spec.kind === 'days') {
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    for (let i = 0; i < spec.count; i++) {
      const startOffset = (spec.count - i) * spec.size - 1; // days before today
      const startDate = new Date(y, m, d - startOffset);
      const endDate = new Date(y, m, d - startOffset + spec.size);
      const lastDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - 1);
      buckets.push({
        start: startDate.getTime(),
        end: endDate.getTime(),
        label: dayLabel(startDate),
        tooltipLabel:
          spec.size === 1
            ? `${dayLabel(startDate)}, ${startDate.getFullYear()}`
            : `${dayLabel(startDate)} – ${dayLabel(lastDay)}`,
      });
    }
    const start = buckets[0].start;
    const end = buckets[buckets.length - 1].end;
    const prevStart = new Date(y, m, d - (spec.count * spec.size * 2 - 1)).getTime();
    return { buckets, start, end, prevStart, prevEnd: start };
  }

  const y = now.getFullYear();
  const m = now.getMonth();
  for (let i = 0; i < spec.count; i++) {
    const startDate = new Date(y, m - (spec.count - 1 - i), 1);
    const endDate = new Date(y, m - (spec.count - 1 - i) + 1, 1);
    buckets.push({
      start: startDate.getTime(),
      end: endDate.getTime(),
      label: MONTHS_SHORT[startDate.getMonth()],
      tooltipLabel: `${MONTHS_LONG[startDate.getMonth()]} ${startDate.getFullYear()}`,
    });
  }
  const start = buckets[0].start;
  const end = buckets[buckets.length - 1].end;
  const prevStart = new Date(y, m - (spec.count * 2 - 1), 1).getTime();
  return { buckets, start, end, prevStart, prevEnd: start };
}

/** Sums `value` of each item into the bucket containing its timestamp. */
export function sumIntoBuckets(
  items: { t: number; value: number }[],
  buckets: TimeBucket[]
): number[] {
  const totals = buckets.map(() => 0);
  for (const item of items) {
    if (!Number.isFinite(item.t) || !Number.isFinite(item.value)) continue;
    const idx = buckets.findIndex((b) => item.t >= b.start && item.t < b.end);
    if (idx >= 0) totals[idx] += item.value;
  }
  return totals;
}
