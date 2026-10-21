import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Compass, Clock, CheckCircle2, AlertCircle, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react-native';
import { Ride } from '../types/ride';
import { Coordinates } from '../services/distance';
import { computeRoutePace } from '../services/paceService';
import { Colors } from '../constants/theme';
import { UI } from '../constants/ui';

interface RoutePaceSummaryProps {
  ride: Ride;
  lastPoint?: Coordinates | null;
  startLocality?: string | null;
}

function formatMinutesOrHours(seconds: number): string {
  const totalM = Math.round(seconds / 60);
  if (totalM < 60) {
    return `${totalM} min`;
  }
  const h = Math.floor(totalM / 60);
  const m = totalM % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export const RoutePaceSummary: React.FC<RoutePaceSummaryProps> = ({
  ride,
  lastPoint,
  startLocality,
}) => {
  // Free rides NEVER render the Route Pace card
  if (ride.ride_mode !== 'destination' || !ride.estimated_duration_sec) {
    return null;
  }

  const pace = computeRoutePace(ride, lastPoint);

  if (!pace.hasPace) {
    return null;
  }

  const routeLabel = startLocality && ride.destination_name
    ? `${startLocality} to ${ride.destination_name}`
    : ride.destination_name
    ? `Start to ${ride.destination_name}`
    : 'Destination Route';

  const estFormatted = formatMinutesOrHours(pace.estimatedSec);
  const actFormatted = formatMinutesOrHours(pace.actualSec);
  const movFormatted = formatMinutesOrHours(pace.movingSec);

  // Accessible summary string
  const a11yText = pace.verdictSuppressed
    ? `Route pace: destination ${ride.destination_name || 'set'}, ${pace.verdictTitle}. ${pace.verdictDescription}`
    : `Route pace: estimated ${estFormatted}, actual ${actFormatted}, ${pace.verdictTitle.toLowerCase()}.`;

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityRole="summary"
      accessibilityLabel={a11yText}
    >
      {/* Eyebrow & Status Chip */}
      <View style={styles.headerRow}>
        <View style={styles.eyebrowWrap}>
          <Compass size={13} color={Colors.primary} style={{ marginRight: 6 }} />
          <Text style={styles.eyebrow} maxFontSizeMultiplier={1.3}>
            ROUTE PACE SUMMARY
          </Text>
        </View>

        <View
          style={[
            styles.statusChip,
            pace.verdictSuppressed
              ? styles.chipNeutral
              : pace.verdict === 'faster'
              ? styles.chipEmerald
              : pace.verdict === 'slower'
              ? styles.chipAmber
              : styles.chipNeutral,
          ]}
        >
          {pace.verdictSuppressed ? (
            <AlertCircle size={11} color={UI.textSecondary} style={{ marginRight: 4 }} />
          ) : pace.verdict === 'faster' ? (
            <ArrowUpRight size={11} color="#34D399" style={{ marginRight: 4 }} />
          ) : pace.verdict === 'slower' ? (
            <ArrowDownRight size={11} color="#F0C879" style={{ marginRight: 4 }} />
          ) : (
            <Minus size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
          )}
          <Text
            style={[
              styles.statusChipText,
              pace.verdictSuppressed
                ? { color: UI.textSecondary }
                : pace.verdict === 'faster'
                ? { color: '#34D399' }
                : pace.verdict === 'slower'
                ? { color: '#F0C879' }
                : { color: '#FFFFFF' },
            ]}
            maxFontSizeMultiplier={1.3}
          >
            {pace.verdictSuppressed
              ? 'UNVERIFIED'
              : pace.verdict === 'faster'
              ? 'AHEAD'
              : pace.verdict === 'slower'
              ? 'BEHIND'
              : 'ON TIME'}
          </Text>
        </View>
      </View>

      {/* Route Line */}
      <Text style={styles.routeLine} numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {routeLabel}
      </Text>

      {/* Two Comparison Tiles */}
      <View style={styles.tilesRow}>
        <View style={styles.tile}>
          <Text style={styles.tileLabel} maxFontSizeMultiplier={1.3}>
            Estimated time
          </Text>
          <Text style={styles.tileValue} maxFontSizeMultiplier={1.3}>
            {estFormatted}
          </Text>
          <Text style={styles.tileSub} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {pace.sourceLabel}
          </Text>
        </View>

        <View style={styles.tileDivider} />

        <View style={styles.tile}>
          <Text style={styles.tileLabel} maxFontSizeMultiplier={1.3}>
            Your time
          </Text>
          <Text style={styles.tileValue} maxFontSizeMultiplier={1.3}>
            {actFormatted}
          </Text>
          <Text style={styles.tileSub} maxFontSizeMultiplier={1.3}>
            Total duration
          </Text>
        </View>
      </View>

      {/* Optional Quieter Moving Time Line if Stop Gap applies */}
      {pace.hasStopGap && (
        <View style={styles.stopGapRow}>
          <Clock size={12} color={UI.textMuted} style={{ marginRight: 5 }} />
          <Text style={styles.stopGapText} maxFontSizeMultiplier={1.3}>
            Moving time: {movFormatted} ({formatMinutesOrHours(pace.actualSec - pace.movingSec)} stopped)
          </Text>
        </View>
      )}

      {/* Verdict Banner */}
      <View
        style={[
          styles.verdictBanner,
          pace.verdictSuppressed
            ? styles.verdictBannerNeutral
            : pace.verdict === 'faster'
            ? styles.verdictBannerEmerald
            : pace.verdict === 'slower'
            ? styles.verdictBannerAmber
            : styles.verdictBannerNeutral,
        ]}
      >
        <Text
          style={[
            styles.verdictTitle,
            pace.verdictSuppressed
              ? styles.textNeutral
              : pace.verdict === 'faster'
              ? styles.textEmerald
              : pace.verdict === 'slower'
              ? styles.textAmber
              : styles.textNeutral,
          ]}
          maxFontSizeMultiplier={1.3}
        >
          {pace.verdictTitle}
        </Text>
        <Text style={styles.verdictDescription} maxFontSizeMultiplier={1.3}>
          {pace.verdictDescription}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 18,
    marginVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  eyebrowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.8,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  chipEmerald: {
    backgroundColor: 'rgba(52, 211, 153, 0.14)',
  },
  chipAmber: {
    backgroundColor: 'rgba(240, 200, 121, 0.14)',
  },
  chipNeutral: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  routeLine: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    letterSpacing: -0.2,
  },
  tilesRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  tile: {
    flex: 1,
  },
  tileDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginHorizontal: 12,
  },
  tileLabel: {
    color: UI.textMuted,
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 3,
  },
  tileValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 2,
    ...Platform.select({
      ios: { fontVariant: ['tabular-nums'] },
      default: {},
    }),
  },
  tileSub: {
    color: '#8E9892',
    fontSize: 10.5,
  },
  stopGapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  stopGapText: {
    color: UI.textMuted,
    fontSize: 11.5,
  },
  verdictBanner: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  verdictBannerEmerald: {
    backgroundColor: 'rgba(52, 211, 153, 0.10)',
    borderColor: 'rgba(52, 211, 153, 0.30)',
  },
  verdictBannerAmber: {
    backgroundColor: 'rgba(240, 200, 121, 0.10)',
    borderColor: 'rgba(240, 200, 121, 0.30)',
  },
  verdictBannerNeutral: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  verdictTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  textEmerald: {
    color: '#34D399',
  },
  textAmber: {
    color: '#F0C879',
  },
  textNeutral: {
    color: '#F3F6F3',
  },
  verdictDescription: {
    color: '#D1D5DB',
    fontSize: 12.5,
    lineHeight: 17,
  },
});
