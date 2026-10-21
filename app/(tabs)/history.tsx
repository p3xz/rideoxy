import React, { useState, useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, FlatList, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CalendarDays, Route } from 'lucide-react-native';
import { Colors } from '../../constants/theme';
import { UI } from '../../constants/ui';
import { Ride } from '../../types/ride';
import { FuelPreferences, DEFAULT_FUEL_PREFERENCES } from '../../types/fuel';
import { getRidesForList } from '../../database/rideListQueries';
import { getFuelPreferences } from '../../database/fuelPreferencesRepository';
import { convertKmToMiles } from '../../services/fuelCalculation';
import { formatDuration } from '../../services/distance';
import { trackingService } from '../../services/tracking';
import { useTabBarHeight } from '../../components/FloatingTabBar';
import { ScreenHeader, HeaderIconButton } from '../../components/ui/ScreenHeader';
import { SegmentedPills } from '../../components/ui/SegmentedPills';
import { ListRow } from '../../components/ui/ListRow';
import { EmptyState } from '../../components/ui/EmptyState';
import { InfoSheet, SheetAction } from '../../components/ui/InfoSheet';
import { RouteThumb } from '../../components/ui/RouteThumb';
import { formatDateTime, formatNumber, startOfDay } from '../../components/ui/format';
import { FadeInUpView } from '../../lib/motion';

type RideFilter = 'all' | 'completed' | 'progress';
type DateFilter = 'all' | '7d' | '30d' | 'year';

const FILTER_OPTIONS: { key: RideFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'completed', label: 'Completed' },
  { key: 'progress', label: 'In Progress' },
];

const DATE_OPTIONS: { key: DateFilter; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'year', label: 'This year' },
];

function rideName(startMs: number): string {
  const h = new Date(startMs).getHours();
  if (h >= 5 && h < 12) return 'Morning Ride';
  if (h >= 12 && h < 17) return 'Afternoon Ride';
  if (h >= 17 && h < 21) return 'Evening Ride';
  return 'Night Ride';
}

function dateCutoff(filter: DateFilter): number {
  const today = startOfDay(new Date());
  if (filter === '7d') return new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6).getTime();
  if (filter === '30d') return new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29).getTime();
  if (filter === 'year') return new Date(today.getFullYear(), 0, 1).getTime();
  return 0;
}

const isInProgress = (r: Ride) => r.status !== 'completed';

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();

  const [rides, setRides] = useState<Ride[]>([]);
  const [prefs, setPrefs] = useState<FuelPreferences>(DEFAULT_FUEL_PREFERENCES);
  const [filter, setFilter] = useState<RideFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [dateSheet, setDateSheet] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadRides = useCallback(async () => {
    try {
      const [data, fuelPrefs] = await Promise.all([getRidesForList(), getFuelPreferences()]);
      setRides(data);
      setPrefs(fuelPrefs);
    } catch (err) {
      console.error('[Rideoxy] Error loading rides history:', err);
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRides();
    }, [loadRides])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRides();
    setRefreshing(false);
  };

  const visible = useMemo(() => {
    const cutoff = dateCutoff(dateFilter);
    return rides.filter((r) => {
      if (filter === 'completed' && isInProgress(r)) return false;
      if (filter === 'progress' && !isInProgress(r)) return false;
      return r.start_time >= cutoff;
    });
  }, [rides, filter, dateFilter]);

  const miles = prefs.distanceUnit === 'mi';

  const openRide = (ride: Ride) => {
    const live = trackingService.getState();
    const isLive =
      (live.status === 'running' || live.status === 'paused') && live.currentRide?.id === ride.id;
    router.push(isLive ? '/active-ride' : `/ride/${ride.id}`);
  };

  const renderItem = ({ item, index }: { item: Ride; index: number }) => {
    const km = Number.isFinite(item.distance) ? item.distance : 0;
    const d = miles ? convertKmToMiles(km) : km;
    const row = (
      <ListRow
        leading={<RouteThumb rideId={item.id} size={60} />}
        title={rideName(item.start_time)}
        subtitle={formatDateTime(new Date(item.start_time))}
        badge={isInProgress(item) ? 'IN PROGRESS' : undefined}
        right={`${formatNumber(d, d < 100 ? 1 : 0)} ${miles ? 'mi' : 'km'}`}
        rightSecondary={formatDuration(item.duration)}
        onPress={() => openRide(item)}
        accessibilityLabel={`${rideName(item.start_time)}, ${formatDateTime(new Date(item.start_time))}`}
      />
    );

    // Entrance animation only for the first 8 items per safety rules
    if (index < 8) {
      return <FadeInUpView index={index + 2}>{row}</FadeInUpView>;
    }
    return row;
  };

  const emptyMessage =
    rides.length === 0
      ? 'No rides yet. Tap Start Ride on Home.'
      : 'No rides match these filters.';

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 14,
          paddingBottom: tabBarHeight,
          paddingHorizontal: UI.screenPad,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#34D399"
            progressBackgroundColor={Colors.surface}
            colors={[Colors.primary]}
          />
        }
        ListHeaderComponent={
          <View>
            <FadeInUpView index={0}>
              <ScreenHeader
                title="My Rides"
                subtitle="Your journey, mapped."
                right={
                  <HeaderIconButton
                    label="Filter rides by date"
                    accent={dateFilter !== 'all'}
                    onPress={() => setDateSheet(true)}
                    icon={<CalendarDays size={18} color={dateFilter !== 'all' ? UI.accent : UI.textSecondary} strokeWidth={1.8} />}
                  />
                }
              />
            </FadeInUpView>
            <FadeInUpView index={1} style={styles.pills}>
              <SegmentedPills options={FILTER_OPTIONS} value={filter} onChange={setFilter} />
            </FadeInUpView>
          </View>
        }
        ListEmptyComponent={
          loaded ? (
            <EmptyState
              icon={<Route size={22} color={UI.accent} strokeWidth={1.8} />}
              title="No rides"
              message={emptyMessage}
            />
          ) : null
        }
      />

      <InfoSheet
        visible={dateSheet}
        title="Filter by date"
        subtitle="Show rides from a specific period."
        onClose={() => setDateSheet(false)}
      >
        {DATE_OPTIONS.map((opt) => (
          <SheetAction
            key={opt.key}
            label={opt.label}
            selected={dateFilter === opt.key}
            onPress={() => {
              setDateFilter(opt.key);
              setDateSheet(false);
            }}
          />
        ))}
      </InfoSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  pills: {
    marginBottom: 16,
  },
});
