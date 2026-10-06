import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Colors } from '../../constants/theme';
import { Wordmark } from '../../components/svg/Wordmark';
import { MotorcycleIllustration } from '../../components/svg/MotorcycleIllustration';
import { getBikeName, setBikeName } from '../../database/settingsRepository';
import { getOverallStatistics } from '../../database/statisticsService';
import { Check, Edit2, Shield, Wrench, Bike } from 'lucide-react-native';

export default function GarageScreen() {
  const [bikeInput, setBikeInput] = useState('');
  const [savedBike, setSavedBike] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [totalKm, setTotalKm] = useState(0);
  const [totalRides, setTotalRides] = useState(0);

  const loadGarageData = useCallback(async () => {
    try {
      const [storedName, stats] = await Promise.all([
        getBikeName(),
        getOverallStatistics(),
      ]);
      setSavedBike(storedName);
      setBikeInput(storedName);
      if (!storedName) {
        setIsEditing(true);
      } else {
        setIsEditing(false);
      }
      setTotalKm(stats.totalDistanceKm);
      setTotalRides(stats.totalRidesCount);
    } catch (err) {
      console.error('[rideoxy] Error loading garage data:', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadGarageData();
    }, [loadGarageData])
  );

  const handleSaveBike = async () => {
    const trimmed = bikeInput.trim();
    setIsSaving(true);
    try {
      await setBikeName(trimmed);
      setSavedBike(trimmed);
      setIsEditing(false);
    } catch (err) {
      Alert.alert('Error', 'Failed to save motorcycle name.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Wordmark size="md" showTagline={false} />
            <Text style={styles.headerTitle}>GARAGE</Text>
            <Text style={styles.headerSubtitle}>Machine profile & bay</Text>
          </View>

          {/* Motorcycle Illustration Card */}
          <View style={styles.illustrationCard}>
            <MotorcycleIllustration width={260} height={145} />
            <View style={styles.bayBadge}>
              <View style={styles.activeDot} />
              <Text style={styles.bayBadgeText}>ACTIVE MACHINE</Text>
            </View>
          </View>

          {/* Bike Name Input / Display Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconCircle}>
                <Wrench size={16} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardLabel}>MACHINE PROFILE</Text>
                <Text style={styles.cardDescription}>
                  Motorcycle make and model
                </Text>
              </View>
            </View>

            {isEditing ? (
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  value={bikeInput}
                  onChangeText={setBikeInput}
                  placeholder="e.g. Royal Enfield Continental GT 650"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleSaveBike}
                  maxLength={50}
                />

                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    !bikeInput.trim() && styles.saveButtonDisabled,
                  ]}
                  onPress={handleSaveBike}
                  disabled={isSaving}
                  activeOpacity={0.85}
                >
                  <Check size={16} color="#0C0E12" strokeWidth={2.8} />
                  <Text style={styles.saveButtonText}>
                    {isSaving ? 'SAVING...' : 'SAVE MACHINE'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.savedBikeContainer}>
                <View style={styles.savedBikeRow}>
                  <View style={styles.bikeNameBox}>
                    <Bike size={20} color={Colors.primary} />
                    <Text style={styles.savedBikeText} numberOfLines={1} ellipsizeMode="tail">
                      {savedBike || 'Unnamed Machine'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={handleEdit}
                    activeOpacity={0.7}
                  >
                    <Edit2 size={13} color={Colors.primary} />
                    <Text style={styles.editText}>EDIT</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Machine Telemetry Stats */}
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statBoxLabel}>LIFETIME DISTANCE</Text>
              <Text style={styles.statBoxValue}>{totalKm.toFixed(1)}</Text>
              <Text style={styles.statBoxUnit}>KM RECORDED</Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statBoxLabel}>LOGGED RIDES</Text>
              <Text style={styles.statBoxValue}>{totalRides}</Text>
              <Text style={styles.statBoxUnit}>SESSIONS</Text>
            </View>
          </View>

          {/* Local storage note */}
          <View style={styles.infoCard}>
            <Shield size={16} color={Colors.primary} />
            <Text style={styles.infoText}>
              Machine telemetry is stored exclusively in your device's local database.
            </Text>
          </View>
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
  illustrationCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: 12,
  },
  bayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.surfaceBorderHighlight,
    marginTop: 10,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  bayBadgeText: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  cardDescription: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  inputContainer: {
    gap: 10,
  },
  textInput: {
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: Colors.surfaceBorderHighlight,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#0C0E12',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  savedBikeContainer: {
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorderHighlight,
  },
  savedBikeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bikeNameBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    paddingRight: 8,
  },
  savedBikeText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  editText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  statBoxLabel: {
    color: Colors.textMuted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  statBoxValue: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  statBoxUnit: {
    color: Colors.primary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceSubtle,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  infoText: {
    flex: 1,
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
});
