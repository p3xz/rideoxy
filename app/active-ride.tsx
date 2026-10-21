import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  BackHandler,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import { RideMap } from '../components/RideMap';
import { SpeedDisplay } from '../components/SpeedDisplay';
import { RideStats } from '../components/RideStats';
import { GlassSurface } from '../components/GlassSurface';
import { trackingService } from '../services/tracking';
import { LiveTrackingState } from '../types/tracking';
import { hapticFeedback } from '../services/haptics';
import {
  ChevronLeft,
  Pause,
  Play,
  Square,
  Radio,
} from 'lucide-react-native';

export default function ActiveRideScreen() {
  const router = useRouter();
  const [trackingState, setTrackingState] = useState<LiveTrackingState>(
    trackingService.getState()
  );

  useEffect(() => {
    const unsubscribe = trackingService.subscribe((state) => {
      setTrackingState(state);
    });

    const backAction = () => {
      handleBackPress();
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => {
      unsubscribe();
      backHandler.remove();
    };
  }, []);

  const handleBackPress = () => {
    hapticFeedback.light();
    if (trackingState.status === 'running' || trackingState.status === 'paused') {
      Alert.alert(
        'Ride in Progress',
        'Your motorcycle ride is actively recording in the background. Do you want to return to the home screen while recording continues?',
        [
          { text: 'Stay in HUD', style: 'cancel' },
          {
            text: 'Leave & Keep Recording',
            onPress: () => router.push('/(tabs)'),
          },
        ]
      );
    } else {
      router.push('/(tabs)');
    }
  };

  const handleTogglePause = async () => {
    hapticFeedback.medium();
    if (trackingState.status === 'running') {
      await trackingService.pauseRide();
    } else if (trackingState.status === 'paused') {
      await trackingService.resumeRide();
    }
  };

  const handleEndRide = () => {
    hapticFeedback.warning();
    Alert.alert(
      'End Ride Session',
      'Are you sure you want to finish this motorcycle ride and save telemetry to your journal?',
      [
        { text: 'Continue Riding', style: 'cancel' },
        {
          text: 'End & Save',
          style: 'destructive',
          onPress: async () => {
            hapticFeedback.heavy();
            const finishedRide = await trackingService.endRide();
            if (finishedRide) {
              router.replace('/ride-summary');
            } else {
              router.replace('/(tabs)');
            }
          },
        },
      ]
    );
  };

  const isPaused = trackingState.status === 'paused';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      {/* Top Cockpit Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBackPress}
          style={styles.backBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={22} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.statusBadgeContainer}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isPaused ? Colors.warning : Colors.primary },
            ]}
          />
          <Text style={styles.statusText}>
            {isPaused ? 'RIDE PAUSED' : 'RECORDING'}
          </Text>
        </View>

        <View style={styles.gpsBadge}>
          <Radio
            size={13}
            color={
              trackingState.gpsSignalState === 'good'
                ? Colors.primary
                : trackingState.gpsSignalState === 'poor'
                ? Colors.warning
                : Colors.textMuted
            }
          />
          <Text style={styles.gpsText}>
            {trackingState.gpsSignalState === 'good'
              ? 'GPS 3D'
              : trackingState.gpsSignalState === 'poor'
              ? 'POOR GPS'
              : 'SEARCHING'}
          </Text>
        </View>
      </View>

      {/* Map View */}
      <View style={styles.mapContainer}>
        <RideMap
          coordinates={trackingState.routeCoordinates}
          currentLocation={trackingState.currentLocation}
          interactive={true}
          followUser={true}
          showStartEndMarkers={true}
        />
      </View>

      {/* Live Telemetry Panel */}
      <GlassSurface
        variant="modal"
        intensity={45}
        borderRadius={20}
        style={styles.telemetryPanel}
      >
        <View style={styles.telemetryInner}>
          {/* Speed Instrument Readout */}
          <View style={styles.speedSection}>
            <SpeedDisplay speed={trackingState.currentSpeedKmh} size="large" />
          </View>

          {/* Telemetry Stats Grid */}
          <View style={styles.statsSection}>
            <RideStats
              distanceKm={trackingState.currentDistanceKm}
              durationSeconds={trackingState.currentDurationSeconds}
              avgSpeedKmh={trackingState.currentAvgSpeedKmh}
              maxSpeedKmh={trackingState.currentMaxSpeedKmh}
              mode="active"
            />
          </View>

          {/* Tactile Control Buttons */}
          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={[
                styles.controlBtn,
                styles.pauseBtn,
                isPaused && styles.resumeBtnActive,
              ]}
              onPress={handleTogglePause}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={isPaused ? "Resume motorcycle ride" : "Pause motorcycle ride"}
            >
              {isPaused ? (
                <>
                  <Play size={18} color="#070909" fill="#070909" />
                  <Text style={styles.resumeText}>RESUME</Text>
                </>
              ) : (
                <>
                  <Pause size={18} color={Colors.text} />
                  <Text style={styles.pauseText}>PAUSE</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlBtn, styles.endBtn]}
              onPress={handleEndRide}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Finish and save motorcycle ride"
            >
              <Square size={16} color="#FFFFFF" fill="#FFFFFF" />
              <Text style={styles.endText}>END RIDE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </GlassSurface>
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
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
    zIndex: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  statusBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    color: Colors.text,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  gpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  gpsText: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  telemetryPanel: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  telemetryInner: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 12,
  },
  speedSection: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  statsSection: {
    width: '100%',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  controlBtn: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pauseBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorderHighlight,
  },
  pauseText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  resumeBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  resumeText: {
    color: '#0C0E12',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  endBtn: {
    backgroundColor: Colors.danger,
  },
  endText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
