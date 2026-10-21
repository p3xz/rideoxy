import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { UI } from '../../constants/ui';
import { Card } from './Card';
import { useAnimatedNumber } from '../../lib/motion';

interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  /** Percent change vs previous period. `null`/undefined hides the chip. */
  delta?: number | null;
}

export const DeltaChip: React.FC<{ delta: number }> = ({ delta }) => {
  const rounded = Math.round(Math.abs(delta));
  const up = delta > 0 && rounded > 0;
  const down = delta < 0 && rounded > 0;
  const color = up ? UI.positive : down ? UI.negative : UI.textMuted;
  const glyph = up ? '▲' : down ? '▼' : '–';
  return (
    <View style={[styles.chip, { backgroundColor: up ? UI.accentSoft : down ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.06)' }]}>
      <Text style={[styles.chipText, { color }]}>
        {glyph} {rounded}%
      </Text>
    </View>
  );
};

export const StatCard: React.FC<StatCardProps> = ({ label, value, unit, delta }) => {
  const animatedValue = useAnimatedNumber(value);

  return (
    <Card style={styles.card}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.valueRow}>
        <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {animatedValue}
        </Text>
      </View>
      {unit ? <Text style={styles.unit}>{unit}</Text> : <View style={{ height: 16 }} />}
      <View style={styles.deltaSlot}>
        {delta !== null && delta !== undefined && Number.isFinite(delta) ? <DeltaChip delta={delta} /> : null}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 124,
    justifyContent: 'flex-start',
  },
  label: {
    color: UI.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  valueRow: {
    marginTop: 10,
  },
  value: {
    color: UI.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    color: UI.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  deltaSlot: {
    marginTop: 8,
    height: 22,
    alignItems: 'flex-start',
  },
  chip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
