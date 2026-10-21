import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Search, MapPin, Check, AlertTriangle, X, Navigation } from 'lucide-react-native';
import { SegmentedPills } from '../ui/SegmentedPills';
import { RideMap } from '../RideMap';
import { RideMode } from '../../types/ride';
import {
  GeocodeResult,
  searchDestination,
  clampManualMinutes,
  formatManualMinutesInWords,
  isManualMinutesImplausible,
} from '../../services/etaService';
import { getSetting, setSetting } from '../../database/settingsRepository';
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

type InputMethod = 'search' | 'pin';

export const DestinationStartFlow: React.FC<DestinationStartFlowProps> = ({
  mode,
  onModeChange,
  selectedDestination,
  onSelectDestination,
  manualMinutes,
  onChangeManualMinutes,
}) => {
  const [inputMethod, setInputMethod] = useState<InputMethod>('search');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Map pin drop state
  const [pinnedCoords, setPinnedCoords] = useState<[number, number] | null>(null); // [lng, lat]
  const [pinnedName, setPinnedName] = useState('');

  const handleSelectMode = async (nextMode: RideMode) => {
    if (nextMode === 'free') {
      // Switching back to Free Ride clears everything with zero network calls
      setQuery('');
      setResults([]);
      setSearchError(null);
      setPinnedCoords(null);
      setPinnedName('');
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

    onModeChange('destination');
  };

  /**
   * Free Path 1: OpenStreetMap Nominatim search on explicit submit only.
   * Never fires per-keystroke.
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
        setSearchError('Place not found in OpenStreetMap. Switch to "Drop Pin on Map" to drop a pin directly.');
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

  /**
   * Free Path 2: Map pin drop via MapLibre long-press.
   * Works for any destination including unmapped new societies (e.g. Migsun Vilaasa).
   */
  const handleMapLongPress = (coordinate: [number, number]) => {
    // coordinate is [longitude, latitude]
    hapticFeedback.medium();
    setPinnedCoords(coordinate);
    if (!pinnedName.trim()) {
      setPinnedName('Destination');
    }
  };

  const handleConfirmPin = () => {
    if (!pinnedCoords) {
      Alert.alert('Pin Required', 'Long-press on the map to place your destination pin first.');
      return;
    }

    const name = pinnedName.trim() || 'Custom Destination';
    const [lng, lat] = pinnedCoords;

    hapticFeedback.selection();
    onSelectDestination({
      place_id: `pin_${lat.toFixed(5)}_${lng.toFixed(5)}`,
      name,
      display_name: `${name} (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`,
      lat,
      lng,
      source: 'pin',
    });
  };

  const handleClearDestination = () => {
    hapticFeedback.light();
    onSelectDestination(null);
    setQuery('');
    setResults([]);
    setSearchError(null);
    setPinnedCoords(null);
    setPinnedName('');
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
            <>
              {/* Method Toggle: Search Place vs Drop Pin on Map */}
              <View style={styles.methodToggleRow}>
                <TouchableOpacity
                  style={[styles.methodTab, inputMethod === 'search' && styles.methodTabActive]}
                  onPress={() => {
                    hapticFeedback.light();
                    setInputMethod('search');
                  }}
                  activeOpacity={0.8}
                >
                  <Search size={14} color={inputMethod === 'search' ? Colors.primary : UI.textMuted} />
                  <Text
                    style={[styles.methodTabText, inputMethod === 'search' && styles.methodTabTextActive]}
                    maxFontSizeMultiplier={1.3}
                  >
                    Search Name
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.methodTab, inputMethod === 'pin' && styles.methodTabActive]}
                  onPress={() => {
                    hapticFeedback.light();
                    setInputMethod('pin');
                  }}
                  activeOpacity={0.8}
                >
                  <MapPin size={14} color={inputMethod === 'pin' ? Colors.primary : UI.textMuted} />
                  <Text
                    style={[styles.methodTabText, inputMethod === 'pin' && styles.methodTabTextActive]}
                    maxFontSizeMultiplier={1.3}
                  >
                    Drop Pin on Map
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Free Path 1: Nominatim Submit-Search */}
              {inputMethod === 'search' && (
                <View style={styles.searchSection}>
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

                  {/* Search Error Notice */}
                  {searchError && (
                    <View style={styles.errorNotice}>
                      <AlertTriangle size={14} color={Colors.warning} style={{ marginRight: 6 }} />
                      <Text style={styles.errorNoticeText} maxFontSizeMultiplier={1.3}>
                        {searchError}
                      </Text>
                    </View>
                  )}

                  {/* Search Results Dropdown */}
                  {results.length > 0 && (
                    <View style={styles.resultsList}>
                      {results.map((item) => (
                        <TouchableOpacity
                          key={String(item.place_id)}
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
                          <Check size={16} color="rgba(255, 255, 255, 0.2)" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Free Path 2: Map Pin Drop (MapLibre with Long-Press) */}
              {inputMethod === 'pin' && (
                <View style={styles.pinSection}>
                  <View style={styles.mapContainer}>
                    <RideMap
                      height={200}
                      interactive={true}
                      showStartEndMarkers={false}
                      onLongPress={handleMapLongPress}
                      pinnedCoordinate={pinnedCoords}
                    />
                    <View style={styles.mapHintBadge}>
                      <Text style={styles.mapHintText} maxFontSizeMultiplier={1.3}>
                        {pinnedCoords
                          ? 'Pin placed. Long-press elsewhere to move.'
                          : '👆 Long-press anywhere on the map to drop a pin'}
                      </Text>
                    </View>
                  </View>

                  {/* Pin Details & Confirmation */}
                  {pinnedCoords && (
                    <View style={styles.pinConfirmationBox}>
                      <Text style={styles.pinCoordLabel} maxFontSizeMultiplier={1.3}>
                        Coordinates: {pinnedCoords[1].toFixed(5)}°N, {pinnedCoords[0].toFixed(5)}°E
                      </Text>

                      <View style={styles.pinNameInputWrapper}>
                        <TextInput
                          value={pinnedName}
                          onChangeText={setPinnedName}
                          placeholder="Destination Name (e.g. Migsun Vilaasa)"
                          placeholderTextColor={UI.textMuted}
                          style={styles.pinNameInput}
                          maxFontSizeMultiplier={1.3}
                        />
                      </View>

                      <TouchableOpacity
                        onPress={handleConfirmPin}
                        style={styles.confirmPinBtn}
                        activeOpacity={0.8}
                      >
                        <Navigation size={16} color="#080A09" style={{ marginRight: 6 }} />
                        <Text style={styles.confirmPinBtnText} maxFontSizeMultiplier={1.3}>
                          Set as Destination
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 10,
    marginBottom: 8,
  },
  pillsWrapper: {
    marginBottom: 10,
  },
  destinationPanel: {
    backgroundColor: 'rgba(18, 24, 22, 0.75)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
  },
  methodToggleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    padding: 3,
    marginBottom: 12,
    gap: 4,
  },
  methodTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 6,
    gap: 6,
  },
  methodTabActive: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  methodTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: UI.textMuted,
  },
  methodTabTextActive: {
    color: Colors.primary,
  },
  searchSection: {
    width: '100%',
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
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    height: 42,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    paddingVertical: 0,
  },
  inputClearBtn: {
    padding: 4,
  },
  searchSubmitBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedDestinationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pinCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  destTextWrap: {
    flex: 1,
  },
  destName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  destSub: {
    color: UI.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  clearBtn: {
    padding: 6,
  },
  errorNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
  },
  errorNoticeText: {
    color: Colors.warning,
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  resultsList: {
    marginTop: 8,
    backgroundColor: 'rgba(10, 14, 12, 0.95)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  resultName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  resultSub: {
    color: UI.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  pinSection: {
    width: '100%',
  },
  mapContainer: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
  },
  mapHintBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(8, 10, 10, 0.85)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  mapHintText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  pinConfirmationBox: {
    marginTop: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  pinCoordLabel: {
    color: UI.textMuted,
    fontSize: 11,
    marginBottom: 6,
  },
  pinNameInputWrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    height: 38,
    justifyContent: 'center',
    marginBottom: 8,
  },
  pinNameInput: {
    color: '#FFFFFF',
    fontSize: 13,
    paddingVertical: 0,
  },
  confirmPinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
  },
  confirmPinBtnText: {
    color: '#080A09',
    fontSize: 13,
    fontWeight: '700',
  },
  manualMinutesRow: {
    marginTop: 12,
  },
  manualInputBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  manualLabel: {
    color: UI.textSecondary,
    fontSize: 12,
    flex: 1,
  },
  manualInput: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
    minWidth: 60,
    paddingVertical: 4,
  },
  wordsEchoBox: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(52, 211, 153, 0.08)',
    borderRadius: 8,
  },
  wordsEchoText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  implausibleWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  implausibleWarningText: {
    color: Colors.warning,
    fontSize: 11,
    flex: 1,
  },
});
