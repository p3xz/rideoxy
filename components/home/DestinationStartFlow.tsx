import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import {
  Search,
  MapPin,
  Check,
  AlertTriangle,
  X,
  Navigation,
  Trash2,
  Bookmark,
} from 'lucide-react-native';
import { SegmentedPills } from '../ui/SegmentedPills';
import { RideMode } from '../../types/ride';
import {
  GeocodeResult,
  searchDestination,
  clampManualMinutes,
  formatManualMinutesInWords,
  isManualMinutesImplausible,
} from '../../services/etaService';
import { getSetting, setSetting, isExperimentalEnabled } from '../../database/settingsRepository';
import {
  SavedDestination,
  getSavedDestinations,
  saveDestination,
  touchDestinationLastUsed,
  deleteSavedDestination,
} from '../../database/savedDestinationsRepository';
import { getCurrentGPSFix } from '../../services/location';
import { Colors } from '../../constants/theme';
import { UI } from '../../constants/ui';
import { hapticFeedback } from '../../services/haptics';

interface DestinationStartFlowProps {
  mode: RideMode;
  onModeChange: (mode: RideMode) => void;
  selectedDestination: GeocodeResult | null;
  onSelectDestination: (dest: GeocodeResult | null) => void;
  manualMinutes: string;
  onChangeManualMinutes: (mins: string) => void;
}

const MODE_OPTIONS = [
  { key: 'free' as RideMode, label: 'Free Ride' },
  { key: 'destination' as RideMode, label: 'Destination' },
];

