import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import { RideMap } from '../components/RideMap';
import { RideStats } from '../components/RideStats';
import { RoutePaceSummary } from '../components/RoutePaceSummary';
import { trackingService } from '../services/tracking';
import { deleteRide } from '../database/rideRepository';
import { getTrackPointsByRideId } from '../database/trackPointRepository';
import { exportRideToGPX } from '../services/gpxExport';
import { hapticFeedback } from '../services/haptics';
import { Ride } from '../types/ride';
import { ChevronLeft, Share2, Check, Trash2 } from 'lucide-react-native';

export default function RideSummaryScreen() {
  const router = useRouter();
  const trackingState = trackingService.getState();
  const [completedRide, setCompletedRide] = useState<Ride | null>(
    trackingState.currentRide
  );
  const [routeCoords, setRouteCoords] = useState<[number, number][]>(
    trackingState.routeCoordinates
  );

  useEffect(() => {
    async function loadCompletedPoints() {
      if (completedRide && routeCoords.length === 0) {
        const points = await getTrackPointsByRideId(completedRide.id);
        setRouteCoords(points.map((pt) => [pt.longitude, pt.latitude]));
      }
    }
    loadCompletedPoints();
  }, [completedRide]);

  const handleSaveAndDone = () => {
    hapticFeedback.success();
    trackingService.resetToIdle();
    router.replace('/(tabs)/history');
  };

  const handleShare = async () => {
    if (!completedRide) return;
    hapticFeedback.light();
    await exportRideToGPX(completedRide);
  };

  const handleDeleteRide = () => {
    hapticFeedback.warning();
    Alert.alert(
      'Discard Ride',
      'Are you sure you want to discard and delete this recorded motorcycle ride session?',
      [
        { text: 'Keep Ride', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            hapticFeedback.heavy();
            if (completedRide) {
              await deleteRide(completedRide.id);
            }
            trackingService.resetToIdle();
            router.replace('/(tabs)');
          },
        },
      ]
    );
  };

  if (!completedRide) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Text style={styles.noRideText}>No completed ride session found.</Text>
          <TouchableOpacity
            style={styles.backHomeBtn}
            onPress={() => router.replace('/(tabs)')}
            accessibilityRole="button"
          >
            <Text style={styles.backHomeText}>Return to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      {/* Top Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={handleSaveAndDone}
          style={styles.headerBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Back to history"
        >
          <ChevronLeft size={22} color="#F3F6F3" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleShare}
          style={styles.headerBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Share ride"
        >
          <Share2 size={18} color="#F3F6F3" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.eyebrow} maxFontSizeMultiplier={1.2}>
            RIDE COMPLETED
          </Text>
          <Text style={styles.title} maxFontSizeMultiplier={1.3}>
            RIDE SUMMARY
          </Text>
        </View>

        {/* Route Map Card */}
        <View style={styles.mapCard}>
          <RideMap
            coordinates={routeCoords}
            interactive={true}
            followUser={false}
            showStartEndMarkers={true}
            height={220}
          />
        </View>

        {/* Route Pace Summary (Destination Mode Only) */}
        {completedRide.ride_mode === 'destination' && (
          <RoutePaceSummary
            ride={completedRide}
            lastPoint={
              routeCoords.length > 0
                ? {
                    latitude: routeCoords[routeCoords.length - 1][1],
                    longitude: routeCoords[routeCoords.length - 1][0],
                  }
                : null
            }
          />
        )}

        {/* Metrics Card */}
        <View style={styles.statsContainer}>
          <RideStats
            distanceKm={completedRide.distance}
            durationSeconds={completedRide.duration}
            movingTimeSeconds={completedRide.moving_time}
            avgSpeedKmh={completedRide.average_speed}
            maxSpeedKmh={completedRide.max_speed}
            mode="summary"
          />
        </View>

        {/* Primary and Secondary Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSaveAndDone}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Save ride to journal"
          >
            <Check size={20} color="#060A08" strokeWidth={2.8} />
            <Text style={styles.saveBtnText} maxFontSizeMultiplier={1.2}>
              Save to Journal
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.discardBtn}
            onPress={handleDeleteRide}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Discard this ride"
          >
            <Trash2 size={16} color="#EF4444" />
            <Text style={styles.discardBtnText} maxFontSizeMultiplier={1.2}>
              Discard Ride
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#070909',
  },
  headerBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 36,
  },
  titleSection: {
    marginBottom: 16,
  },
  eyebrow: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  mapCard: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  statsContainer: {
    marginBottom: 16,
  },
  actionsContainer: {
    gap: 12,
    marginTop: 4,
  },
  saveBtn: {
    height: 54,
    backgroundColor: '#34D399',
    borderRadius: 27,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#34D399',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  saveBtnText: {
    color: '#060A08',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  discardBtn: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  discardBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  noRideText: {
    color: '#9CA3AF',
    fontSize: 15,
    marginBottom: 14,
  },
  backHomeBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  backHomeText: {
    color: '#34D399',
    fontWeight: '800',
    fontSize: 13,
  },
});
