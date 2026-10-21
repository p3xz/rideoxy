import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ride } from '../types/ride';
import { Colors } from '../constants/theme';
import { formatDistance, formatDuration, formatSpeed } from '../services/distance';
import { ChevronRight } from 'lucide-react-native';

interface RideCardProps {
  ride: Ride;
  onPress: () => void;
  unit?: 'km' | 'mi';
}

export const RideCard: React.FC<RideCardProps> = ({
  ride,
  onPress,
  unit = 'km',
}) => {
  const dateFormatted = new Date(ride.start_time).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const distanceParts = formatDistance(ride.distance, unit).split(' ');
  const distanceVal = distanceParts[0];
  const distanceUnit = distanceParts[1] || unit.toUpperCase();

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Ride on ${dateFormatted}, distance ${distanceVal} ${distanceUnit}, duration ${formatDuration(ride.duration)}, average speed ${formatSpeed(ride.average_speed, unit)}`}
      accessibilityHint="Double tap to open ride details"
    >
      <View style={styles.cardTopRow}>
        <View style={styles.dateBadge}>
          <Text style={styles.dateText} maxFontSizeMultiplier={1.3}>{dateFormatted.toUpperCase()}</Text>
        </View>
        <Text style={styles.durationText} maxFontSizeMultiplier={1.3}>{formatDuration(ride.duration)}</Text>
      </View>

      <View style={styles.cardMainRow}>
        {/* Left: Prominent Distance */}
        <View style={styles.distanceBlock}>
          <Text style={styles.distanceValue} maxFontSizeMultiplier={1.3}>{distanceVal}</Text>
          <Text style={styles.distanceUnit} maxFontSizeMultiplier={1.3}>{distanceUnit.toUpperCase()}</Text>
        </View>

        {/* Right: Telemetry Metrics & Chevron */}
        <View style={styles.metaRow}>
          <View style={styles.telemetryPill}>
            <Text style={styles.metaLabel} maxFontSizeMultiplier={1.3}>AVG</Text>
            <Text style={styles.metaValue} maxFontSizeMultiplier={1.3}>{formatSpeed(ride.average_speed, unit)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.telemetryPill}>
            <Text style={styles.metaLabel} maxFontSizeMultiplier={1.3}>MAX</Text>
            <Text style={styles.metaValue} maxFontSizeMultiplier={1.3}>{formatSpeed(ride.max_speed, unit)}</Text>
          </View>

          <ChevronRight size={16} color={Colors.textMuted} style={styles.chevron} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: 8,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateBadge: {
    backgroundColor: Colors.surfaceSubtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dateText: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  durationText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  cardMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  distanceBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  distanceValue: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  distanceUnit: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'lowercase',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  telemetryPill: {
    alignItems: 'flex-end',
  },
  metaLabel: {
    color: Colors.textMuted,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  metaValue: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.surfaceBorder,
  },
  chevron: {
    marginLeft: 4,
  },
});
