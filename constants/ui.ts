import { Colors } from './theme';

/** Shared UI tokens for the redesigned Fuel / Rides / Stats / Settings screens. */
export const UI = {
  screenPad: 20,
  cardBg: 'rgba(255,255,255,0.04)',
  cardBorder: 'rgba(255,255,255,0.08)',
  cardRadius: 20,
  hairline: 'rgba(255,255,255,0.07)',
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#94A098', // Lightened from #6B7280 for > 4.5:1 WCAG AA contrast against near-black
  accent: Colors.primary,
  accentSoft: 'rgba(99, 230, 164, 0.12)',
  accentBorder: 'rgba(99, 230, 164, 0.38)',
  positive: Colors.primary,
  negative: '#F87171',
  gridLine: 'rgba(255,255,255,0.06)',
  chartTop: Colors.primary,
  chartBottom: '#0F5A3C',
} as const;
