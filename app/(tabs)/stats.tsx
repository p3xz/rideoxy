import React, { useState, useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Zap, Flame, Clock, BarChart3 } from 'lucide-react-native';
import { Colors } from '../../constants/theme';
import { UI } from '../../constants/ui';
import { Ride } from '../../types/ride';
import { PersonalRecords } from '../../types/statistics';
import { FuelPreferences, DEFAULT_FUEL_PREFERENCES } from '../../types/fuel';
import { getAllCompletedRides } from '../../database/rideRepository';
import { getPersonalRecords } from '../../database/statisticsService';
import { getFuelPreferences } from '../../database/fuelPreferencesRepository';
import { convertKmToMiles } from '../../services/fuelCalculation';
import { formatDuration } from '../../services/distance';
import { useTabBarHeight } from '../../components/FloatingTabBar';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Card } from '../../components/ui/Card';
import { StatCard } from '../../components/ui/StatCard';
import { SegmentedPills } from '../../components/ui/SegmentedPills';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { ListRow } from '../../components/ui/ListRow';
import { EmptyState } from '../../components/ui/EmptyState';
import { AreaChart } from '../../components/charts/AreaChart';
import { formatNumber, formatRideTime } from '../../components/ui/format';
import { FadeInUpView } from '../../lib/motion';
import {
  STATS_RANGES,
  STATS_RANGE_OPTIONS,
  StatsRangeKey,
  computeRangeStats,
} from '../../components/stats/rangeStats';

const EMPTY_RECORDS: PersonalRecords = {
  topSpeedKmh: 0,
  topSpeedRideId: null,
  longestDistanceKm: 0,
  longestDistanceRideId: null,
  longestDurationSeconds: 0,
  longestDurationRideId: null,
  highestAverageSpeedKmh: 0,
  highestAverageSpeedRideId: null,
};

function formatDistanceValue(v: number): string {
  return formatNumber(v, v >= 100 ? 0 : 1);
}

export default function StatsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();

  const [rides, setRides] = useState<Ride[]>([]);
  const [records, setRecords] = useState<PersonalRecords>(EMPTY_RECORDS);
  const [prefs, setPrefs] = useState<FuelPreferences>(DEFAULT_FUEL_PREFERENCES);
  const [range, setRange] = useState<StatsRangeKey>('30d');
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadStatistics = useCallback(async () => {
    try {
      const [completed, rec, fuelPrefs] = await Promise.all([
        getAllCompletedRides(),
        getPersonalRecords(),
        getFuelPreferences(),
      ]);
      setRides(completed);
      setRecords(rec);
      setPrefs(fuelPrefs);
    } catch (err) {
      console.error('[Rideoxy] Error calculating statistics:', err);
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStatistics();
    }, [loadStatistics])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStatistics();
    setRefreshing(false);
  };

  const stats = useMemo(() => computeRangeStats(rides, STATS_RANGES[range]), [rides, range]);

  const miles = prefs.distanceUnit === 'mi';
  const unit = miles ? 'mi' : 'km';
  const toDisplay = (km: number) => (miles ? convertKmToMiles(km) : km);

  const rideTime = formatRideTime(stats.totalSeconds);

  const chartData = stats.series.map((p) => ({
    label: p.label,
    tooltipLabel: p.tooltipLabel,
    value: toDisplay(p.distanceKm),
  }));

  const hasAnyRecords =
    !!records.topSpeedRideId || !!records.longestDistanceRideId || !!records.longestDurationRideId;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: insets.top + 14,
          paddingBottom: tabBarHeight,
          paddingHorizontal: UI.screenPad,
        }}
        showsVerticalScrollIndicator={false}

      >
        <FadeInUpView index={0}>
          <ScreenHeader title="Ride Statistics" subtitle="Your performance, over time." />
        </FadeInUpView>

        <FadeInUpView index={1}>
          <SegmentedPills options={STATS_RANGE_OPTIONS} value={range} onChange={setRange} />
        </FadeInUpView>

        <FadeInUpView index={2} style={styles.grid}>
          <View style={styles.gridRow}>
            <StatCard
              label="Total Distance"
              value={loaded ? formatDistanceValue(toDisplay(stats.totalDistanceKm)) : '—'}
              unit={unit}
              delta={stats.deltas.distance}
            />
            <StatCard
              label="Total Rides"
              value={loaded ? String(stats.totalRides) : '—'}
              unit={stats.totalRides === 1 ? 'ride' : 'rides'}
              delta={stats.deltas.rides}
            />
          </View>
          <View style={styles.gridRow}>
            <StatCard
              label="Avg. Ride Distance"
              value={loaded ? formatDistanceValue(toDisplay(stats.avgRideDistanceKm)) : '—'}
              unit={unit}
              delta={stats.deltas.avgDistance}
            />
            <StatCard
              label="Total Ride Time"
              value={loaded ? rideTime.value : '—'}
              unit={rideTime.unit}
              delta={stats.deltas.time}
            />
          </View>
        </FadeInUpView>

        <FadeInUpView index={3}>
          <SectionHeader title="Distance Trend" />
          <Card style={styles.chartCard}>
            {loaded && !stats.hasData ? (
              <EmptyState
                icon={<BarChart3 size={22} color={UI.accent} strokeWidth={1.8} />}
                title="No rides in this period"
                message="Record a ride to see your distance trend here."
              />
            ) : (
              <AreaChart
                data={chartData}
                formatY={(v) => formatNumber(v, 1)}
                formatValue={(v) => `${formatNumber(v, 1)} ${unit}`}
              />
            )}
          </Card>
        </FadeInUpView>

        {hasAnyRecords ? (
          <FadeInUpView index={4}>
            <SectionHeader title="Personal Records" />
            {records.topSpeedRideId ? (
              <ListRow
                leading={<Zap size={20} color={UI.accent} strokeWidth={1.8} />}
                title="Top Speed"
                subtitle="Highest recorded velocity"
                right={`${Math.round(toDisplay(records.topSpeedKmh))} ${miles ? 'mph' : 'km/h'}`}
                onPress={() => router.push(`/ride/${records.topSpeedRideId}`)}
              />
            ) : null}
            {records.longestDistanceRideId ? (
              <ListRow
                leading={<Flame size={20} color={UI.accent} strokeWidth={1.8} />}
                title="Longest Trip"
                subtitle="Maximum single-ride distance"
                right={`${formatDistanceValue(toDisplay(records.longestDistanceKm))} ${unit}`}
                onPress={() => router.push(`/ride/${records.longestDistanceRideId}`)}
              />
            ) : null}
            {records.longestDurationRideId ? (
              <ListRow
                leading={<Clock size={20} color={UI.accent} strokeWidth={1.8} />}
                title="Longest Duration"
                subtitle="Maximum single-session time"
                right={formatDuration(records.longestDurationSeconds)}
                onPress={() => router.push(`/ride/${records.longestDurationRideId}`)}
              />
            ) : null}
          </FadeInUpView>
        ) : null}
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
  grid: {
    marginTop: 16,
    gap: 12,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  chartCard: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 10,
  },
});
