import * as Localization from 'expo-localization';

export const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
export const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getDeviceLocale(): string {
  try {
    const locales = Localization.getLocales();
    return locales[0]?.languageTag || 'en-US';
  } catch {
    return 'en-US';
  }
}

/** Rounds to `maxDecimals`, trims trailing zeros and formats with device locale thousands/decimal separators. */
export function formatNumber(value: number, maxDecimals = 1): string {
  if (!Number.isFinite(value)) return '0';
  try {
    const locale = getDeviceLocale();
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: maxDecimals,
    }).format(value);
  } catch {
    const rounded = Number(value.toFixed(maxDecimals));
    return rounded.toLocaleString('en-US', { maximumFractionDigits: maxDecimals });
  }
}

export function formatShortDate(d: Date): string {
  try {
    const locale = getDeviceLocale();
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  } catch {
    return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }
}

export function formatTime(d: Date): string {
  try {
    const locale = getDeviceLocale();
    return new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(d);
  } catch {
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m} ${suffix}`;
  }
}

export function formatDateTime(d: Date): string {
  return `${formatShortDate(d)} · ${formatTime(d)}`;
}

/** Splits a duration in seconds into a display value + unit (min / h). */
export function formatRideTime(seconds: number): { value: string; unit: string } {
  if (!Number.isFinite(seconds) || seconds <= 0) return { value: '0', unit: 'min' };
  if (seconds < 3600) return { value: String(Math.max(1, Math.round(seconds / 60))), unit: 'min' };
  return { value: formatNumber(seconds / 3600, 1), unit: 'h' };
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole calendar days between two dates (DST safe). */
export function dayDiff(later: Date, earlier: Date): number {
  return Math.round((startOfDay(later).getTime() - startOfDay(earlier).getTime()) / DAY_MS);
}
