import React, { useState, useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, RefreshControl, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Plus, Fuel, Edit2, Trash2 } from 'lucide-react-native';
import { Colors } from '../../constants/theme';
import { UI } from '../../constants/ui';
import {
  DerivedFuelLog,
  FuelSummaryStatistics,
  FuelPreferences,
  DEFAULT_FUEL_PREFERENCES,
} from '../../types/fuel';
import { getFuelLogsForVehicle, deleteFuelLog } from '../../database/fuelRepository';
import { getFuelPreferences } from '../../database/fuelPreferencesRepository';
import {
  deriveFuelLogs,
  computeFuelSummary,
  convertMileageFromCanonical,
  convertLitresToGallons,
  formatDisplayCurrency,
  formatCurrencySymbol,
} from '../../services/fuelCalculation';
import { useTabBarHeight } from '../../components/FloatingTabBar';
import { ScreenHeader, HeaderIconButton } from '../../components/ui/ScreenHeader';
import { Card } from '../../components/ui/Card';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { ListRow } from '../../components/ui/ListRow';
import { EmptyState } from '../../components/ui/EmptyState';
import { DropdownPill } from '../../components/ui/DropdownPill';
import { InfoSheet, SheetAction } from '../../components/ui/InfoSheet';
import { BarChart } from '../../components/charts/BarChart';
import { formatDateTime, formatNumber } from '../../components/ui/format';
import { FUEL_RANGE_OPTIONS, FuelRangeKey, computeFuelBars } from '../../components/fuel/fuelBars';
import { FadeInUpView } from '../../lib/motion';

const RECENT_COUNT = 3;
const KM_PER_MILE = 1.609344;