export const DestinationStartFlow: React.FC<DestinationStartFlowProps> = ({
  mode,
  onModeChange,
  selectedDestination,
  onSelectDestination,
  manualMinutes,
  onChangeManualMinutes,
}) => {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Experimental state
  const [experimentalActive, setExperimentalActive] = useState(false);
  const [savedDestinations, setSavedDestinations] = useState<SavedDestination[]>([]);
  const [savedPlaceNameModalVisible, setSavedPlaceNameModalVisible] = useState(false);
  const [currentFixCoords, setCurrentFixCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [currentFixPlaceName, setCurrentFixPlaceName] = useState('');
  const [savingCurrentFix, setSavingCurrentFix] = useState(false);
  const [locatingCurrentFix, setLocatingCurrentFix] = useState(false);
  const [savedStatusMap, setSavedStatusMap] = useState<Record<string, boolean>>({});

  // Check experimental features setting
  const refreshExperimentalSetting = useCallback(async () => {
    try {
      const enabled = await isExperimentalEnabled();
      setExperimentalActive(enabled);
      if (enabled) {
        const saved = await getSavedDestinations();
        setSavedDestinations(saved);
      } else {
        setSavedDestinations([]);
      }
    } catch {
      setExperimentalActive(false);
    }
  }, []);

  useEffect(() => {
    refreshExperimentalSetting();
  }, [refreshExperimentalSetting]);

  useFocusEffect(
    useCallback(() => {
      refreshExperimentalSetting();
    }, [refreshExperimentalSetting])
  );

  // When query changes, update matching saved destinations if experimental is enabled
  useEffect(() => {
    if (!experimentalActive) return;
    let active = true;
    getSavedDestinations(query)
      .then((items) => {
        if (active) setSavedDestinations(items);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [query, experimentalActive]);

  const handleSelectMode = async (nextMode: RideMode) => {
    if (nextMode === 'free') {
      setQuery('');
      setResults([]);
      setSearchError(null);
      onSelectDestination(null);
      onChangeManualMinutes('');
      onModeChange('free');
      return;
    }

    // Destination mode selected: check one-time privacy consent
    try {
      const ack = await getSetting('destination_mode_acknowledged');
      if (!ack) {
        Alert.alert(
          'Destination Mode Privacy',
          'Destination mode queries OpenStreetMap Nominatim when searching, and requests an upfront route estimate via Ola Directions (or OSRM fallback).\n\nFree Ride sends zero network requests, and zero data is transmitted during or after your ride.',
          [
            {
              text: 'Decline',
              style: 'cancel',
              onPress: () => {
                onModeChange('free');
              },
            },
            {
              text: 'I Understand',
              onPress: async () => {
                await setSetting('destination_mode_acknowledged', 'true');
                await refreshExperimentalSetting();
                onModeChange('destination');
              },
            },
          ]
        );
        return;
      }
    } catch {
      // Degrades gracefully
    }

    await refreshExperimentalSetting();
    onModeChange('destination');
  };

  /**
   * OpenStreetMap Nominatim search on explicit submit only.
   * Never fires per keystroke.
   */
  const handleSearchSubmit = async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchError('Please enter a destination name.');
      return;
    }

    setSearching(true);
    setSearchError(null);
    hapticFeedback.light();

    const response = await searchDestination(trimmed, 'destination');
    setSearching(false);

    if (response.success) {
      setResults(response.results);
      if (response.results.length === 0) {
        setSearchError('Place not found in OpenStreetMap.');
      }
    } else {
      setResults([]);
      setSearchError(response.message);
    }
  };

  const handlePickSearchResult = (dest: GeocodeResult) => {
    hapticFeedback.selection();
    onSelectDestination(dest);
    setResults([]);
  };

  const handleSelectSavedDestination = async (saved: SavedDestination) => {
    hapticFeedback.selection();
    onSelectDestination({
      place_id: saved.id,
      name: saved.name,
      display_name: saved.name,
      lat: saved.lat,
      lng: saved.lng,
      source: 'saved',
    });
    setResults([]);
    setQuery('');
    await touchDestinationLastUsed(saved.id).catch(() => {});
  };

  const handleDeleteSavedDestination = async (id: string, name: string) => {
    hapticFeedback.warning();
    await deleteSavedDestination(id);
    const updated = await getSavedDestinations(query);
    setSavedDestinations(updated);
  };

  const handleSaveSearchResult = async (dest: GeocodeResult) => {
    hapticFeedback.success();
    await saveDestination({
      name: dest.name,
      lat: dest.lat,
      lng: dest.lng,
    });
    setSavedStatusMap((prev) => ({ ...prev, [String(dest.place_id)]: true }));
    const updated = await getSavedDestinations(query);
    setSavedDestinations(updated);
  };

  const handleUseCurrentLocationPress = async () => {
    hapticFeedback.light();
    setLocatingCurrentFix(true);
    try {
      const fix = await getCurrentGPSFix();
      setLocatingCurrentFix(false);
      if (!fix) {
        Alert.alert(
          'GPS Location Unavailable',
          'Could not retrieve your current location. Please verify GPS permissions and signal.'
        );
        return;
      }
      setCurrentFixCoords({ lat: fix.latitude, lng: fix.longitude });
      setCurrentFixPlaceName('');
      setSavedPlaceNameModalVisible(true);
    } catch {
      setLocatingCurrentFix(false);
      Alert.alert('GPS Error', 'Failed to retrieve current GPS location.');
    }
  };

  const handleSaveCurrentFix = async () => {
    if (!currentFixCoords) return;
    const trimmed = currentFixPlaceName.trim();
    if (!trimmed) {
      Alert.alert('Name Required', 'Please enter a name for this location.');
      return;
    }

    setSavingCurrentFix(true);
    try {
      const saved = await saveDestination({
        name: trimmed,
        lat: currentFixCoords.lat,
        lng: currentFixCoords.lng,
      });
      setSavingCurrentFix(false);
      setSavedPlaceNameModalVisible(false);
      hapticFeedback.success();

      // Set directly as destination and update last used
      onSelectDestination({
        place_id: saved.id,
        name: saved.name,
        display_name: saved.name,
        lat: saved.lat,
        lng: saved.lng,
        source: 'saved',
      });
      await touchDestinationLastUsed(saved.id).catch(() => {});
      const updated = await getSavedDestinations();
      setSavedDestinations(updated);
    } catch {
      setSavingCurrentFix(false);
      Alert.alert('Save Failed', 'Could not save this destination to local storage.');
    }
  };

  const handleClearDestination = () => {
    hapticFeedback.light();
    onSelectDestination(null);
    setQuery('');
    setResults([]);
    setSearchError(null);
  };

  const parsedMinutes = parseInt(manualMinutes, 10);
  const hasValidMinutes = Number.isFinite(parsedMinutes) && parsedMinutes > 0;
  const clampedMinutes = hasValidMinutes ? clampManualMinutes(parsedMinutes) : null;
  const isImplausible = clampedMinutes ? isManualMinutesImplausible(clampedMinutes) : false;

  return (
    <View style={styles.container}>
      {/* 2-Option Segmented Control: Free Ride | Destination */}
      <View style={styles.pillsWrapper}>
        <SegmentedPills
          options={MODE_OPTIONS}
          value={mode}
          onChange={handleSelectMode}
        />
      </View>

      {/* Destination Mode Flow */}
      {mode === 'destination' && (
        <View style={styles.destinationPanel}>
          {/* Selected Destination Card */}
          {selectedDestination ? (
            <View style={styles.selectedDestinationCard}>
              <View style={styles.pinCircle}>
                <MapPin size={16} color={Colors.primary} />
              </View>
              <View style={styles.destTextWrap}>
                <Text style={styles.destName} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                  {selectedDestination.name}
                </Text>
                <Text style={styles.destSub} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                  {[selectedDestination.district, selectedDestination.state].filter(Boolean).join(', ') ||
                    selectedDestination.display_name}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleClearDestination}
                style={styles.clearBtn}
                accessibilityRole="button"
                accessibilityLabel="Clear selected destination"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={16} color={UI.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.searchSection}>
              {/* Search Input Row */}
              <View style={styles.searchRow}>
                <View style={styles.inputContainer}>
                  <MapPin size={16} color={UI.textMuted} style={styles.inputIcon} />
                  <TextInput
                    value={query}
                    onChangeText={(t) => {
                      setQuery(t);
                      if (searchError) setSearchError(null);
                    }}
                    onSubmitEditing={handleSearchSubmit}
                    returnKeyType="search"
                    placeholder="Where to? Type and tap Search"
                    placeholderTextColor={UI.textMuted}
                    style={styles.textInput}
                    autoCorrect={false}
                    maxFontSizeMultiplier={1.3}
                  />
                  {query.length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        setQuery('');
                        setResults([]);
                        setSearchError(null);
                      }}
                      style={styles.inputClearBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <X size={14} color={UI.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  onPress={handleSearchSubmit}
                  disabled={searching}
                  style={styles.searchSubmitBtn}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Search destination"
                >
                  {searching ? (
                    <ActivityIndicator size="small" color="#080A09" />
                  ) : (
                    <Search size={18} color="#080A09" />
                  )}
                </TouchableOpacity>
              </View>

              {/* Experimental Only: Use Current Location Button */}
              {experimentalActive && (
                <View style={styles.currentLocationRow}>
                  <TouchableOpacity
                    onPress={handleUseCurrentLocationPress}
                    disabled={locatingCurrentFix}
                    style={styles.currentLocationBtn}
                    activeOpacity={0.8}
                  >
                    {locatingCurrentFix ? (
                      <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 8 }} />
                    ) : (
                      <Navigation size={14} color={Colors.primary} style={{ marginRight: 8 }} />
                    )}
                    <Text style={styles.currentLocationBtnText} maxFontSizeMultiplier={1.3}>
                      Use current location
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Search Error Notice */}
              {searchError && (
                <View style={styles.errorNotice}>
                  <AlertTriangle size={14} color={Colors.warning} style={{ marginRight: 6 }} />
                  <Text style={styles.errorNoticeText} maxFontSizeMultiplier={1.3}>
                    {searchError}
                  </Text>
                </View>
              )}

              {/* Experimental Only: Saved Destination Matches (Matched FIRST, rendered ABOVE Nominatim) */}
              {experimentalActive && savedDestinations.length > 0 && (
                <View style={styles.savedSection}>
                  <Text style={styles.savedSectionHeader} maxFontSizeMultiplier={1.3}>
                    {query.trim().length > 0 ? 'SAVED MATCHES' : 'SAVED DESTINATIONS'}
                  </Text>
                  <View style={styles.savedList}>
                    {savedDestinations.map((saved) => (
                      <View key={saved.id} style={styles.savedItemRow}>
                        <TouchableOpacity
                          style={styles.savedItemClickable}
                          onPress={() => handleSelectSavedDestination(saved)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.savedBadge}>
                            <Text style={styles.savedBadgeText}>SAVED</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.savedItemName} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                              {saved.name}
                            </Text>
                            <Text style={styles.savedItemCoords} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                              {saved.lat.toFixed(4)}°N, {saved.lng.toFixed(4)}°E
                            </Text>
                          </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => handleDeleteSavedDestination(saved.id, saved.name)}
                          style={styles.deleteSavedBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityRole="button"
                          accessibilityLabel={`Delete saved place ${saved.name}`}
                        >
                          <Trash2 size={15} color={UI.textMuted} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Nominatim Search Results (Rendered below saved matches) */}
              {results.length > 0 && (
                <View style={styles.resultsList}>
                  {experimentalActive && savedDestinations.length > 0 && (
                    <Text style={styles.savedSectionHeader} maxFontSizeMultiplier={1.3}>
                      SEARCH RESULTS
                    </Text>
                  )}
                  {results.map((item) => (
                    <View key={String(item.place_id)} style={styles.resultRowContainer}>
                      <TouchableOpacity
                        style={styles.resultItem}
                        onPress={() => handlePickSearchResult(item)}
                        activeOpacity={0.7}
                      >
                        <MapPin size={16} color={Colors.primary} style={{ marginRight: 10, marginTop: 2 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.resultName} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                            {item.name}
                          </Text>
                          <Text style={styles.resultSub} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                            {[item.district, item.state].filter(Boolean).join(', ') || item.display_name}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {/* Experimental Only: Save Action on Search Result */}
                      {experimentalActive && (
                        <TouchableOpacity
                          onPress={() => handleSaveSearchResult(item)}
                          disabled={savedStatusMap[String(item.place_id)]}
                          style={[
                            styles.saveResultActionBtn,
                            savedStatusMap[String(item.place_id)] && styles.saveResultActionBtnDisabled,
                          ]}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel="Save destination"
                        >
                          {savedStatusMap[String(item.place_id)] ? (
                            <>
                              <Check size={13} color={Colors.primary} style={{ marginRight: 4 }} />
                              <Text style={styles.saveResultActionTextActive}>Saved</Text>
                            </>
                          ) : (
                            <>
                              <Bookmark size={13} color={UI.textSecondary} style={{ marginRight: 4 }} />
                              <Text style={styles.saveResultActionText}>Save</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Optional Manual Minutes Input */}
          <View style={styles.manualMinutesRow}>
            <View style={styles.manualInputBlock}>
              <Text style={styles.manualLabel} maxFontSizeMultiplier={1.3}>
                Expected time (optional minutes)
              </Text>
              <TextInput
                value={manualMinutes}
                onChangeText={(text) => {
                  const numOnly = text.replace(/[^0-9]/g, '');
                  onChangeManualMinutes(numOnly);
                }}
                keyboardType="number-pad"
                placeholder="e.g. 45"
                placeholderTextColor={UI.textMuted}
                maxLength={4}
                style={styles.manualInput}
                maxFontSizeMultiplier={1.3}
              />
            </View>
          </View>

          {/* Echo Back in Words */}
          {clampedMinutes !== null && (
            <View style={styles.wordsEchoBox}>
              <Text style={styles.wordsEchoText} maxFontSizeMultiplier={1.3}>
                {formatManualMinutesInWords(clampedMinutes)}
              </Text>
              {isImplausible && (
                <View style={styles.implausibleWarning}>
                  <AlertTriangle size={12} color={Colors.warning} style={{ marginRight: 4 }} />
                  <Text style={styles.implausibleWarningText} maxFontSizeMultiplier={1.3}>
                    Note: Over 6 hours entered. Pace will compare against this target.
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Save Current Location Modal */}
      <Modal
        visible={savedPlaceNameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSavedPlaceNameModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle} maxFontSizeMultiplier={1.3}>
              Save Current Location
            </Text>
            {currentFixCoords && (
              <Text style={styles.modalSub} maxFontSizeMultiplier={1.3}>
                {currentFixCoords.lat.toFixed(5)}°N, {currentFixCoords.lng.toFixed(5)}°E
              </Text>
            )}

            <TextInput
              value={currentFixPlaceName}
              onChangeText={setCurrentFixPlaceName}
              placeholder="Name (e.g. Migsun Vilaasa, Home)"
              placeholderTextColor={UI.textMuted}
              style={styles.modalInput}
              autoFocus
              maxFontSizeMultiplier={1.3}
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                onPress={() => setSavedPlaceNameModalVisible(false)}
                style={styles.modalCancelBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelBtnText} maxFontSizeMultiplier={1.3}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveCurrentFix}
                disabled={savingCurrentFix}
                style={styles.modalSaveBtn}
                activeOpacity={0.8}
              >
                {savingCurrentFix ? (
                  <ActivityIndicator size="small" color="#080A09" />
                ) : (
                  <Text style={styles.modalSaveBtnText} maxFontSizeMultiplier={1.3}>
                    Save Place
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const INPUT_BG = Colors.surfaceSubtle;
const SURFACE_BORDER = Colors.surfaceBorder;

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  pillsWrapper: {
    marginBottom: 8,
  },
  destinationPanel: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    gap: 12,
  },
  selectedDestinationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 211, 153, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  pinCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  destTextWrap: {
    flex: 1,
  },
  destName: {
    color: UI.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  destSub: {
    color: UI.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  clearBtn: {
    padding: 4,
  },
  searchSection: {
    gap: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: INPUT_BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SURFACE_BORDER,
    paddingHorizontal: 10,
    height: 44,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    color: UI.textPrimary,
    fontSize: 13.5,
    paddingVertical: 0,
  },
  inputClearBtn: {
    padding: 4,
  },
  searchSubmitBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentLocationRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 2,
  },
  currentLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 211, 153, 0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.2)',
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  currentLocationBtnText: {
    color: Colors.primary,
    fontSize: 12.5,
    fontWeight: '600',
  },
  errorNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  errorNoticeText: {
    color: Colors.warning,
    fontSize: 12,
    flex: 1,
  },
  savedSection: {
    gap: 6,
    marginTop: 4,
  },
  savedSectionHeader: {
    color: UI.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 4,
  },
  savedList: {
    backgroundColor: INPUT_BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.2)',
    overflow: 'hidden',
  },
  savedItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  savedItemClickable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  savedBadge: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    marginRight: 10,
  },
  savedBadgeText: {
    color: Colors.primary,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  savedItemName: {
    color: UI.textPrimary,
    fontSize: 13.5,
    fontWeight: '600',
  },
  savedItemCoords: {
    color: UI.textMuted,
    fontSize: 11.5,
    marginTop: 2,
  },
  deleteSavedBtn: {
    padding: 6,
    marginLeft: 8,
  },
  resultsList: {
    backgroundColor: INPUT_BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SURFACE_BORDER,
    overflow: 'hidden',
    marginTop: 2,
  },
  resultRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    paddingRight: 10,
  },
  resultItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  resultName: {
    color: UI.textPrimary,
    fontSize: 13.5,
    fontWeight: '600',
  },
  resultSub: {
    color: UI.textSecondary,
    fontSize: 11.5,
    marginTop: 2,
  },
  saveResultActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  saveResultActionBtnDisabled: {
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderColor: 'rgba(52, 211, 153, 0.25)',
  },
  saveResultActionText: {
    color: UI.textSecondary,
    fontSize: 11.5,
    fontWeight: '600',
  },
  saveResultActionTextActive: {
    color: Colors.primary,
    fontSize: 11.5,
    fontWeight: '700',
  },
  manualMinutesRow: {
    marginTop: 2,
  },
  manualInputBlock: {
    gap: 6,
  },
  manualLabel: {
    color: UI.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  manualInput: {
    backgroundColor: INPUT_BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SURFACE_BORDER,
    paddingHorizontal: 12,
    height: 40,
    color: UI.textPrimary,
    fontSize: 14,
  },
  wordsEchoBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 4,
  },
  wordsEchoText: {
    color: Colors.primary,
    fontSize: 12.5,
    fontWeight: '600',
  },
  implausibleWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  implausibleWarningText: {
    color: Colors.warning,
    fontSize: 11.5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#111614',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    color: UI.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  modalSub: {
    color: UI.textMuted,
    fontSize: 12,
  },
  modalInput: {
    backgroundColor: INPUT_BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SURFACE_BORDER,
    paddingHorizontal: 12,
    height: 44,
    color: UI.textPrimary,
    fontSize: 14,
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  modalCancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  modalCancelBtnText: {
    color: UI.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  modalSaveBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  modalSaveBtnText: {
    color: '#080A09',
    fontSize: 13,
    fontWeight: '700',
  },
});
