import React, { useState } from 'react';
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
          'Destination mode sends your destination name to OpenStreetMap Nominatim and route coordinates to OSRM to estimate travel time.\n\nFree Ride mode sends nothing over the network, and zero data is sent during or after your ride.',
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
  };

  const parsedMinutes = parseInt(manualMinutes, 10);
  const hasValidMinutes = Number.isFinite(parsedMinutes) && parsedMinutes > 0;
  const clampedMinutes = hasValidMinutes ? clampManualMinutes(parsedMinutes) : null;
  const isImplausible = clampedMinutes ? isManualMinutesImplausible(clampedMinutes) : false;

  return (
    <View style={styles.container}>
      {/* 2-Option Segmented Control */}
      <View style={styles.pillsWrap}>
        <SegmentedPills
          options={MODE_OPTIONS}
          value={mode}
          onChange={handleSelectMode}
        />
      </View>

      {/* Destination Form (Revealed only in Destination mode) */}
      {mode === 'destination' && (
        <View style={styles.destinationPanel}>
          {/* Selected Destination Card OR Search Input */}
          {selectedDestination ? (
            <View style={styles.selectedDestCard}>
              <View style={styles.selectedDestIcon}>
                <MapPin size={18} color={Colors.primary} />
              </View>
              <View style={styles.selectedDestInfo}>
                <Text style={styles.selectedDestName} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                  {selectedDestination.name}
                </Text>
                <Text style={styles.selectedDestSub} numberOfLines={1} maxFontSizeMultiplier={1.3}>
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
                  placeholder="Where to? (e.g. Nandi Hills)"
                  placeholderTextColor={UI.textMuted}
                  style={styles.textInput}
                  autoCorrect={false}
                  maxFontSizeMultiplier={1.3}
                />
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
            </View>
          )}

          {/* Gentle Warning for Implausible Values (> 6 hours) */}
          {isImplausible && (
            <View style={styles.warningBox}>
              <AlertTriangle size={13} color={Colors.warning} style={{ marginRight: 6 }} />
              <Text style={styles.warningText} maxFontSizeMultiplier={1.3}>
                Note: Expected duration exceeds 6 hours. Double check for typos before starting.
              </Text>
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
    marginBottom: 14,
  },
  pillsWrap: {
    marginBottom: 10,
  },
  destinationPanel: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    padding: 14,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputContainer: {
    flex: 1,
    height: 46,
    backgroundColor: '#0F1512',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    height: '100%',
  },
  searchSubmitBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(240, 200, 121, 0.10)',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  errorNoticeText: {
    color: '#F0C879',
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  resultsList: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: '#0F1512',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    overflow: 'hidden',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  resultName: {
    color: Colors.text,
    fontSize: 13.5,
    fontWeight: '600',
    marginBottom: 2,
  },
  resultSub: {
    color: UI.textMuted,
    fontSize: 11.5,
  },
  selectedDestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 230, 164, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(99, 230, 164, 0.32)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  selectedDestIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(99, 230, 164, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  selectedDestInfo: {
    flex: 1,
  },
  selectedDestName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  selectedDestSub: {
    color: Colors.primary,
    fontSize: 11.5,
  },
  clearBtn: {
    padding: 6,
  },
  manualMinutesRow: {
    marginTop: 12,
  },
  manualInputBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F1512',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  manualLabel: {
    color: UI.textSecondary,
    fontSize: 12.5,
    flex: 1,
  },
  manualInput: {
    width: 72,
    height: 34,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 8,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 0,
  },
  wordsEchoBox: {
    marginTop: 8,
    paddingHorizontal: 6,
  },
  wordsEchoText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(240, 200, 121, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
  },
  warningText: {
    color: '#F0C879',
    fontSize: 11.5,
    flex: 1,
  },
});
