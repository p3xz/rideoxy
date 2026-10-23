import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  BackHandler,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import { UI } from '../constants/ui';
import { RideMap } from '../components/RideMap';
import { SpeedDisplay } from '../components/SpeedDisplay';
import { RideStats } from '../components/RideStats';
import { GlassSurface } from '../components/GlassSurface';
import { trackingService } from '../services/tracking';
import { LiveTrackingState } from '../types/tracking';
import { hapticFeedback } from '../services/haptics';
import {
  ChevronDown,
  Pause,
  Play,
  Square,
  Radio,
  Navigation as NavigationIcon,
} from 'lucide-react-native';

export default function ActiveRideScreen() {
  const router = useRouter();
  const [trackingState, setTrackingState] = useState<LiveTrackingState>(
    trackingService.getState()
  );
  const [recenterCounter, setRecenterCounter] = useState(0);

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
      const res = await trackingService.resumeRide();
      if (!res.success && res.error) {
        Alert.alert('GPS Location Required', res.error);
      }
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

  const handleRecenter = () => {
    hapticFeedback.light();
    setRecenterCounter((c) => c + 1);
  };

  const isPaused = trackingState.status === 'paused';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Top Floating Cockpit Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBackPress}
          style={styles.collapseBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Minimize live ride view"
        >
          <ChevronDown size={20} color="#F3F6F3" strokeWidth={2.4} />
        </TouchableOpacity>

        <View style={styles.statusPill}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isPaused ? '#F59E0B' : '#34D399' },
            ]}
          />
          <Text style={styles.statusText} maxFontSizeMultiplier={1.2}>
            {isPaused ? 'RIDE PAUSED' : 'RECORDING'}
          </Text>
        </View>

        <View style={styles.gpsPill}>
          <Radio
            size={12}
            color={
              trackingState.gpsSignalState === 'good'
                ? '#34D399'
                : trackingState.gpsSignalState === 'poor'
                ? '#F59E0B'
                : '#9CA3AF'
            }
          />
          <Text style={styles.gpsText} maxFontSizeMultiplier={1.2}>
            {trackingState.gpsSignalState === 'good'
              ? 'GPS 3D'
              : trackingState.gpsSignalState === 'poor'
              ? 'POOR GPS'
              : 'SEARCHING'}
          </Text>
        </View>
      </View>

      {/* Map View Section */}
      <View style={styles.mapContainer}>
        <RideMap
          coordinates={trackingState.routeCoordinates}
          currentLocation={trackingState.currentLocation}
          interactive={true}
          followUser={true}
          showStartEndMarkers={true}
          recenterTrigger={recenterCounter}
        />

        {/* Floating Map Recenter Button */}
        <TouchableOpacity
          style={styles.recenterBtn}
          onPress={handleRecenter}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Recenter map on current motorcycle position"
        >
          <NavigationIcon size={18} color="#34D399" />
        </TouchableOpacity>
      </View>

      {/* Bottom Telemetry HUD Surface */}
      <View style={styles.telemetryPanel}>
        {/* Speed Instrument Readout */}
        <View style={styles.speedSection}>
          <SpeedDisplay speed={trackingState.currentSpeedKmh} size="large" />
        </View>

        {/* Telemetry Stats Grid (2x2) */}
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
          {/* Pause / Resume Button */}
          <View style={styles.controlItem}>
            <TouchableOpacity
              style={[
                styles.actionCircleBtn,
                styles.pauseCircleBtn,
                isPaused && styles.resumeCircleBtnActive,
              ]}
              onPress={handleTogglePause}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={isPaused ? 'Resume ride' : 'Pause ride'}
            >
              {isPaused ? (
                <Play size={22} color="#060A08" fill="#060A08" style={{ marginLeft: 2 }} />
              ) : (
                <Pause size={22} color="#F3F6F3" />
              )}
            </TouchableOpacity>
            <Text style={styles.controlBtnLabel} maxFontSizeMultiplier={1.2}>
              {isPaused ? 'RESUME' : 'PAUSE'}
            </Text>
          </View>

          {/* End Ride Button */}
          <View style={styles.controlItem}>
            <TouchableOpacity
              style={[styles.actionCircleBtn, styles.endCircleBtn]}
              onPress={handleEndRide}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Finish and save motorcycle ride"
            >
              <Square size={20} color="#FFFFFF" fill="#FFFFFF" />
            </TouchableOpacity>
            <Text style={[styles.controlBtnLabel, styles.endBtnLabel]} maxFontSizeMultiplier={1.2}>
              END RIDE
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#070909',
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#070909',
    zIndex: 10,
  },
  collapseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    color: '#F3F6F3',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  gpsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
  },
  gpsText: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#080A09',
    position: 'relative',
  },
  recenterBtn: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(10, 14, 12, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  telemetryPanel: {
    backgroundColor: '#0A0D0C',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.16)',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 22,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  speedSection: {
    alignItems: 'center',
    marginBottom: 4,
  },
  statsSection: {
    width: '100%',
    marginBottom: 16,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
    paddingTop: 2,
  },
  controlItem: {
    alignItems: 'center',
    gap: 6,
  },
  actionCircleBtn: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseCircleBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  resumeCircleBtnActive: {
    backgroundColor: '#34D399',
    borderColor: '#34D399',
  },
  endCircleBtn: {
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#F87171',
    ...Platform.select({
      ios: {
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  controlBtnLabel: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  endBtnLabel: {
    color: '#F87171',
  },
});
