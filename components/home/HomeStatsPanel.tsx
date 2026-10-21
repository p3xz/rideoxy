import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Gauge, Clock } from 'lucide-react-native';
import { Colors } from '../../constants/theme';
import { GlassSurface } from '../GlassSurface';

interface HomeStatsPanelProps {
  avgSpeedKmh: number;
  rideTimeSeconds: number;
  totalRides: number;
  loaded: boolean;
}

/** Custom route-path & pin icon matching the prototype's TOTAL RIDES column. */
const RoutePinIcon: React.FC<{ color: string }> = ({ color }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path
      d="M 15.5 4.2 C 13.3 4.2 11.5 6.0 11.5 8.2 C 11.5 11.2 15.5 14.8 15.5 14.8 C 15.5 14.8 19.5 11.2 19.5 8.2 C 19.5 6.0 17.7 4.2 15.5 4.2 Z"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx="15.5" cy="8.1" r="1.4" fill={color} />
    <Path
      d="M 5 14.5 C 5 17.5 7.5 19.2 11 19.2 H 16.5"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </Svg>
);

function formatRideTime(seconds: number): { value: string; unit: string } {
  if (seconds < 3600) return { value: String(Math.round(seconds / 60)), unit: 'min' };
  const hours = seconds / 3600;
  return { value: hours < 10 ? hours.toFixed(1) : String(Math.round(hours)), unit: 'h' };
}

const Cell: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
}> = ({ icon, label, value, unit }) => (
  <View style={styles.cell} accessible accessibilityLabel={`${label} ${value} ${unit ?? ''}`}>
    {icon}
    <Text style={styles.label}>{label}</Text>
    <View style={styles.valueRow}>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
      {unit ? <Text style={styles.unit}>{unit}</Text> : null}
    </View>
  </View>
);

export const HomeStatsPanel: React.FC<HomeStatsPanelProps> = ({
  avgSpeedKmh,
  rideTimeSeconds,
  totalRides,
  loaded,
}) => {
  const time = formatRideTime(rideTimeSeconds);
  const iconProps = { size: 19, color: Colors.textSecondary, strokeWidth: 1.6 };

  return (
    <GlassSurface variant="primary" intensity={28} borderRadius={18}>
      <View style={styles.row}>
        <Cell
          icon={<Gauge {...iconProps} />}
          label="AVG SPEED"
          value={loaded ? String(Math.round(avgSpeedKmh)) : '—'}
          unit="km/h"
        />
        <View style={styles.hairline} />
        <Cell
          icon={<Clock {...iconProps} />}
          label="RIDE TIME"
          value={loaded ? time.value : '—'}
          unit={time.unit}
        />
        <View style={styles.hairline} />
        <Cell
          icon={<RoutePinIcon color={Colors.textSecondary} />}
          label="TOTAL RIDES"
          value={loaded ? String(totalRides) : '—'}
        />
      </View>
    </GlassSurface>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 15,
  },
  cell: {
    flex: 1,
    paddingHorizontal: 16,
  },
  hairline: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(230, 255, 239, 0.14)',
    marginVertical: 4,
  },
  label: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.9,
    marginTop: 10,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 3,
  },
  value: {
    color: Colors.text,
    fontSize: 23,
    fontWeight: '600',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '400',
    marginLeft: 4,
  },
});
