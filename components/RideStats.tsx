import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Colors } from '../constants/theme';
import { UI } from '../constants/ui';
import { formatDistance, formatDuration, formatStopwatch } from '../services/distance';

interface RideStatsProps {
  distanceKm: number;
  durationSeconds: number;
  movingTimeSeconds?: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  unit?: 'km' | 'mi';
  mode?: 'active' | 'summary';
  distanceToDestinationKm?: number | null;
}

export const RideStats: React.FC<RideStatsProps> = ({
  distanceKm,
  durationSeconds,
  movingTimeSeconds,
  avgSpeedKmh,
  maxSpeedKmh,
  unit = 'km',
  mode = 'active',
  distanceToDestinationKm,
}) => {
  const speedUnit = unit === 'mi' ? 'mph' : 'km/h';
  const speedMultiplier = unit === 'mi' ? 0.621371 : 1;

  const displayAvgSpeed = Math.round((avgSpeedKmh || 0) * speedMultiplier);
  const displayMaxSpeed = Math.round((maxSpeedKmh || 0) * speedMultiplier);

  // Active Mode (2x2 Grid for Live Ride screen)
  if (mode === 'active') {
    return (
      <View style={styles.activeContainer}>
        {/* Row 1: Distance & Duration */}
        <View style={styles.activeRow}>
          <View style={styles.activeCell}>
            <Text style={styles.activeLabel}>DISTANCE</Text>
            <View style={styles.activeValueInline}>
              <Text style={styles.activeValue}>
                {formatDistance(distanceKm, unit)}
              </Text>
            </View>
          </View>

          <View style={styles.activeCell}>
            <Text style={styles.activeLabel}>DURATION</Text>
            <Text style={styles.activeValue}>
              {formatStopwatch(durationSeconds)}
            </Text>
          </View>
        </View>

        {/* Row 2: Avg Speed & Max Speed */}
        <View style={styles.activeRow}>
          <View style={styles.activeCell}>
            <Text style={styles.activeLabel}>AVG SPEED</Text>
            <View style={styles.activeValueInline}>
              <Text style={styles.activeValue}>{displayAvgSpeed}</Text>
              <Text style={styles.activeUnit}>{speedUnit}</Text>
            </View>
          </View>

          <View style={styles.activeCell}>
            <Text style={styles.activeLabel}>MAX SPEED</Text>
            <View style={styles.activeValueInline}>
              <Text style={styles.activeValue}>{displayMaxSpeed}</Text>
              <Text style={styles.activeUnit}>{speedUnit}</Text>
            </View>
          </View>
        </View>

        {/* Destination Ride: Optional straight-line distance to destination */}
        {distanceToDestinationKm !== undefined && distanceToDestinationKm !== null && (
          <View style={styles.destinationRemainingRow}>
            <Text style={styles.destinationRemainingText} numberOfLines={1}>
              {formatDistance(distanceToDestinationKm, unit)} to destination
            </Text>
          </View>
        )}
      </View>
    );
  }

  // Summary / Detail Mode (Card format for Ride Summary & Telemetry)
  return (
    <View style={styles.summaryCard}>
      {/* Top Row: Total Distance & Total Duration */}
      <View style={styles.summaryTopRow}>
        <View style={styles.summaryTopItem}>
          <Text style={styles.summaryLabel}>TOTAL DISTANCE</Text>
          <Text style={styles.summaryPrimaryValue}>
            {formatDistance(distanceKm, unit)}
          </Text>
        </View>

        <View style={styles.summaryTopItem}>
          <Text style={styles.summaryLabel}>TOTAL DURATION</Text>
          <Text style={styles.summaryPrimaryValue}>
            {formatDuration(durationSeconds)}
          </Text>
        </View>
      </View>

      <View style={styles.summaryDivider} />

      {/* Bottom Row: Moving Time, Avg Speed, Top Speed */}
      <View style={styles.summaryBottomRow}>
        <View style={styles.summaryBottomItem}>
          <Text style={styles.summarySubLabel}>MOVING TIME</Text>
          <Text style={styles.summarySecondaryValue}>
            {movingTimeSeconds !== undefined && movingTimeSeconds !== null
              ? formatDuration(movingTimeSeconds)
              : '--'}
          </Text>
        </View>

        <View style={styles.summaryBottomItem}>
          <Text style={styles.summarySubLabel}>AVG SPEED</Text>
          <Text style={styles.summarySecondaryValue}>
            {displayAvgSpeed} {speedUnit}
          </Text>
        </View>

        <View style={styles.summaryBottomItem}>
          <Text style={styles.summarySubLabel}>TOP SPEED</Text>
          <Text style={styles.summarySecondaryValue}>
            {displayMaxSpeed} {speedUnit}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Active HUD Layout
  activeContainer: {
    gap: 14,
    paddingHorizontal: 12,
  },
  activeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  activeCell: {
    flex: 1,
  },
  activeLabel: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  activeValueInline: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  activeValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  activeUnit: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
  },
  destinationRemainingRow: {
    backgroundColor: 'rgba(52, 211, 153, 0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  destinationRemainingText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // Summary Card Layout
  summaryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 18,
    gap: 14,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryTopItem: {
    flex: 1,
  },
  summaryLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  summaryPrimaryValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  summaryBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryBottomItem: {
    flex: 1,
  },
  summarySubLabel: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  summarySecondaryValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