function capitalize(s: string): string {
  if (s === 'cng') return 'CNG';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function FuelScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();

  const [vehicleId] = useState('default');
  const [derivedLogs, setDerivedLogs] = useState<DerivedFuelLog[]>([]);
  const [summary, setSummary] = useState<FuelSummaryStatistics | null>(null);
  const [prefs, setPrefs] = useState<FuelPreferences>(DEFAULT_FUEL_PREFERENCES);
  const [range, setRange] = useState<FuelRangeKey>('7d');
  const [showAll, setShowAll] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLog, setSelectedLog] = useState<DerivedFuelLog | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [loadedPrefs, logs] = await Promise.all([
        getFuelPreferences(),
        getFuelLogsForVehicle(vehicleId),
      ]);
      setPrefs(loadedPrefs);
      const derived = deriveFuelLogs(logs);
      setDerivedLogs(derived);
      setSummary(computeFuelSummary(derived, loadedPrefs.currency));
    } catch (err) {
      console.error('[Rideoxy] Error loading fuel data:', err);
    } finally {
      setLoaded(true);
    }
  }, [vehicleId]);

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

  const handleEditLog = () => {
    if (!selectedLog) return;
    const log = selectedLog;
    setSelectedLog(null);
    router.push({ pathname: '/fuel-entry', params: { id: log.id, vehicleId: log.vehicleId } });
  };

  const handleDeleteLog = () => {
    if (!selectedLog) return;
    const log = selectedLog;
    setSelectedLog(null);
    Alert.alert(
      'Delete Fuel Log',
      `Delete log #${log.logNumber}? Subsequent mileage calculations will adjust automatically.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFuelLog(log.id);
              await loadData();
            } catch (err) {
              Alert.alert('Error', 'Failed to delete fuel log.');
            }
          },
        },
      ]
    );
  };

  const volUnit = prefs.volumeUnit;
  const toVolume = (litres: number) => (volUnit === 'gal' ? convertLitresToGallons(litres) : litres);
  const formatMileage = (kmPerL: number) =>
    formatNumber(convertMileageFromCanonical(kmPerL, prefs.efficiencyUnit), 1);

  const hasLogs = derivedLogs.length > 0;
  const hasMileage = !!summary && summary.averageMileage !== null && summary.averageMileage > 0;

  const chart = useMemo(
    () => computeFuelBars(derivedLogs, range, volUnit),
    [derivedLogs, range, volUnit]
  );

  const costPerDistance =
    summary && summary.averageCostPerKm !== null
      ? prefs.distanceUnit === 'mi'
        ? summary.averageCostPerKm * KM_PER_MILE
        : summary.averageCostPerKm
      : null;

  const visibleLogs = showAll ? derivedLogs : derivedLogs.slice(0, RECENT_COUNT);

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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#34D399"
            progressBackgroundColor={Colors.surface}
            colors={[Colors.primary]}
          />
        }
      >
        <FadeInUpView index={0}>
          <ScreenHeader
            title="Fuel Log"
            subtitle="Track your fuel, ride further."
            right={
              <HeaderIconButton
                label="Add fuel entry"
                accent
                onPress={() => router.push({ pathname: '/fuel-entry', params: { vehicleId } })}
                icon={<Plus size={19} color={UI.accent} strokeWidth={2} />}
              />
            }
          />
        </FadeInUpView>

        {loaded && !hasLogs ? (
          <FadeInUpView index={1}>
            <EmptyState
              icon={<Fuel size={22} color={UI.accent} strokeWidth={1.8} />}
              title="No fuel logs yet"
              message="No fuel logs yet. Tap + to add your first fill-up."
              actionLabel="Add fill-up"
              onAction={() => router.push({ pathname: '/fuel-entry', params: { vehicleId } })}
            />
          </FadeInUpView>
        ) : (
          <>
            {/* Summary */}
            <FadeInUpView index={1}>
              <Card>
                <View style={styles.summaryRow}>
                  <View style={styles.pumpBadge}>
                    <Fuel size={24} color={UI.accent} strokeWidth={1.7} />
                  </View>
                  <View style={styles.summaryCol}>
                    <Text style={styles.summaryLabel} numberOfLines={1}>
                      Total Fuel Consumed
                    </Text>
                    <View style={styles.valueRow}>
                      <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                        {summary && hasLogs ? formatNumber(toVolume(summary.totalFuelLitres), 1) : '—'}
                      </Text>
                      <Text style={styles.summaryUnit}>{volUnit}</Text>
                    </View>
                  </View>
                  <View style={styles.vDivider} />
                  <View style={styles.summaryCol}>
                    <Text style={styles.summaryLabel} numberOfLines={1}>
                      Avg. Mileage
                    </Text>
                    <View style={styles.valueRow}>
                      <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                        {hasMileage && summary?.averageMileage ? formatMileage(summary.averageMileage) : '—'}
                      </Text>
                      <Text style={styles.summaryUnit} numberOfLines={1}>
                        {prefs.efficiencyUnit}
                      </Text>
                    </View>
                  </View>
                </View>
                {summary && hasLogs ? (
                  <View style={styles.footerRow}>
                    <Text style={styles.footerText} numberOfLines={1}>
                      Total spent {formatDisplayCurrency(summary.totalCost, summary.primaryCurrency, 0)}
                      {costPerDistance !== null
                        ? `  ·  ${formatCurrencySymbol(summary.primaryCurrency)}${costPerDistance.toFixed(2)}/${prefs.distanceUnit}`
                        : ''}
                    </Text>
                  </View>
                ) : null}
              </Card>
            </FadeInUpView>

            {/* Chart */}
            <FadeInUpView index={2}>
              <Card style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <Text style={styles.cardTitle}>Fuel Consumption</Text>
                  <DropdownPill options={FUEL_RANGE_OPTIONS} value={range} onChange={setRange} title="Select range" />
                </View>
                {chart.hasData ? (
                  <BarChart
                    data={chart.bars}
                    formatY={(v) => `${formatNumber(v, 1)}${volUnit}`}
                  />
                ) : (
                  <View style={styles.chartEmpty}>
                    <Text style={styles.chartEmptyText}>No fuel logged in this period.</Text>
                  </View>
                )}
              </Card>
            </FadeInUpView>

            {/* Recent logs */}
            <FadeInUpView index={3}>
              <SectionHeader
                title="Recent Fuel Logs"
                actionLabel={derivedLogs.length > RECENT_COUNT ? (showAll ? 'Show less' : 'View all') : undefined}
                onAction={() => setShowAll((v) => !v)}
              />
              {visibleLogs.map((log) => {
                const secondary =
                  log.calculatedMileageKmPerL !== null
                    ? `${formatMileage(log.calculatedMileageKmPerL)} ${prefs.efficiencyUnit}`
                    : log.isStartOfChain
                      ? 'Baseline'
                      : log.isPartialFill
                        ? 'Partial fill'
                        : '—';
                return (
                  <ListRow
                    key={log.id}
                    leading={
                      <View style={styles.rowIcon}>
                        <Fuel size={20} color={UI.accent} strokeWidth={1.7} />
                      </View>
                    }
                    title={capitalize(log.fuelType)}
                    subtitle={formatDateTime(new Date(log.timestamp))}
                    right={`${formatNumber(toVolume(log.fuelAddedLitres), 1)} ${volUnit}`}
                    rightSecondary={secondary}
                    onPress={() => setSelectedLog(log)}
                    accessibilityLabel={`Fuel log ${log.logNumber}, ${capitalize(log.fuelType)}`}
                  />
                );
              })}
            </FadeInUpView>
          </>
        )}
      </ScrollView>

      <InfoSheet
        visible={!!selectedLog}
        title={selectedLog ? `Log ${String(selectedLog.logNumber).padStart(2, '0')}` : ''}
        subtitle={selectedLog ? formatDateTime(new Date(selectedLog.timestamp)) : undefined}
        onClose={() => setSelectedLog(null)}
      >
        <SheetAction icon={<Edit2 size={16} color={UI.textPrimary} />} label="Edit Log Entry" onPress={handleEditLog} />
        <SheetAction
          icon={<Trash2 size={16} color={Colors.danger} />}
          label="Delete Log Entry"
          destructive
          onPress={handleDeleteLog}
        />
      </InfoSheet>
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
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pumpBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: UI.accentBorder,
    backgroundColor: UI.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCol: {
    flex: 1,
    minWidth: 0,
  },
  vDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: UI.hairline,
  },
  summaryLabel: {
    color: UI.textSecondary,
    fontSize: 11.5,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 4,
  },
  summaryValue: {
    color: UI.textPrimary,
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  summaryUnit: {
    color: UI.textSecondary,
    fontSize: 12,
    flexShrink: 0,
  },
  footerRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: UI.hairline,
  },
  footerText: {
    color: UI.textSecondary,
    fontSize: 12.5,
  },
  chartCard: {
    marginTop: 14,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 10,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  cardTitle: {
    color: UI.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  chartEmpty: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartEmptyText: {
    color: UI.textMuted,
    fontSize: 13,
  },
  rowIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
