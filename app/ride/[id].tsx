import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Colors } from '../../constants/theme';
import { RideMap } from '../../components/RideMap';
import { RideStats } from '../../components/RideStats';
import { RoutePaceSummary } from '../../components/RoutePaceSummary';
import { getRideById, deleteRide } from '../../database/rideRepository';
import { getTrackPointsByRideId } from '../../database/trackPointRepository';
import { exportRideToGPX } from '../../services/gpxExport';
import { hapticFeedback } from '../../services/haptics';
import { Ride, TrackPoint } from '../../types/ride';
import {
  ChevronLeft,
  Share2,
  Trash2,
  Calendar,
  Clock,
  TrendingUp,
} from 'lucide-react-native';

export default function RideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const [ride, setRide] = useState<Ride | null>(null);
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function loadRideData() {
      if (!id) return;
      try {
        const [rideData, trackPoints] = await Promise.all([
          getRideById(id),
          getTrackPointsByRideId(id),
        ]);
        setRide(rideData);
        setPoints(trackPoints);
        setRouteCoords(trackPoints.map((pt) => [pt.longitude, pt.latitude]));
      } catch (err) {
        console.error('[Rideoxy] Error loading ride details:', err);
      } finally {
        setLoading(false);
      }
    }

    loadRideData();
  }, [id]);

  const handleExportGPX = async () => {
    if (!ride) return;
    hapticFeedback.light();
    setExporting(true);
    const result = await exportRideToGPX(ride);
    setExporting(false);

    if (!result.success && result.error) {
      Alert.alert('Export Failed', result.error);
    }
  };

  const handleDeleteRide = () => {
    hapticFeedback.warning();
    Alert.alert(
      'Delete Ride',
      'Are you sure you want to permanently delete this ride and its GPS telemetry from your device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            hapticFeedback.heavy();
            if (id) {
              await deleteRide(id);
              router.back();
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#34D399" />
        </View>
      </SafeAreaView>
    );
  }

  if (!ride) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Ride not found.</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtnText}>
            <Text style={{ color: '#34D399', fontWeight: '700' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const startDateFormatted = new Date(ride.start_time).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const startTimeFormatted = new Date(ride.start_time).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const endTimeFormatted = ride.end_time
    ? new Date(ride.end_time).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const paceSecPerKm =
    ride.distance > 0 && ride.moving_time
      ? Math.round(ride.moving_time / ride.distance)
      : null;
  const paceMinutes = paceSecPerKm ? Math.floor(paceSecPerKm / 60) : 0;
  const paceSeconds = paceSecPerKm ? paceSecPerKm % 60 : 0;
  const paceDisplay = paceSecPerKm
    ? `${paceMinutes}:${String(paceSeconds).padStart(2, '0')}`
    : '--';

  // Compute elevation profile if altitude data is present
  const validAltitudes = points
    .map((p) => p.altitude)
    .filter((a): a is number => typeof a === 'number' && !isNaN(a) && a > 0);

  const hasElevationData =
    validAltitudes.length >= 2 &&
    Math.max(...validAltitudes) - Math.min(...validAltitudes) >= 2;

  const minAlt = hasElevationData ? Math.round(Math.min(...validAltitudes)) : 0;
  const maxAlt = hasElevationData ? Math.round(Math.max(...validAltitudes)) : 0;

  // Build SVG path for elevation chart
  const chartWidth = Math.max(windowWidth - 68, 260);
  const chartHeight = 85;

  let elevationLinePath = '';
  let elevationAreaPath = '';

  if (hasElevationData) {
    // Sample to at most 60 evenly spaced points
    const sampleCount = Math.min(validAltitudes.length, 60);
    const sampledAlts: number[] = [];
    const step = (validAltitudes.length - 1) / (sampleCount - 1);
    for (let i = 0; i < sampleCount; i++) {
      const idx = Math.min(Math.round(i * step), validAltitudes.length - 1);
      sampledAlts.push(validAltitudes[idx]);
    }

    const altRange = maxAlt - minAlt || 1;
    const paddingY = 8;
    const usableHeight = chartHeight - paddingY * 2;

    const coords = sampledAlts.map((alt, idx) => {
      const x = (idx / (sampleCount - 1)) * chartWidth;
      const y = chartHeight - paddingY - ((alt - minAlt) / altRange) * usableHeight;
      return { x, y };
    });

    elevationLinePath = coords.reduce(
      (acc, pt, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`,
      ''
    );
    elevationAreaPath = `${elevationLinePath} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      {/* Cockpit Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            hapticFeedback.light();
            router.back();
          }}
          style={styles.navBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={22} color="#F3F6F3" />
        </TouchableOpacity>

        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.2}>
          RIDE TELEMETRY
        </Text>

        <TouchableOpacity
          onPress={handleDeleteRide}
          style={styles.navBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Delete this ride"
        >
          <Trash2 size={16} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Route Map Card */}
        <View style={styles.mapCard}>
          <RideMap
            coordinates={routeCoords}
            interactive={true}
            followUser={false}
            showStartEndMarkers={true}
            height={220}
          />
        </View>

        {/* Date / Time Card */}
        <View style={styles.metaCard}>
          <View style={styles.metaItem}>
            <Calendar size={13} color="#34D399" />
            <Text style={styles.metaText} maxFontSizeMultiplier={1.2}>
              {startDateFormatted.toUpperCase()}
            </Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <Clock size={13} color="#34D399" />
            <Text style={styles.metaText} maxFontSizeMultiplier={1.2}>
              {startTimeFormatted} {endTimeFormatted ? `· ${endTimeFormatted}` : ''}
            </Text>
          </View>
        </View>

        {/* Detailed Stats Card */}
        <View style={styles.statsContainer}>
          <RideStats
            distanceKm={ride.distance}
            durationSeconds={ride.duration}
            movingTimeSeconds={ride.moving_time}
            avgSpeedKmh={ride.average_speed}
            maxSpeedKmh={ride.max_speed}
            mode="summary"
          />
        </View>

        {/* Secondary Telemetry Card: Pace & GPS Points */}
        <View style={styles.secondaryCard}>
          <View style={styles.secondaryItem}>
            <Text style={styles.secondaryLabel} maxFontSizeMultiplier={1.2}>
              AVERAGE PACE
            </Text>
            <View style={styles.secondaryValueRow}>
              <Text style={styles.secondaryValue} maxFontSizeMultiplier={1.3}>
                {paceDisplay}
              </Text>
              <Text style={styles.secondaryUnit}>/km</Text>
            </View>
          </View>
          <View style={styles.secondaryDivider} />
          <View style={styles.secondaryItem}>
            <Text style={styles.secondaryLabel} maxFontSizeMultiplier={1.2}>
              GPS DATA POINTS
            </Text>
            <View style={styles.secondaryValueRow}>
              <Text style={styles.secondaryValue} maxFontSizeMultiplier={1.3}>
                {points.length > 0 ? points.length.toLocaleString() : '--'}
              </Text>
              <Text style={styles.secondaryUnit}>pts</Text>
            </View>
          </View>
        </View>

        {/* Route Pace Summary (Destination Mode Only) */}
        {ride.ride_mode === 'destination' && (
          <RoutePaceSummary
            ride={ride}
            lastPoint={
              routeCoords.length > 0
                ? {
                    latitude: routeCoords[routeCoords.length - 1][1],
                    longitude: routeCoords[routeCoords.length - 1][0],
                  }
                : null
            }
          />
        )}

        {/* Conditional Elevation Profile Chart */}
        {hasElevationData && (
          <View
            style={styles.elevationCard}
            accessible={true}
            accessibilityRole="summary"
            accessibilityLabel={`Elevation profile ranging from ${minAlt} meters to ${maxAlt} meters`}
          >
            <View style={styles.elevationHeader}>
              <View style={styles.elevationTitleWrap}>
                <TrendingUp size={13} color="#34D399" style={{ marginRight: 6 }} />
                <Text style={styles.elevationTitle} maxFontSizeMultiplier={1.2}>
                  ELEVATION PROFILE
                </Text>
              </View>
              <View style={styles.elevationRangeWrap}>
                <Text style={styles.elevationRangeText} maxFontSizeMultiplier={1.2}>
                  {minAlt} m - {maxAlt} m
                </Text>
              </View>
            </View>

            <View style={styles.chartContainer}>
              <Svg width={chartWidth} height={chartHeight}>
                <Defs>
                  <LinearGradient id="elevationGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor="#34D399" stopOpacity="0.32" />
                    <Stop offset="100%" stopColor="#34D399" stopOpacity="0.0" />
                  </LinearGradient>
                </Defs>
                <Path d={elevationAreaPath} fill="url(#elevationGrad)" />
                <Path
                  d={elevationLinePath}
                  fill="none"
                  stroke="#34D399"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          </View>
        )}

        {/* Export GPX Action Button */}
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={handleExportGPX}
          disabled={exporting}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Export ride telemetry as GPX file"
        >
          <Share2 size={18} color="#34D399" strokeWidth={2.4} />
          <Text style={styles.exportBtnText} maxFontSizeMultiplier={1.2}>
            {exporting ? 'EXPORTING GPX...' : 'Export GPX File'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#070909',
  },
  header: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 36,
  },
  mapCard: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 14,
  },
  metaCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metaDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  statsContainer: {
    marginBottom: 14,
  },
  secondaryCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 14,
  },
  secondaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  secondaryLabel: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  secondaryValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  secondaryValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
    ...Platform.select({
      ios: { fontVariant: ['tabular-nums'] },
      default: {},
    }),
  },
  secondaryUnit: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '800',
  },
  secondaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  elevationCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 16,
  },
  elevationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  elevationTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  elevationTitle: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  elevationRangeWrap: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  elevationRangeText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportBtn: {
    height: 52,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: '#34D399',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 2,
  },
  exportBtnText: {
    color: '#34D399',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#9CA3AF',
    fontSize: 15,
    marginBottom: 10,
  },
  backBtnText: {
    padding: 8,
  },
});
