import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
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
import { Ride } from '../types/ride';
import { Check, Trash2 } from 'lucide-react-native';

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
    trackingService.resetToIdle();
    router.replace('/(tabs)/history');
  };

  const handleDeleteRide = () => {
    Alert.alert(
      'Delete Ride',
      'Are you sure you want to discard and delete this recorded motorcycle ride?',
      [
        { text: 'Keep Ride', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
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
          >
            <Text style={styles.backHomeText}>Return to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerSubtitle}>SESSION FINISHED</Text>
          <Text style={styles.headerTitle}>RIDE SUMMARY</Text>
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

        {/* Detailed Stats */}
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

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSaveAndDone}
            activeOpacity={0.85}
          >
            <Check size={18} color="#0C0E12" strokeWidth={2.8} />
            <Text style={styles.saveBtnText}>SAVE TO JOURNAL</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handleDeleteRide}
            activeOpacity={0.8}
          >
            <Trash2 size={16} color={Colors.danger} />
            <Text style={styles.deleteBtnText}>DISCARD RIDE</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    paddingTop: 12,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 14,
  },
  headerSubtitle: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  mapCard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: 14,
  },
  statsContainer: {
    marginBottom: 18,
  },
  actionsContainer: {
    gap: 10,
  },
  saveBtn: {
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnText: {
    color: '#0C0E12',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  deleteBtn: {
    height: 44,
    backgroundColor: 'transparent',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deleteBtnText: {
    color: Colors.danger,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  noRideText: {
    color: Colors.textSecondary,
    fontSize: 15,
    marginBottom: 14,
  },
  backHomeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  backHomeText: {
    color: Colors.primary,
    fontWeight: '800',
    fontSize: 13,
  },
});
