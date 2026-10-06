import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';
import { OverallStatistics, PersonalRecords } from '../../types/statistics';
import { getOverallStatistics, getPersonalRecords } from '../../database/statisticsService';
import { formatDuration } from '../../services/distance';
import { Wordmark } from '../../components/svg/Wordmark';
import { Award, Zap, Compass, Clock, Activity, Flame, ChevronRight } from 'lucide-react-native';

export default function StatsScreen() {
  const router = useRouter();
  const [overall, setOverall] = useState<OverallStatistics>({
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
  });

  const [records, setRecords] = useState<PersonalRecords>({
    topSpeedKmh: 0,
    topSpeedRideId: null,
    longestDistanceKm: 0,
    longestDistanceRideId: null,
    longestDurationSeconds: 0,
    longestDurationRideId: null,
    highestAverageSpeedKmh: 0,
    highestAverageSpeedRideId: null,
  });

  const [refreshing, setRefreshing] = useState(false);

  const loadStatistics = useCallback(async () => {
    try {
      const [statsData, recordsData] = await Promise.all([
        getOverallStatistics(),
        getPersonalRecords(),
      ]);
      setOverall(statsData);
      setRecords(recordsData);
    } catch (err) {
      console.error('[rideoxy] Error calculating statistics:', err);
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

  const navigateToRide = (rideId: string | null) => {
    if (rideId) {
      router.push(`/ride/${rideId}`);
    }
  };

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
        {/* Header */}
        <View style={styles.header}>
          <Wordmark size="md" showTagline={false} />
          <Text style={styles.headerTitle}>TELEMETRY STATS</Text>
          <Text style={styles.headerSubtitle}>Lifetime riding analytics</Text>
        </View>

        {/* Hero Totals Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroDistanceSection}>
            <Text style={styles.heroLabel}>LIFETIME DISTANCE</Text>
            <View style={styles.heroValueRow}>
              <Text style={styles.heroNumber}>{overall.totalDistanceKm.toFixed(1)}</Text>
              <Text style={styles.heroUnit}>KM</Text>
            </View>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatLabel}>TOTAL RIDES</Text>
              <Text style={styles.heroStatValue}>{overall.totalRidesCount}</Text>
            </View>

            <View style={styles.heroStatDivider} />

            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatLabel}>RIDING TIME</Text>
              <Text style={styles.heroStatValue}>
                {formatDuration(overall.totalMovingTimeSeconds || overall.totalDurationSeconds)}
              </Text>
            </View>

            <View style={styles.heroStatDivider} />

            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatLabel}>THIS MONTH</Text>
              <Text style={styles.heroStatValue}>
                {overall.thisMonthDistanceKm.toFixed(1)} km
              </Text>
            </View>
          </View>
        </View>

        {/* Secondary Averages Card */}
        <View style={styles.averagesCard}>
          <View style={styles.avgBox}>
            <Activity size={16} color={Colors.primary} style={styles.avgIcon} />
            <Text style={styles.avgLabel}>AVG SPEED</Text>
            <Text style={styles.avgValue}>{Math.round(overall.overallAverageSpeedKmh)}</Text>
            <Text style={styles.avgUnit}>KM/H</Text>
          </View>

          <View style={styles.avgBox}>
            <Compass size={16} color={Colors.primary} style={styles.avgIcon} />
            <Text style={styles.avgLabel}>AVG TRIP DISTANCE</Text>
            <Text style={styles.avgValue}>{overall.averageRideDistanceKm.toFixed(1)}</Text>
            <Text style={styles.avgUnit}>KM</Text>
          </View>
        </View>

        {/* Personal Records Section */}
        <View style={styles.recordsSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.badgeIcon}>
              <Award size={16} color={Colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>PERSONAL RECORDS</Text>
          </View>

          {/* Top Speed Record */}
          <TouchableOpacity
            style={styles.recordCard}
            onPress={() => navigateToRide(records.topSpeedRideId)}
            disabled={!records.topSpeedRideId}
            activeOpacity={0.7}
          >
            <View style={styles.recordLeft}>
              <View style={styles.recordIconBox}>
                <Zap size={18} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.recordName}>TOP SPEED</Text>
                <Text style={styles.recordDescription}>Highest recorded velocity</Text>
              </View>
            </View>
            <View style={styles.recordRight}>
              <Text style={styles.recordValue}>{Math.round(records.topSpeedKmh)}</Text>
              <Text style={styles.recordUnit}>KM/H</Text>
              {records.topSpeedRideId && <ChevronRight size={14} color={Colors.textMuted} />}
            </View>
          </TouchableOpacity>

          {/* Longest Distance Record */}
          <TouchableOpacity
            style={styles.recordCard}
            onPress={() => navigateToRide(records.longestDistanceRideId)}
            disabled={!records.longestDistanceRideId}
            activeOpacity={0.7}
          >
            <View style={styles.recordLeft}>
              <View style={styles.recordIconBox}>
                <Flame size={18} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.recordName}>LONGEST TRIP</Text>
                <Text style={styles.recordDescription}>Maximum single-ride distance</Text>
              </View>
            </View>
            <View style={styles.recordRight}>
              <Text style={styles.recordValue}>{records.longestDistanceKm.toFixed(1)}</Text>
              <Text style={styles.recordUnit}>KM</Text>
              {records.longestDistanceRideId && <ChevronRight size={14} color={Colors.textMuted} />}
            </View>
          </TouchableOpacity>

          {/* Longest Duration Record */}
          <TouchableOpacity
            style={styles.recordCard}
            onPress={() => navigateToRide(records.longestDurationRideId)}
            disabled={!records.longestDurationRideId}
            activeOpacity={0.7}
          >
            <View style={styles.recordLeft}>
              <View style={styles.recordIconBox}>
                <Clock size={18} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.recordName}>LONGEST DURATION</Text>
                <Text style={styles.recordDescription}>Maximum single-session time</Text>
              </View>
            </View>
            <View style={styles.recordRight}>
              <Text style={styles.recordValueText}>
                {formatDuration(records.longestDurationSeconds)}
              </Text>
              {records.longestDurationRideId && <ChevronRight size={14} color={Colors.textMuted} />}
            </View>
          </TouchableOpacity>
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
    paddingBottom: 32,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 8,
  },
  headerSubtitle: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: 10,
  },
  heroDistanceSection: {
    marginBottom: 12,
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
  heroNumber: {
    color: Colors.text,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  heroUnit: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroDivider: {
    height: 1,
    backgroundColor: Colors.surfaceBorder,
    marginBottom: 12,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroStatItem: {
    flex: 1,
  },
  heroStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.surfaceBorder,
    marginHorizontal: 8,
  },
  heroStatLabel: {
    color: Colors.textMuted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  heroStatValue: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  averagesCard: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  avgBox: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    alignItems: 'flex-start',
  },
  avgIcon: {
    marginBottom: 6,
  },
  avgLabel: {
    color: Colors.textMuted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  avgValue: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  avgUnit: {
    color: Colors.primary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  recordsSection: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  badgeIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  recordCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  recordIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordName: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  recordDescription: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 1,
  },
  recordRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  recordValue: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  recordValueText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  recordUnit: {
    color: Colors.textSecondary,
    fontSize: 9,
    fontWeight: '700',
    marginRight: 4,
  },
});
