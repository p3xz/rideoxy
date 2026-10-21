import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Colors } from '../constants/theme';

interface SpeedDisplayProps {
  speed: number;
  unit?: 'km/h' | 'mph';
  label?: string;
  size?: 'normal' | 'large';
}

export const SpeedDisplay: React.FC<SpeedDisplayProps> = ({
  speed,
  unit = 'km/h',
  label = 'CURRENT SPEED',
  size = 'large',
}) => {
  const displaySpeed = Math.max(0, Math.round(speed));

  return (
    <View style={styles.container}>
      <View style={styles.speedRow}>
        <Text
          style={[
            styles.speedNumber,
            size === 'large' ? styles.speedLarge : styles.speedNormal,
          ]}
        >
          {displaySpeed}
        </Text>
        <View style={styles.unitBadge}>
          <Text style={styles.unitText}>{unit}</Text>
        </View>
      </View>
      {label ? <Text style={styles.labelText}>{label}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  speedNumber: {
    color: Colors.text,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -2,
  },
  speedLarge: {
    fontSize: 88,
    lineHeight: 92,
  },
  speedNormal: {
    fontSize: 48,
    lineHeight: 52,
  },
  unitBadge: {
    paddingBottom: 6,
  },
  unitText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'lowercase',
    letterSpacing: 0.5,
  },
  labelText: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: -2,
    textTransform: 'uppercase',
  },
});
