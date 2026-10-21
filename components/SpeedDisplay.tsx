import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Colors } from '../constants/theme';
import { UI } from '../constants/ui';

interface SpeedDisplayProps {
  speed: number;
  unit?: 'km/h' | 'mph';
  label?: string;
  size?: 'normal' | 'large';
  maxScale?: number;
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    'M', start.x, start.y,
    'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
  ].join(' ');
}

export const SpeedDisplay: React.FC<SpeedDisplayProps> = ({
  speed,
  unit = 'km/h',
  label = 'CURRENT SPEED',
  maxScale = 180,
}) => {
  // Discrete 4 Hz throttle (every 250 ms) with no animation
  const [throttledSpeed, setThrottledSpeed] = useState<number>(Math.max(0, Math.round(speed)));
  const lastUpdateRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const raw = Math.max(0, Math.round(speed));
    const now = Date.now();
    const elapsed = now - lastUpdateRef.current;

    if (elapsed >= 250) {
      lastUpdateRef.current = now;
      setThrottledSpeed(raw);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        lastUpdateRef.current = Date.now();
        setThrottledSpeed(raw);
      }, 250 - elapsed);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [speed]);

  // Gauge geometry
  const cx = 110;
  const cy = 105;
  const radius = 78;
  const startAngle = -130;
  const endAngle = 130;
  const totalSweep = 260;

  const fraction = Math.min(1, Math.max(0, throttledSpeed / maxScale));
  const activeSweepAngle = startAngle + Math.max(1, fraction * totalSweep);

  const backgroundArcPath = describeArc(cx, cy, radius, startAngle, endAngle);
  const valueArcPath = describeArc(cx, cy, radius, startAngle, activeSweepAngle);

  // Outer tick circle
  const tickRadius = 88;
  const outerArcPath = describeArc(cx, cy, tickRadius, startAngle, endAngle);

  return (
    <View style={styles.container}>
      <View style={styles.svgWrapper}>
        <Svg width={220} height={160} viewBox="0 0 220 160">
          {/* Subtle Outer Track */}
          <Path
            d={outerArcPath}
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={1.5}
            strokeDasharray="3, 7"
            fill="none"
          />

          {/* Background Track Arc */}
          <Path
            d={backgroundArcPath}
            stroke="rgba(255, 255, 255, 0.09)"
            strokeWidth={8}
            strokeLinecap="round"
            fill="none"
          />

          {/* Value Arc (Emerald #34D399) */}
          {fraction > 0.01 && (
            <Path
              d={valueArcPath}
              stroke="#34D399"
              strokeWidth={8}
              strokeLinecap="round"
              fill="none"
            />
          )}
        </Svg>

        {/* Readout overlay inside the gauge */}
        <View style={styles.readoutOverlay}>
          <Text style={styles.speedNumber} numberOfLines={1}>
            {throttledSpeed}
          </Text>
          <Text style={styles.unitText}>{unit}</Text>
          {label ? <Text style={styles.labelText}>{label}</Text> : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  svgWrapper: {
    width: 220,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  readoutOverlay: {
    position: 'absolute',
    top: 36,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedNumber: {
    color: '#FFFFFF',
    fontSize: 52,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
    lineHeight: 56,
  },
  unitText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 0,
    textTransform: 'lowercase',
  },
  labelText: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginTop: 4,
    textTransform: 'uppercase',
  },
});
