import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';
import { Wordmark } from '../../components/svg/Wordmark';
import { MotorcycleIllustration } from '../../components/svg/MotorcycleIllustration';
import { StartRideButton } from '../../components/StartRideButton';
import { RideCard } from '../../components/RideCard';
import { Ride } from '../../types/ride';
import { HomeStatistics } from '../../types/statistics';
import { LiveTrackingState } from '../../types/tracking';
import { getHomeStatistics } from '../../database/statisticsService';
import { getRecentCompletedRides } from '../../database/rideRepository';
import { getBikeName } from '../../database/settingsRepository';
import { trackingService } from '../../services/tracking';
import { formatDuration } from '../../services/distance';
import { ChevronRight, Wrench, Navigation, Radio } from 'lucide-react-native';

export default function HomeScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<HomeStatistics>({
    thisMonthKm: 0,
    totalKm: 0,
    totalRides: 0,
    topSpeedKmh: 0,
    avgSpeedKmh: 0,
  });
  const [recentRides, setRecentRides] = useState<Ride[]>([]);
  const [bikeName, setBikeName] = useState<string>('');
  const [liveTracking, setLiveTracking] = useState<LiveTrackingState>(
    trackingService.getState()
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const unsubscribe = trackingService.subscribe((state) => {
      setLiveTracking(state);
    });
    return () => unsubscribe();
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [homeStats, rides, storedBike] = await Promise.all([
        getHomeStatistics(),
        getRecentCompletedRides(3),
        getBikeName(),
      ]);
      setStats(homeStats);
      setRecentRides(rides);
      setBikeName(storedBike);
    } catch (err) {
      console.error('[rideoxy] Error loading home data:', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleStartRide = async () => {
    setLoading(true);
    const result = await trackingService.startRide();
    setLoading(false);

    if (result.success) {
      router.push('/active-ride');
    } else {
      if (result.errorType === 'permission' || result.errorType === 'location') {
        Alert.alert(
          'GPS Location Required',
          result.error ?? 'Please enable location permissions in settings to record rides.'
        );
      } else if (result.errorType === 'database') {
        Alert.alert(
          'Database Error',
          `Could not initialize ride in local storage:\n${result.error}`
        );
      } else {
        Alert.alert(
          'Unable to Start Ride',
          result.error ?? 'An unexpected error occurred while starting the ride.'
        );
      }
    }
  };

  const isRideActive =
    liveTracking.status === 'running' || liveTracking.status === 'paused';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Top Header: Brand & Machine Badge */}
        <View style={styles.header}>
          <Wordmark size="md" showTagline={false} />

          <TouchableOpacity
            style={styles.machineBadge}
            onPress={() => router.push('/(tabs)/garage')}
            activeOpacity={0.7}
          >
            <Wrench size={12} color={Colors.primary} />
            <Text style={styles.machineBadgeText} numberOfLines={1} ellipsizeMode="tail">
              {bikeName ? bikeName.toUpperCase() : 'SELECT MACHINE'}
            </Text>
            <ChevronRight size={12} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Live Active Ride Synced Banner */}
        {isRideActive && (
          <TouchableOpacity
            style={styles.activeRideBanner}
            onPress={() => router.push('/active-ride')}
            activeOpacity={0.85}
          >
            <View style={styles.activeRideTopRow}>
              <View style={styles.liveIndicator}>
                <View
                  style={[
                    styles.pulsingDot,
                    {
                      backgroundColor:
                        liveTracking.status === 'paused'
                          ? Colors.warning
                          : Colors.primary,
                    },
                  ]}
                />
                <Text style={styles.liveStatusText}>
                  {liveTracking.status === 'paused'
                    ? 'RIDE PAUSED'
                    : 'RECORDING LIVE'}
                </Text>
              </View>

              <View style={styles.gpsSignalRow}>
                <Radio
                  size={12}
                  color={
                    liveTracking.gpsSignalState === 'good'
                      ? Colors.primary
                      : Colors.warning
                  }
                />
                <Text style={styles.gpsSignalText}>
                  {liveTracking.gpsSignalState === 'good' ? 'GPS LOCK' : 'SEARCHING'}
                </Text>
              </View>
            </View>

            <View style={styles.activeRideMetricsRow}>
              <View style={styles.activeSpeedBlock}>
                <Text style={styles.activeSpeedNumber}>
                  {Math.max(0, Math.round(liveTracking.currentSpeedKmh))}
                </Text>
                <Text style={styles.activeSpeedUnit}>KM/H</Text>
              </View>

              <View style={styles.activeDivider} />

              <View style={styles.activeStatBlock}>
                <Text style={styles.activeStatLabel}>DISTANCE</Text>
                <Text style={styles.activeStatValue}>
                  {liveTracking.currentDistanceKm.toFixed(2)} km
                </Text>
              </View>

              <View style={styles.activeDivider} />

              <View style={styles.activeStatBlock}>
                <Text style={styles.activeStatLabel}>DURATION</Text>
                <Text style={styles.activeStatValue}>
                  {formatDuration(liveTracking.currentDurationSeconds)}
                </Text>
              </View>
            </View>

            <View style={styles.activeRideFooter}>
              <Text style={styles.activeRideFooterText}>
                Tap to open motorcycle cockpit HUD
              </Text>
              <Navigation size={13} color={Colors.primary} />
            </View>
          </TouchableOpacity>
        )}

        {/* Hero Reading: THIS MONTH */}
        <View style={styles.heroSection}>
          <Text style={styles.heroLabel}>THIS MONTH</Text>
          <View style={styles.heroValueRow}>
            <Text style={styles.heroDistanceNumber}>
              {stats.thisMonthKm.toFixed(1)}
            </Text>
            <Text style={styles.heroDistanceUnit}>KM</Text>
          </View>
          <Text style={styles.heroSubtext}>
            {stats.totalRides > 0
              ? `${stats.totalRides} completed ${stats.totalRides === 1 ? 'ride' : 'rides'}`
              : 'Ready to log your first ride'}
          </Text>
        </View>

        {/* 4-Cell Telemetry Grid */}
        <View style={styles.telemetryGrid}>
          <View style={styles.telemetryCell}>
            <Text style={styles.telemetryCellLabel}>TOTAL DISTANCE</Text>
            <Text style={styles.telemetryCellValue}>{stats.totalKm.toFixed(0)}</Text>
            <Text style={styles.telemetryCellUnit}>KM</Text>
          </View>

          <View style={styles.telemetryCell}>
            <Text style={styles.telemetryCellLabel}>TOTAL RIDES</Text>
            <Text style={styles.telemetryCellValue}>{stats.totalRides}</Text>
            <Text style={styles.telemetryCellUnit}>LOGGED</Text>
          </View>

          <View style={styles.telemetryCell}>
            <Text style={styles.telemetryCellLabel}>TOP SPEED</Text>
            <Text style={styles.telemetryCellValue}>{Math.round(stats.topSpeedKmh)}</Text>
            <Text style={styles.telemetryCellUnit}>KM/H</Text>
          </View>

          <View style={styles.telemetryCell}>
            <Text style={styles.telemetryCellLabel}>AVG SPEED</Text>
            <Text style={styles.telemetryCellValue}>{Math.round(stats.avgSpeedKmh)}</Text>
            <Text style={styles.telemetryCellUnit}>KM/H</Text>
          </View>
        </View>

        {/* Primary CTA: START RIDE or RETURN TO HUD */}
        <View style={styles.ctaSection}>
          {isRideActive ? (
            <TouchableOpacity
              style={styles.returnHudBtn}
              onPress={() => router.push('/active-ride')}
              activeOpacity={0.85}
            >
              <Navigation size={18} color="#0C0E12" />
              <Text style={styles.returnHudBtnText}>VIEW ACTIVE RIDE HUD</Text>
            </TouchableOpacity>
          ) : (
            <StartRideButton onPress={handleStartRide} loading={loading} />
          )}
        </View>

        {/* Recent Rides Journal */}
        <View style={styles.recentSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>RECENT RIDES</Text>
            {recentRides.length > 0 && (
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/history')}
                style={styles.viewAllBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.viewAllText}>VIEW ALL</Text>
                <ChevronRight size={12} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {recentRides.length > 0 ? (
            recentRides.map((ride) => (
              <RideCard
                key={ride.id}
                ride={ride}
                onPress={() => router.push(`/ride/${ride.id}`)}
              />
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <MotorcycleIllustration width={240} height={130} />
              <Text style={styles.emptyTitle}>No Recorded Rides</Text>
              <Text style={styles.emptySubtitle}>
                Press Start Ride above to begin recording route telemetry and speed.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  machineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    maxWidth: '52%',
  },
  machineBadgeText: {
    color: Colors.text,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  activeRideBanner: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    marginBottom: 14,
  },
  activeRideTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulsingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  liveStatusText: {
    color: Colors.text,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  gpsSignalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  gpsSignalText: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activeRideMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  activeSpeedBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  activeSpeedNumber: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  activeSpeedUnit: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  activeDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.surfaceBorder,
  },
  activeStatBlock: {
    alignItems: 'center',
  },
  activeStatLabel: {
    color: Colors.textMuted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  activeStatValue: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  activeRideFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  activeRideFooterText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  heroSection: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: 10,
  },
  heroLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  heroDistanceNumber: {
    color: Colors.text,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  heroDistanceUnit: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroSubtext: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  telemetryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  telemetryCell: {
    width: '48.5%',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    alignItems: 'flex-start',
  },
  telemetryCellLabel: {
    color: Colors.textMuted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  telemetryCellValue: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  telemetryCellUnit: {
    color: Colors.primary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  ctaSection: {
    marginBottom: 20,
  },
  returnHudBtn: {
    backgroundColor: Colors.primary,
    height: 54,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  returnHudBtnText: {
    color: '#0C0E12',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  recentSection: {
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});
