import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Search, MapPin, Check, AlertTriangle, X } from 'lucide-react-native';
import { SegmentedPills } from '../ui/SegmentedPills';
import { RideMode } from '../../types/ride';
import {
  GeocodeResult,
  searchDestination,
  clampManualMinutes,
  formatManualMinutesInWords,
  isManualMinutesImplausible,
  getOlaMapsApiKey,
  isOlaCircuitBreakerTripped,
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

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeAbortRef = useRef<AbortController | null>(null);

  const isOlaAvailable = Boolean(getOlaMapsApiKey()) && !isOlaCircuitBreakerTripped();

  // Autocomplete debouncing: only when Ola Maps is active (500ms, min 3 chars, cancels in-flight)
  useEffect(() => {
    if (!isOlaAvailable || mode !== 'destination' || selectedDestination) {
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setResults([]);
      setSearchError(null);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      // Cancel any previous in-flight request
      if (activeAbortRef.current) {
        activeAbortRef.current.abort();
      }
      activeAbortRef.current = new AbortController();

      setSearching(true);
      setSearchError(null);

      try {
        const response = await searchDestination(trimmed, 'destination');
        setSearching(false);

        if (response.success) {
          setResults(response.results);
          if (response.results.length === 0) {
            setSearchError('Destination not found. Check spelling, try a nearby town, or enter minutes manually.');
          }
        } else {
          setResults([]);
          if (response.error !== 'mode_guard') {
            setSearchError(response.message);
          }
        }
      } catch {
        setSearching(false);
      }
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, isOlaAvailable, mode, selectedDestination]);

  const handleSelectMode = async (nextMode: RideMode) => {
    if (nextMode === 'free') {
      // Switching back to Free Ride clears everything typed with zero network calls
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
          'Destination mode sends your search text (while typing, to Ola Maps when enabled), the chosen destination, and start/destination coordinates to Ola Maps, or to OpenStreetMap Nominatim and OSRM when fallback is used.\n\nFree Ride sends nothing over the network, and zero data is sent during or after your ride.',
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

  const handleSearchSubmit = async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchError('Please enter a place name to search.');
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (activeAbortRef.current) {
      activeAbortRef.current.abort();
    }

    setSearching(true);
    setSearchError(null);
    hapticFeedback.light();

    const response = await searchDestination(trimmed, 'destination');
    setSearching(false);

    if (response.success) {
      setResults(response.results);
      if (response.results.length === 0) {
        setSearchError('Destination not found. Check spelling, try a nearby town, or enter minutes manually.');
      }
    } else {
      setResults([]);
      setSearchError(response.message);
    }
  };

  const handlePickResult = (dest: GeocodeResult) => {
    hapticFeedback.selection();
    onSelectDestination(dest);
    setResults([]); // Collapse search list once picked
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
          {/* Destination Search Box or Selected Card */}
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
                  placeholder={
                    isOlaAvailable
                      ? 'Where to? (e.g. Nandi Hills)'
                      : 'Where to? Type and tap Search'
                  }
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
          )}

          {/* Search Error Notice */}
          {searchError && !selectedDestination && (
            <View style={styles.errorNotice}>
              <AlertTriangle size={14} color={Colors.warning} style={{ marginRight: 6 }} />
              <Text style={styles.errorNoticeText} maxFontSizeMultiplier={1.3}>
                {searchError}
              </Text>
            </View>
          )}

          {/* Search Results Dropdown */}
          {!selectedDestination && results.length > 0 && (
            <View style={styles.resultsList}>
              {results.map((item) => (
                <TouchableOpacity
                  key={String(item.place_id)}
                  style={styles.resultItem}
                  onPress={() => handlePickResult(item)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Select destination ${item.name}, ${item.district || ''} ${item.state || ''}`}
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
    fontWeight: '600',
  },
  destSub: {
    color: UI.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  clearBtn: {
    padding: 6,
  },
  errorNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(240, 200, 121, 0.08)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(240, 200, 121, 0.2)',
  },
  errorNoticeText: {
    color: '#F0C879',
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
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
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
  manualMinutesRow: {
    marginTop: 10,
  },
  manualInputBlock: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  manualLabel: {
    color: UI.textSecondary,
    fontSize: 12,
    marginBottom: 6,
  },
  manualInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    color: '#FFFFFF',
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  wordsEchoBox: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(52, 211, 153, 0.08)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.2)',
  },
  wordsEchoText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '500',
  },
  implausibleWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  implausibleWarningText: {
    color: '#F0C879',
    fontSize: 11,
    flex: 1,
  },
});
