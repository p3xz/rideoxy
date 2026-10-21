import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, Alert, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ChevronRight } from 'lucide-react-native';
import { Colors } from '../../constants/theme';
import { Ride } from '../../types/ride';
import { OverallStatistics } from '../../types/statistics';
import { LiveTrackingState } from '../../types/tracking';
import { getOverallStatistics } from '../../database/statisticsService';
import { getRecentCompletedRides } from '../../database/rideRepository';
import { getTrackPointsByRideId } from '../../database/trackPointRepository';
import { getBikeName } from '../../database/settingsRepository';
import { trackingService } from '../../services/tracking';
import { formatStopwatch } from '../../services/distance';
import { HomeHeroBackdrop, HomeHeader, HeroTelemetry } from '../../components/home/HomeHero';
import { HomeStatsPanel } from '../../components/home/HomeStatsPanel';
import { StartRideCTA } from '../../components/home/StartRideCTA';
import { DestinationStartFlow } from '../../components/home/DestinationStartFlow';
import { RideMode } from '../../types/ride';
import { GeocodeResult } from '../../services/etaService';
import {
  RecentRideRow,
  RecentRidesSkeleton,
  RecentRidesEmpty,
} from '../../components/home/RecentRides';
import { GarageShortcut } from '../../components/home/GarageShortcut';
import { useTabBarHeight } from '../../components/FloatingTabBar';

const H_PAD = 20;

