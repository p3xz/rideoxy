import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Switch,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import {
  FuelType,
  FuelInputMode,
  CurrencyCode,
  FuelPreferences,
  DEFAULT_FUEL_PREFERENCES,
  FuelLog,
} from '../types/fuel';
import {
  createFuelLog,
  updateFuelLog,
  getFuelLogById,
  getLatestFuelLogForVehicle,
} from '../database/fuelRepository';
import {
  getFuelPreferences,
  setFuelPreferences,
} from '../database/fuelPreferencesRepository';
import { getBikeName } from '../database/settingsRepository';
import {
  formatCurrencySymbol,
  formatDisplayDistance,
  convertKmToMiles,
  convertMilesToKm,
  convertLitresToGallons,
  convertGallonsToLitres,
} from '../services/fuelCalculation';
import {
  ChevronLeft,
  Check,
  AlertCircle,
} from 'lucide-react-native';

export default function FuelEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; vehicleId?: string }>();
  const isEditing = !!params.id;

  const [prefs, setPrefs] = useState<FuelPreferences>(DEFAULT_FUEL_PREFERENCES);
  const [vehicleName, setVehicleName] = useState<string>('Primary Machine');
  const [vehicleId, setVehicleId] = useState<string>(params.vehicleId || 'default');

  // Form states
  const [odometerInput, setOdometerInput] = useState<string>('');
  const [previousOdometerKm, setPreviousOdometerKm] = useState<number | null>(null);
  const [fuelType, setFuelType] = useState<FuelType>('petrol');
  const [inputMode, setInputMode] = useState<FuelInputMode>('litres');

  const [litresInput, setLitresInput] = useState<string>('');
  const [amountInput, setAmountInput] = useState<string>('');
  const [rateInput, setRateInput] = useState<string>('');
  const [lastUsedRate, setLastUsedRate] = useState<number | null>(null);
  const [currency, setCurrency] = useState<CurrencyCode>('INR');

  const [fullTank, setFullTank] = useState<boolean>(true);
  const [timestamp, setTimestamp] = useState<string>(new Date().toISOString());
  const [noteInput, setNoteInput] = useState<string>('');
  const [manuallyAdjusted, setManuallyAdjusted] = useState<boolean>(false);

  // Mismatch prompt state
  const [mismatchState, setMismatchState] = useState<{
    show: boolean;
    calculatedVal: number;
    enteredVal: number;
    mode: FuelInputMode;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    async function initForm() {
      try {
        const [loadedPrefs, bike, latestLog] = await Promise.all([
          getFuelPreferences(),
          getBikeName(),
          getLatestFuelLogForVehicle(params.vehicleId || 'default'),
        ]);

        setPrefs(loadedPrefs);
        setFuelType(loadedPrefs.defaultFuelType);
        setCurrency(loadedPrefs.currency);

        if (bike) {
          setVehicleName(bike);
        }

        if (latestLog) {
          setPreviousOdometerKm(latestLog.odometer);
          setLastUsedRate(latestLog.pricePerLitre);
          if (!isEditing) {
            setRateInput(latestLog.pricePerLitre.toString());
            setFuelType(latestLog.fuelType);
            setCurrency(latestLog.currency);
          }
        } else if (!isEditing) {
          setRateInput(loadedPrefs.currency === 'INR' ? '103.00' : '3.50');
        }

        if (isEditing && params.id) {
          const log = await getFuelLogById(params.id);
          if (log) {
            const displayOdo =
              loadedPrefs.distanceUnit === 'mi'
                ? convertKmToMiles(log.odometer)
                : log.odometer;
            const displayLitres =
              loadedPrefs.volumeUnit === 'gal'
                ? convertLitresToGallons(log.fuelAddedLitres)
                : log.fuelAddedLitres;

            setOdometerInput(displayOdo.toString());
            setFuelType(log.fuelType);
            setInputMode(log.inputMode);
            setLitresInput(displayLitres.toFixed(2));
            setAmountInput(log.totalCost.toFixed(2));
            setRateInput(log.pricePerLitre.toString());
            setCurrency(log.currency);
            setFullTank(log.fullTank);
            setTimestamp(log.timestamp);
            setNoteInput(log.note || '');
            setManuallyAdjusted(log.manuallyAdjusted);
          }
        }
      } catch (err) {
        console.error('[rideoxy] Error initializing fuel form:', err);
      }
    }

    initForm();
  }, [isEditing, params.id, params.vehicleId]);

  // Handle Litres input change
  const handleLitresChange = (text: string) => {
    setLitresInput(text);
    setMismatchState(null);

    const litres = parseFloat(text);
    const rate = parseFloat(rateInput);

    if (inputMode === 'litres' && !isNaN(litres) && litres > 0 && !isNaN(rate) && rate > 0) {
      const calcTotal = litres * rate;
      setAmountInput(calcTotal.toFixed(2));
      setManuallyAdjusted(false);
    }
  };

  // Handle Rate input change
  const handleRateChange = (text: string) => {
    setRateInput(text);
    setMismatchState(null);

    const rate = parseFloat(text);
    if (!isNaN(rate) && rate > 0) {
      if (inputMode === 'litres') {
        const litres = parseFloat(litresInput);
        if (!isNaN(litres) && litres > 0) {
          const calcTotal = litres * rate;
          setAmountInput(calcTotal.toFixed(2));
        }
      } else if (inputMode === 'amount') {
        const amount = parseFloat(amountInput);
        if (!isNaN(amount) && amount > 0) {
          const calcLitres = amount / rate;
          setLitresInput(calcLitres.toFixed(3));
        }
      }
    }
  };

  // Handle Amount input change
  const handleAmountChange = (text: string) => {
    setAmountInput(text);
    setMismatchState(null);

    const amount = parseFloat(text);
    const rate = parseFloat(rateInput);

    if (inputMode === 'amount' && !isNaN(amount) && amount > 0 && !isNaN(rate) && rate > 0) {
      const calcLitres = amount / rate;
      setLitresInput(calcLitres.toFixed(3));
      setManuallyAdjusted(false);
    } else if (inputMode === 'litres') {
      const litres = parseFloat(litresInput);
      if (!isNaN(litres) && litres > 0 && !isNaN(rate) && rate > 0) {
        const expected = litres * rate;
        if (Math.abs(amount - expected) > 0.05) {
          setManuallyAdjusted(true);
        }
      }
    }
  };

  // Switch between Litres and Amount calculation modes
  const handleModeSwitch = (newMode: FuelInputMode) => {
    setInputMode(newMode);
    setMismatchState(null);

    const rate = parseFloat(rateInput);
    if (newMode === 'litres') {
      const litres = parseFloat(litresInput);
      if (!isNaN(litres) && litres > 0 && !isNaN(rate) && rate > 0) {
        setAmountInput((litres * rate).toFixed(2));
      }
    } else {
      const amount = parseFloat(amountInput);
      if (!isNaN(amount) && amount > 0 && !isNaN(rate) && rate > 0) {
        setLitresInput((amount / rate).toFixed(3));
      }
    }
  };

  const handleApplyLastRate = () => {
    if (lastUsedRate !== null) {
      handleRateChange(lastUsedRate.toString());
    }
  };

  // Resolve calculation mismatch
  const handleResolveMismatchUseCalc = () => {
    if (!mismatchState) return;
    if (mismatchState.mode === 'litres') {
      setAmountInput(mismatchState.calculatedVal.toFixed(2));
    } else {
      setLitresInput(mismatchState.calculatedVal.toFixed(3));
    }
    setManuallyAdjusted(false);
    setMismatchState(null);
  };

  const handleResolveMismatchKeepEntered = () => {
    setManuallyAdjusted(true);
    setMismatchState(null);
  };

  const handleSave = async () => {
    const odoNum = parseFloat(odometerInput);
    const litresNum = parseFloat(litresInput);
    const rateNum = parseFloat(rateInput);
    const amountNum = parseFloat(amountInput);

    if (isNaN(odoNum) || odoNum <= 0) {
      Alert.alert('Invalid Odometer', 'Please enter a valid positive odometer reading.');
      return;
    }

    const canonicalOdoKm =
      prefs.distanceUnit === 'mi' ? convertMilesToKm(odoNum) : odoNum;

    if (
      !isEditing &&
      previousOdometerKm !== null &&
      canonicalOdoKm < previousOdometerKm
    ) {
      Alert.alert(
        'Invalid Odometer',
        `Odometer (${Math.round(odoNum)} ${prefs.distanceUnit}) cannot be lower than previous entry (${Math.round(
          prefs.distanceUnit === 'mi'
            ? convertKmToMiles(previousOdometerKm)
            : previousOdometerKm
        )} ${prefs.distanceUnit}).`
      );
      return;
    }

    if (isNaN(litresNum) || litresNum <= 0) {
      Alert.alert('Invalid Fuel Quantity', 'Please enter the fuel volume added.');
      return;
    }

    if (isNaN(rateNum) || rateNum <= 0) {
      Alert.alert('Invalid Price', 'Please enter the fuel price per unit.');
      return;
    }

    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Invalid Total', 'Please enter the total amount paid.');
      return;
    }

    const canonicalLitres =
      prefs.volumeUnit === 'gal' ? convertGallonsToLitres(litresNum) : litresNum;

    const expectedAmount = litresNum * rateNum;
    if (
      !manuallyAdjusted &&
      Math.abs(amountNum - expectedAmount) > 1.0 &&
      inputMode === 'litres'
    ) {
      setMismatchState({
        show: true,
        calculatedVal: expectedAmount,
        enteredVal: amountNum,
        mode: 'litres',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const nowEpoch = Date.now();
      const logId = isEditing && params.id ? params.id : `fuel_${nowEpoch}_${Math.random().toString(36).substring(2, 6)}`;

      const fuelLogData: FuelLog = {
        id: logId,
        vehicleId: vehicleId,
        odometer: canonicalOdoKm,
        fuelAddedLitres: canonicalLitres,
        pricePerLitre: rateNum,
        totalCost: amountNum,
        currency: currency,
        fuelType: fuelType,
        fullTank: fullTank,
        timestamp: timestamp,
        inputMode: inputMode,
        manuallyAdjusted: manuallyAdjusted,
        note: noteInput.trim() || undefined,
        createdAt: nowEpoch,
      };

      if (isEditing) {
        await updateFuelLog(logId, fuelLogData);
      } else {
        await createFuelLog(fuelLogData);
      }

      await setFuelPreferences({ defaultFuelType: fuelType });
      router.back();
    } catch (err) {
      console.error('[rideoxy] Error saving fuel log:', err);
      Alert.alert('Error', 'Failed to save fuel log record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currSymbol = formatCurrencySymbol(currency);
  const parsedLitres = parseFloat(litresInput) || 0;
  const parsedRate = parseFloat(rateInput) || 0;
  const parsedAmount = parseFloat(amountInput) || 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditing ? 'EDIT FUEL ENTRY' : 'REGISTER FUEL'}
        </Text>
        <View style={{ width: 34 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Machine Tag */}
          <View style={styles.machineTagBlock}>
            <Text style={styles.machineLabel}>MACHINE</Text>
            <Text style={styles.machineName}>{vehicleName.toUpperCase()}</Text>
          </View>

          {/* Odometer Section */}
          <View style={styles.fieldSection}>
            <View style={styles.fieldHeaderRow}>
              <Text style={styles.fieldLabel}>ODOMETER</Text>
              {previousOdometerKm !== null && (
                <Text style={styles.previousOdoText}>
                  Previous: {formatDisplayDistance(previousOdometerKm, prefs.distanceUnit)}
                </Text>
              )}
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.numericTextInput}
                value={odometerInput}
                onChangeText={setOdometerInput}
                placeholder="e.g. 10950"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                returnKeyType="next"
              />
              <View style={styles.unitSuffix}>
                <Text style={styles.unitSuffixText}>{prefs.distanceUnit.toUpperCase()}</Text>
              </View>
            </View>
          </View>

          {/* Fuel Type Selector */}
          <View style={styles.fieldSection}>
            <Text style={styles.fieldLabel}>FUEL TYPE</Text>
            <View style={styles.segmentedRow}>
              {(['petrol', 'diesel', 'cng'] as FuelType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.segmentBtn,
                    fuelType === type && styles.segmentBtnActive,
                  ]}
                  onPress={() => setFuelType(type)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.segmentBtnText,
                      fuelType === type && styles.segmentBtnTextActive,
                    ]}
                  >
                    {type.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Entry Mode Selector */}
          <View style={styles.fieldSection}>
            <Text style={styles.fieldLabel}>ENTRY MODE</Text>
            <View style={styles.segmentedRow}>
              <TouchableOpacity
                style={[
                  styles.segmentBtn,
                  inputMode === 'litres' && styles.segmentBtnActive,
                ]}
                onPress={() => handleModeSwitch('litres')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    inputMode === 'litres' && styles.segmentBtnTextActive,
                  ]}
                >
                  By Quantity ({prefs.volumeUnit})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.segmentBtn,
                  inputMode === 'amount' && styles.segmentBtnActive,
                ]}
                onPress={() => handleModeSwitch('amount')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    inputMode === 'amount' && styles.segmentBtnTextActive,
                  ]}
                >
                  By Total ({currSymbol})
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Fuel Telemetry Inputs */}
          <View style={styles.cardContainer}>
            {/* Quantity */}
            <View style={styles.fieldSubBlock}>
              <Text style={styles.fieldLabel}>
                QUANTITY {inputMode === 'amount' && '(CALCULATED)'}
              </Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[
                    styles.numericTextInput,
                    inputMode === 'amount' && styles.textInputHighlight,
                  ]}
                  value={litresInput}
                  onChangeText={handleLitresChange}
                  placeholder="5.00"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="decimal-pad"
                />
                <View style={styles.unitSuffix}>
                  <Text style={styles.unitSuffixText}>{prefs.volumeUnit}</Text>
                </View>
              </View>
            </View>

            {/* Price / Rate */}
            <View style={styles.fieldSubBlock}>
              <View style={styles.fieldHeaderRow}>
                <Text style={styles.fieldLabel}>PRICE PER UNIT</Text>
                {lastUsedRate !== null && (
                  <TouchableOpacity
                    onPress={handleApplyLastRate}
                    style={styles.lastPriceLink}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.lastPriceText}>
                      Apply last: {currSymbol}
                      {lastUsedRate.toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.numericTextInput}
                  value={rateInput}
                  onChangeText={handleRateChange}
                  placeholder="103.00"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="decimal-pad"
                />
                <View style={styles.unitSuffix}>
                  <Text style={styles.unitSuffixText}>
                    {currSymbol}/{prefs.volumeUnit}
                  </Text>
                </View>
              </View>
            </View>

            {/* Total Amount */}
            <View style={styles.fieldSubBlock}>
              <View style={styles.fieldHeaderRow}>
                <Text style={styles.fieldLabel}>
                  TOTAL AMOUNT {inputMode === 'litres' && '(CALCULATED)'}
                </Text>
                {manuallyAdjusted && (
                  <Text style={styles.manualOverrideTag}>OVERRIDE</Text>
                )}
              </View>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[
                    styles.numericTextInput,
                    inputMode === 'litres' && styles.textInputHighlight,
                  ]}
                  value={amountInput}
                  onChangeText={handleAmountChange}
                  placeholder="515.00"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="decimal-pad"
                />
                <View style={styles.unitSuffix}>
                  <Text style={styles.unitSuffixText}>{currSymbol}</Text>
                </View>
              </View>
            </View>

            {/* Mismatch Conflict Resolution Banner */}
            {mismatchState && (
              <View style={styles.conflictBanner}>
                <AlertCircle size={15} color={Colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.conflictTitle}>Calculation mismatch</Text>
                  <Text style={styles.conflictSubtitle}>
                    Formula total: {currSymbol}
                    {mismatchState.calculatedVal.toFixed(2)} · Entered: {currSymbol}
                    {mismatchState.enteredVal.toFixed(2)}
                  </Text>
                  <View style={styles.conflictButtonsRow}>
                    <TouchableOpacity
                      style={styles.conflictBtnPrimary}
                      onPress={handleResolveMismatchUseCalc}
                    >
                      <Text style={styles.conflictBtnPrimaryText}>
                        Use {currSymbol}
                        {mismatchState.calculatedVal.toFixed(2)}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.conflictBtnSecondary}
                      onPress={handleResolveMismatchKeepEntered}
                    >
                      <Text style={styles.conflictBtnSecondaryText}>
                        Keep {currSymbol}
                        {mismatchState.enteredVal.toFixed(2)}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Mathematical Readout */}
            {parsedLitres > 0 && parsedRate > 0 && (
              <View style={styles.formulaReadout}>
                <Text style={styles.formulaEquation}>
                  {inputMode === 'litres'
                    ? `${parsedLitres.toFixed(2)} ${prefs.volumeUnit} × ${currSymbol}${parsedRate.toFixed(2)}/${prefs.volumeUnit}`
                    : `${currSymbol}${parsedAmount.toFixed(2)} ÷ ${currSymbol}${parsedRate.toFixed(2)}/${prefs.volumeUnit}`}
                </Text>
                <Text style={styles.formulaTotalText}>
                  = {currSymbol}
                  {parsedAmount.toFixed(2)}
                </Text>
              </View>
            )}
          </View>

          {/* Full Tank Toggle */}
          <View style={styles.switchSection}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.switchTitle}>Filled tank completely</Text>
              <Text style={styles.switchSubtitle}>
                Enables sequential mileage calculation.
              </Text>
            </View>
            <Switch
              value={fullTank}
              onValueChange={setFullTank}
              trackColor={{ false: Colors.surfaceBorder, true: Colors.primaryDark }}
              thumbColor={fullTank ? Colors.primary : Colors.textSecondary}
            />
          </View>

          {/* Optional Notes */}
          <View style={styles.fieldSection}>
            <Text style={styles.fieldLabel}>NOTES (OPTIONAL)</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.numericTextInput, { fontSize: 14, fontWeight: '600' }]}
                value={noteInput}
                onChangeText={setNoteInput}
                placeholder="Station name, highway fuel stop, etc."
                placeholderTextColor={Colors.textMuted}
                maxLength={80}
              />
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            <Check size={18} color="#0C0E12" strokeWidth={2.8} />
            <Text style={styles.submitButtonText}>
              {isSubmitting
                ? 'SAVING...'
                : isEditing
                ? 'UPDATE FUEL ENTRY'
                : 'SAVE FUEL ENTRY'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  machineTagBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 14,
  },
  machineLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  machineName: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  fieldSection: {
    marginBottom: 12,
  },
  fieldSubBlock: {
    marginBottom: 10,
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  fieldLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  previousOdoText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: 12,
  },
  numericTextInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 16,
    fontWeight: '800',
    paddingVertical: 10,
    fontVariant: ['tabular-nums'],
  },
  textInputHighlight: {
    color: Colors.primary,
  },
  unitSuffix: {
    paddingLeft: 8,
  },
  unitSuffixText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 6,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  segmentBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  segmentBtnText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  segmentBtnTextActive: {
    color: '#0C0E12',
    fontWeight: '900',
  },
  cardContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: 12,
  },
  lastPriceLink: {
    paddingVertical: 2,
  },
  lastPriceText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  manualOverrideTag: {
    color: Colors.warning,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  conflictBanner: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: Colors.warningSurface,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
    marginTop: 4,
    marginBottom: 8,
  },
  conflictTitle: {
    color: Colors.warning,
    fontSize: 11,
    fontWeight: '800',
  },
  conflictSubtitle: {
    color: Colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
    marginBottom: 8,
  },
  conflictButtonsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  conflictBtnPrimary: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  conflictBtnPrimaryText: {
    color: '#0C0E12',
    fontSize: 10,
    fontWeight: '800',
  },
  conflictBtnSecondary: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  conflictBtnSecondaryText: {
    color: Colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
  formulaReadout: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
    marginTop: 4,
  },
  formulaEquation: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  formulaTotalText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  switchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: 12,
  },
  switchTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  switchSubtitle: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    height: 48,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  submitButtonText: {
    color: '#0C0E12',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
