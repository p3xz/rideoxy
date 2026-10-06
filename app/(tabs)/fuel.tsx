import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';
import { Wordmark } from '../../components/svg/Wordmark';
import {
  FuelLog,
  DerivedFuelLog,
  FuelSummaryStatistics,
  FuelPreferences,
  DEFAULT_FUEL_PREFERENCES,
  CURRENCIES,
  CurrencyCode,
  DistanceUnit,
  VolumeUnit,
  FuelEfficiencyUnit,
} from '../../types/fuel';
import {
  getFuelLogsForVehicle,
  deleteFuelLog,
} from '../../database/fuelRepository';
import {
  getFuelPreferences,
  setFuelPreferences,
} from '../../database/fuelPreferencesRepository';
import { getBikeName } from '../../database/settingsRepository';
import {
  deriveFuelLogs,
  computeFuelSummary,
  formatDisplayCurrency,
  formatDisplayDistance,
  formatDisplayVolume,
  formatDisplayMileage,
  formatDisplayRate,
  formatCurrencySymbol,
} from '../../services/fuelCalculation';
import {
  Plus,
  Settings,
  MoreVertical,
  Edit2,
  Trash2,
  X,
} from 'lucide-react-native';

export default function FuelScreen() {
  const router = useRouter();

  const [derivedLogs, setDerivedLogs] = useState<DerivedFuelLog[]>([]);
  const [summary, setSummary] = useState<FuelSummaryStatistics | null>(null);
  const [prefs, setPrefs] = useState<FuelPreferences>(DEFAULT_FUEL_PREFERENCES);
  const [vehicleName, setVehicleName] = useState<string>('Primary Machine');
  const [vehicleId, setVehicleId] = useState<string>('default');

  const [refreshing, setRefreshing] = useState(false);
  const [selectedLog, setSelectedLog] = useState<DerivedFuelLog | null>(null);
  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [loadedPrefs, bike, logs] = await Promise.all([
        getFuelPreferences(),
        getBikeName(),
        getFuelLogsForVehicle(vehicleId),
      ]);

      setPrefs(loadedPrefs);
      if (bike) {
        setVehicleName(bike);
      }

      // Derive calculations on sorted logs
      const derived = deriveFuelLogs(logs);
      setDerivedLogs(derived);

      const stats = computeFuelSummary(derived, loadedPrefs.currency);
      setSummary(stats);
    } catch (err) {
      console.error('[rideoxy] Error loading fuel data:', err);
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

  const handleOpenActionMenu = (log: DerivedFuelLog) => {
    setSelectedLog(log);
    setActionMenuVisible(true);
  };

  const handleEditLog = () => {
    if (!selectedLog) return;
    setActionMenuVisible(false);
    router.push({
      pathname: '/fuel-entry',
      params: { id: selectedLog.id, vehicleId: selectedLog.vehicleId },
    });
  };

  const handleDeleteLog = () => {
    if (!selectedLog) return;
    setActionMenuVisible(false);

    Alert.alert(
      'Delete Fuel Log',
      `Delete log #${selectedLog.logNumber}? Subsequent mileage calculations will adjust automatically.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFuelLog(selectedLog.id);
              await loadData();
            } catch (err) {
              Alert.alert('Error', 'Failed to delete fuel log.');
            }
          },
        },
      ]
    );
  };

  const handleSavePreferences = async (newPrefs: Partial<FuelPreferences>) => {
    const updated = { ...prefs, ...newPrefs };
    setPrefs(updated);
    await setFuelPreferences(newPrefs);
    const stats = computeFuelSummary(derivedLogs, updated.currency);
    setSummary(stats);
  };

  const formatMonthYear = (timestampStr: string) => {
    const d = new Date(timestampStr);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const formatDateShort = (timestampStr: string) => {
    const d = new Date(timestampStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };

  // Render Top Header & Telemetry Summary Panel
  const renderHeader = () => {
    const hasData = summary && summary.hasEnoughData;

    return (
      <View style={styles.topSection}>
        {/* Brand Header */}
        <View style={styles.navHeader}>
          <Wordmark size="md" showTagline={false} />
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setSettingsModalVisible(true)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Settings size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Title & Machine Selector Row */}
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.screenHeading}>FUEL JOURNAL</Text>
            <Text style={styles.screenSubheading}>Sequential consumption logs</Text>
          </View>

          <View style={styles.machineSelector}>
            <Text style={styles.machineTag}>MACHINE</Text>
            <Text style={styles.machineName} numberOfLines={1}>
              {vehicleName.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Telemetry Summary Panel */}
        {hasData ? (
          <View style={styles.telemetryPanel}>
            {/* Primary Mileage Hero */}
            <View style={styles.heroMetricBlock}>
              <Text style={styles.telemetryLabel}>AVERAGE MILEAGE</Text>
              <View style={styles.heroValueRow}>
                <Text style={styles.heroValueText}>
                  {summary.averageMileage !== null
                    ? formatDisplayMileage(summary.averageMileage, prefs.efficiencyUnit, false)
                    : '—'}
                </Text>
                <Text style={styles.heroUnitText}>{prefs.efficiencyUnit}</Text>
              </View>
            </View>

            {/* Hairline Divider */}
            <View style={styles.panelDivider} />

            {/* 4-Cell Telemetry Metrics */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricCell}>
                <Text style={styles.cellLabel}>LAST REFUEL</Text>
                <Text style={styles.cellValue}>
                  {summary.lastRefuelDate
                    ? new Date(summary.lastRefuelDate)
                        .toLocaleDateString('en-US', { day: '2-digit', month: 'short' })
                        .toUpperCase()
                    : '—'}
                </Text>
              </View>

              <View style={styles.metricCell}>
                <Text style={styles.cellLabel}>LAST PRICE</Text>
                <Text style={styles.cellValue}>
                  {summary.lastFuelPrice !== null
                    ? formatDisplayRate(
                        summary.lastFuelPrice,
                        summary.lastFuelPriceCurrency,
                        prefs.volumeUnit
                      )
                    : '—'}
                </Text>
              </View>

              <View style={styles.metricCell}>
                <Text style={styles.cellLabel}>TOTAL SPENT</Text>
                <Text style={styles.cellValue}>
                  {formatDisplayCurrency(summary.totalCost, summary.primaryCurrency, 0)}
                </Text>
              </View>

              <View style={styles.metricCell}>
                <Text style={styles.cellLabel}>
                  COST / {prefs.distanceUnit.toUpperCase()}
                </Text>
                <Text style={styles.cellValue}>
                  {summary.averageCostPerKm !== null
                    ? `${formatCurrencySymbol(summary.primaryCurrency)}${summary.averageCostPerKm.toFixed(2)}`
                    : '—'}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.emptyTelemetryPanel}>
            <Text style={styles.emptyTitle}>NO FUEL RECORDS</Text>
            <Text style={styles.emptySubtitle}>
              Register your fuel entries below to track fuel efficiency and cost telemetry.
            </Text>
          </View>
        )}

        {/* Primary Action Button */}
        <TouchableOpacity
          style={styles.primaryActionBtn}
          onPress={() =>
            router.push({ pathname: '/fuel-entry', params: { vehicleId } })
          }
          activeOpacity={0.85}
        >
          <Plus size={18} color="#0C0E12" strokeWidth={2.8} />
          <Text style={styles.primaryActionBtnText}>
            {hasData ? 'REGISTER FUEL ENTRY' : 'REGISTER FIRST ENTRY'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render Chronological Machine Journal Item
  const renderLogItem = ({ item, index }: { item: DerivedFuelLog; index: number }) => {
    const isNewMonth =
      index === 0 ||
      formatMonthYear(item.timestamp) !==
        formatMonthYear(derivedLogs[index - 1].timestamp);

    const logCurrency = item.currency || 'INR';
    const logNumberFormatted = String(item.logNumber).padStart(2, '0');

    return (
      <View style={styles.journalItemWrapper}>
        {/* Month Section Header */}
        {isNewMonth && (
          <View style={styles.monthHeaderRow}>
            <Text style={styles.monthHeaderText}>
              {formatMonthYear(item.timestamp).toUpperCase()}
            </Text>
            <View style={styles.monthHeaderLine} />
          </View>
        )}

        {/* Machine Log Row */}
        <View style={styles.journalCard}>
          {/* Header Row: Technical Log Number + Date + Action Menu */}
          <View style={styles.journalTopRow}>
            <View style={styles.journalMetaLeft}>
              <Text style={styles.logIndexText}>LOG {logNumberFormatted}</Text>
              <Text style={styles.logDateText}>{formatDateShort(item.timestamp)}</Text>
            </View>

            <TouchableOpacity
              style={styles.actionMenuBtn}
              onPress={() => handleOpenActionMenu(item)}
              activeOpacity={0.6}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MoreVertical size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Primary Telemetry: Odometer & Total Cost */}
          <View style={styles.primaryTelemetryRow}>
            <Text style={styles.odometerValue}>
              {formatDisplayDistance(item.odometer, prefs.distanceUnit)}
            </Text>
            <Text style={styles.costValue}>
              {formatDisplayCurrency(item.totalCost, logCurrency)}
            </Text>
          </View>

          {/* Quantity & Rate Sub-line */}
          <Text style={styles.fuelSubline}>
            {formatDisplayVolume(item.fuelAddedLitres, prefs.volumeUnit)} ·{' '}
            {formatDisplayRate(item.pricePerLitre, logCurrency, prefs.volumeUnit)}
          </Text>

          {/* Interval Telemetry Row */}
          <View style={styles.intervalRow}>
            {item.isStartOfChain ? (
              <Text style={styles.intervalStartingText}>
                Baseline fill · Mileage computed on next full tank
              </Text>
            ) : (
              <View style={styles.intervalDataContainer}>
                <Text style={styles.intervalDistanceText}>
                  {item.distanceSincePreviousKm !== null
                    ? `${formatDisplayDistance(item.distanceSincePreviousKm, prefs.distanceUnit)} since previous`
                    : '—'}
                </Text>

                <View style={styles.intervalMetricsRight}>
                  {item.calculatedMileageKmPerL !== null ? (
                    <Text style={styles.intervalMileageText}>
                      {formatDisplayMileage(
                        item.calculatedMileageKmPerL,
                        prefs.efficiencyUnit
                      )}
                    </Text>
                  ) : (
                    <Text style={styles.intervalPartialText}>
                      {item.isPartialFill ? 'Partial fill' : '—'}
                    </Text>
                  )}

                  {item.costPerKm !== null && (
                    <Text style={styles.intervalCostKmText}>
                      · {formatCurrencySymbol(logCurrency)}
                      {item.costPerKm.toFixed(2)}/{prefs.distanceUnit}
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>

          {/* Bottom Technical Metadata & Notes */}
          <View style={styles.journalBottomRow}>
            <Text style={styles.technicalTagText}>
              {item.fuelType.toUpperCase()} ·{' '}
              {item.fullTank ? 'FULL TANK' : 'PARTIAL FILL'}
            </Text>

            {item.note ? (
              <Text style={styles.logNoteText} numberOfLines={1}>
                {item.note}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <FlatList
        data={derivedLogs}
        keyExtractor={(item) => item.id}
        renderItem={renderLogItem}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
      />

      {/* Contextual Action Modal */}
      <Modal
        visible={actionMenuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setActionMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setActionMenuVisible(false)}
        >
          <View style={styles.actionSheet}>
            <View style={styles.actionSheetHeader}>
              <Text style={styles.actionSheetTitle}>
                LOG {selectedLog ? String(selectedLog.logNumber).padStart(2, '0') : ''}
              </Text>
              <Text style={styles.actionSheetSubtitle}>
                {selectedLog ? formatDateShort(selectedLog.timestamp) : ''}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={handleEditLog}
              activeOpacity={0.7}
            >
              <Edit2 size={16} color={Colors.text} />
              <Text style={styles.actionSheetItemText}>Edit Log Entry</Text>
            </TouchableOpacity>

            <View style={styles.actionSheetDivider} />

            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={handleDeleteLog}
              activeOpacity={0.7}
            >
              <Trash2 size={16} color={Colors.danger} />
              <Text
                style={[styles.actionSheetItemText, { color: Colors.danger }]}
              >
                Delete Log Entry
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Technical Preferences Modal */}
      <Modal
        visible={settingsModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSettingsModalVisible(false)}
      >
        <View style={styles.prefModalWrapper}>
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom', 'left', 'right']}>
            <View style={styles.prefModalHeader}>
              <Text style={styles.prefModalTitle}>FUEL PREFERENCES</Text>
              <TouchableOpacity
                onPress={() => setSettingsModalVisible(false)}
                style={styles.prefCloseButton}
                activeOpacity={0.7}
              >
                <X size={18} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={[]}
              renderItem={null}
              ListHeaderComponent={
                <View style={styles.prefModalBody}>
                  {/* Currency Selection */}
                  <View style={styles.prefSectionBlock}>
                    <Text style={styles.prefSectionLabel}>
                      DEFAULT CURRENCY (NEW ENTRIES)
                    </Text>
                    <View style={styles.prefGridRow}>
                      {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => {
                        const curr = CURRENCIES[code];
                        const isSelected = prefs.currency === code;
                        return (
                          <TouchableOpacity
                            key={code}
                            style={[
                              styles.prefPillBtn,
                              isSelected && styles.prefPillBtnActive,
                            ]}
                            onPress={() =>
                              handleSavePreferences({ currency: code })
                            }
                            activeOpacity={0.8}
                          >
                            <Text
                              style={[
                                styles.prefPillBtnText,
                                isSelected && styles.prefPillBtnTextActive,
                              ]}
                            >
                              {curr.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Distance Unit */}
                  <View style={styles.prefSectionBlock}>
                    <Text style={styles.prefSectionLabel}>DISTANCE UNIT</Text>
                    <View style={styles.prefSegmentedRow}>
                      {(['km', 'mi'] as DistanceUnit[]).map((unit) => {
                        const isSelected = prefs.distanceUnit === unit;
                        return (
                          <TouchableOpacity
                            key={unit}
                            style={[
                              styles.prefSegmentBtn,
                              isSelected && styles.prefSegmentBtnActive,
                            ]}
                            onPress={() =>
                              handleSavePreferences({ distanceUnit: unit })
                            }
                            activeOpacity={0.8}
                          >
                            <Text
                              style={[
                                styles.prefSegmentBtnText,
                                isSelected && styles.prefSegmentBtnTextActive,
                              ]}
                            >
                              {unit === 'km' ? 'Kilometres (km)' : 'Miles (mi)'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Fuel Volume Unit */}
                  <View style={styles.prefSectionBlock}>
                    <Text style={styles.prefSectionLabel}>FUEL VOLUME UNIT</Text>
                    <View style={styles.prefSegmentedRow}>
                      {(['L', 'gal'] as VolumeUnit[]).map((unit) => {
                        const isSelected = prefs.volumeUnit === unit;
                        return (
                          <TouchableOpacity
                            key={unit}
                            style={[
                              styles.prefSegmentBtn,
                              isSelected && styles.prefSegmentBtnActive,
                            ]}
                            onPress={() =>
                              handleSavePreferences({ volumeUnit: unit })
                            }
                            activeOpacity={0.8}
                          >
                            <Text
                              style={[
                                styles.prefSegmentBtnText,
                                isSelected && styles.prefSegmentBtnTextActive,
                              ]}
                            >
                              {unit === 'L' ? 'Litres (L)' : 'Gallons (gal)'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Fuel Efficiency Unit */}
                  <View style={styles.prefSectionBlock}>
                    <Text style={styles.prefSectionLabel}>
                      FUEL EFFICIENCY UNIT
                    </Text>
                    <View style={styles.prefGridRow}>
                      {(
                        [
                          'km/L',
                          'L/100km',
                          'mpg (US)',
                          'mpg (UK)',
                        ] as FuelEfficiencyUnit[]
                      ).map((unit) => {
                        const isSelected = prefs.efficiencyUnit === unit;
                        return (
                          <TouchableOpacity
                            key={unit}
                            style={[
                              styles.prefPillBtn,
                              isSelected && styles.prefPillBtnActive,
                            ]}
                            onPress={() =>
                              handleSavePreferences({ efficiencyUnit: unit })
                            }
                            activeOpacity={0.8}
                          >
                            <Text
                              style={[
                                styles.prefPillBtnText,
                                isSelected && styles.prefPillBtnTextActive,
                              ]}
                            >
                              {unit}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>
              }
            />
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
  },
  topSection: {
    marginBottom: 14,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  screenHeading: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  screenSubheading: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  machineSelector: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    alignItems: 'flex-end',
    maxWidth: '50%',
  },
  machineTag: {
    color: Colors.textMuted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },
  machineName: {
    color: Colors.text,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 1,
  },
  telemetryPanel: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: 12,
  },
  heroMetricBlock: {
    marginBottom: 12,
  },
  telemetryLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  heroValueText: {
    color: Colors.text,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  heroUnitText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  panelDivider: {
    height: 1,
    backgroundColor: Colors.surfaceBorder,
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricCell: {
    flex: 1,
  },
  cellLabel: {
    color: Colors.textMuted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  cellValue: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  emptyTelemetryPanel: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: 12,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  primaryActionBtn: {
    backgroundColor: Colors.primary,
    height: 48,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryActionBtnText: {
    color: '#0C0E12',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  journalItemWrapper: {
    marginBottom: 8,
  },
  monthHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    marginBottom: 8,
  },
  monthHeaderText: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  monthHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.surfaceBorder,
  },
  journalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  journalTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  journalMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logIndexText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  logDateText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  actionMenuBtn: {
    padding: 2,
  },
  primaryTelemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  odometerValue: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  costValue: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  fuelSubline: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    fontVariant: ['tabular-nums'],
  },
  intervalRow: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
    marginBottom: 8,
  },
  intervalStartingText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  intervalDataContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  intervalDistanceText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  intervalMetricsRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  intervalMileageText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  intervalPartialText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  intervalCostKmText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  journalBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  technicalTagText: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  logNoteText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
    maxWidth: '50%',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(8, 10, 14, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  actionSheet: {
    width: '100%',
    maxWidth: 280,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  actionSheetHeader: {
    marginBottom: 12,
    alignItems: 'center',
  },
  actionSheetTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  actionSheetSubtitle: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  actionSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  actionSheetItemText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  actionSheetDivider: {
    height: 1,
    backgroundColor: Colors.surfaceBorder,
    marginVertical: 4,
  },
  prefModalWrapper: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  prefModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  prefModalTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  prefCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefModalBody: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  prefSectionBlock: {
    marginBottom: 20,
  },
  prefSectionLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  prefGridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  prefPillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  prefPillBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  prefPillBtnText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  prefPillBtnTextActive: {
    color: '#0C0E12',
    fontWeight: '900',
  },
  prefSegmentedRow: {
    flexDirection: 'row',
    gap: 6,
  },
  prefSegmentBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  prefSegmentBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  prefSegmentBtnText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  prefSegmentBtnTextActive: {
    color: '#0C0E12',
    fontWeight: '900',
  },
});