const EMPTY_STATS: OverallStatistics = {
  totalDistanceKm: 0,
  totalRidesCount: 0,
  totalDurationSeconds: 0,
  totalMovingTimeSeconds: 0,
  overallAverageSpeedKmh: 0,
  topSpeedKmh: 0,
  longestRideDistanceKm: 0,
  longestRideDurationSeconds: 0,
  averageRideDistanceKm: 0,
  thisMonthDistanceKm: 0,
};

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();

  const [stats, setStats] = useState<OverallStatistics>(EMPTY_STATS);
  const [recentRides, setRecentRides] = useState<Ride[]>([]);
  const [routes, setRoutes] = useState<Record<string, [number, number][]>>({});
  const [bikeName, setBikeName] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [rideMode, setRideMode] = useState<RideMode>('free');
  const [selectedDestination, setSelectedDestination] = useState<GeocodeResult | null>(null);
  const [manualMinutes, setManualMinutes] = useState<string>('');
  const [live, setLive] = useState<LiveTrackingState>(trackingService.getState());

  useEffect(() => trackingService.subscribe(setLive), []);

  const loadData = useCallback(async () => {
    try {
      const [overall, rides, bike] = await Promise.all([
        getOverallStatistics(),
        getRecentCompletedRides(3),
        getBikeName(),
      ]);
      setStats(overall);
      setRecentRides(rides);
      setBikeName(bike);

      const pointSets = await Promise.all(
        rides.map((r) => getTrackPointsByRideId(r.id).catch(() => []))
      );
      const map: Record<string, [number, number][]> = {};
      rides.forEach((r, i) => {
        map[r.id] = pointSets[i].map((p) => [p.longitude, p.latitude] as [number, number]);
      });
      setRoutes(map);
    } catch (err) {
      console.error('[Rideoxy] Error loading home data:', err);
    } finally {
      setLoaded(true);
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

  const isRideActive = live.status === 'running' || live.status === 'paused';

  const handlePrimaryAction = async () => {
    if (isRideActive) {
      router.push('/active-ride');
      return;
    }
    if (rideMode === 'destination' && !selectedDestination) {
      Alert.alert(
        'Destination Required',
        'Please search and select a destination from the list, or switch to Free Ride.'
      );
      return;
    }

    setStarting(true);
    const parsedMins = parseInt(manualMinutes, 10);
    const result = await trackingService.startRide({
      rideMode,
      destination:
        rideMode === 'destination' && selectedDestination
          ? {
              name: selectedDestination.name,
              lat: selectedDestination.lat,
              lng: selectedDestination.lng,
            }
          : null,
      manualMinutes: Number.isFinite(parsedMins) && parsedMins > 0 ? parsedMins : null,
    });
    setStarting(false);

    if (result.success) {
      router.push('/active-ride');
    } else if (result.errorType === 'permission' || result.errorType === 'location') {
      Alert.alert(
        'GPS Location Required',
        result.error ?? 'Please enable location permissions in settings to record rides.'
      );
    } else if (result.errorType === 'database') {
      Alert.alert('Database Error', `Could not initialize ride in local storage:\n${result.error}`);
    } else {
      Alert.alert(
        'Unable to Start Ride',
        result.error ?? 'An unexpected error occurred while starting the ride.'
      );
    }
  };

  const activeLabel = isRideActive
    ? `${live.status === 'paused' ? 'Paused' : 'Recording'} · ${live.currentDistanceKm.toFixed(1)} km · ${formatStopwatch(live.currentDurationSeconds)}`
    : null;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: insets.top + 14,
          paddingBottom: tabBarHeight,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.textSecondary}
            progressBackgroundColor={Colors.surface}
            colors={[Colors.primary]}
          />
        }
      >
        <HomeHeroBackdrop />

        <View style={styles.pad}>
          <HomeHeader onOpenSettings={() => router.push('/(tabs)/settings')} />

          <View style={styles.telemetryBlock}>
            <HeroTelemetry
              totalKm={stats.totalDistanceKm}
              thisMonthKm={stats.thisMonthDistanceKm}
              loaded={loaded}
            />
          </View>

          <HomeStatsPanel
            avgSpeedKmh={stats.overallAverageSpeedKmh}
            rideTimeSeconds={stats.totalMovingTimeSeconds || stats.totalDurationSeconds}
            totalRides={stats.totalRidesCount}
            loaded={loaded}
          />

          <View style={styles.cta}>
            {!isRideActive && (
              <DestinationStartFlow
                mode={rideMode}
                onModeChange={setRideMode}
                selectedDestination={selectedDestination}
                onSelectDestination={setSelectedDestination}
                manualMinutes={manualMinutes}
                onChangeManualMinutes={setManualMinutes}
              />
            )}
            <StartRideCTA onPress={handlePrimaryAction} loading={starting} activeLabel={activeLabel} />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              Recent Rides
            </Text>
            {recentRides.length > 0 ? (
              <Pressable
                onPress={() => router.push('/(tabs)/history')}
                accessibilityRole="button"
                accessibilityLabel="View all rides"
                hitSlop={10}
                style={({ pressed }) => [styles.viewAll, pressed && { opacity: 0.5 }]}
              >
                <Text style={styles.viewAllText}>View all</Text>
                <ChevronRight size={16} color={Colors.textSecondary} strokeWidth={1.8} />
              </Pressable>
            ) : null}
          </View>

          {!loaded ? (
            <RecentRidesSkeleton />
          ) : recentRides.length === 0 ? (
            <RecentRidesEmpty />
          ) : (
            recentRides.map((ride, i) => (
              <RecentRideRow
                key={ride.id}
                ride={ride}
                coords={routes[ride.id] ?? []}
                onPress={() => router.push(`/ride/${ride.id}`)}
                showDivider={i < recentRides.length - 1}
              />
            ))
          )}

          <View style={styles.garage}>
            <GarageShortcut bikeName={bikeName} onPress={() => router.push('/(tabs)/garage')} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  pad: {
    paddingHorizontal: H_PAD,
  },
  telemetryBlock: {
    marginTop: 46,
    marginBottom: 22,
  },
  cta: {
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    marginBottom: 4,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 19,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    color: Colors.textSecondary,
    fontSize: 13.5,
    fontWeight: '500',
  },
  garage: {
    marginTop: 14,
  },
});
