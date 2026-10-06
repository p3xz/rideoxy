import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';
import { RideMap } from '../../components/RideMap';
import { RideStats } from '../../components/RideStats';
import { getRideById, deleteRide } from '../../database/rideRepository';
import { getTrackPointsByRideId } from '../../database/trackPointRepository';
import { exportRideToGPX } from '../../services/gpxExport';
import { Ride } from '../../types/ride';
import { ChevronLeft, Share2, Trash2, Calendar, Clock } from 'lucide-react-native';

export default function RideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [ride, setRide] = useState<Ride | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function loadRideData() {
      if (!id) return;
      try {
        const [rideData, points] = await Promise.all([
          getRideById(id),
          getTrackPointsByRideId(id),
        ]);
        setRide(rideData);
        setRouteCoords(points.map((pt) => [pt.longitude, pt.latitude]));
      } catch (err) {
        console.error('[rideoxy] Error loading ride details:', err);
      } finally {
        setLoading(false);
      }
    }

    loadRideData();
  }, [id]);

  const handleExportGPX = async () => {
    if (!ride) return;
    setExporting(true);
    const result = await exportRideToGPX(ride);
    setExporting(false);

    if (!result.success && result.error) {
      Alert.alert('Export Failed', result.error);
    }
  };

  const handleDeleteRide = () => {
    Alert.alert(
      'Delete Ride',
      'Are you sure you want to permanently delete this ride and its GPS telemetry from your device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (id) {
              await deleteRide(id);
              router.back();
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!ride) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Ride not found.</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtnText}>
            <Text style={{ color: Colors.primary, fontWeight: '700' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const startDateFormatted = new Date(ride.start_time).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const startTimeFormatted = new Date(ride.start_time).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const endTimeFormatted = ride.end_time
    ? new Date(ride.end_time).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.navBtn}
          activeOpacity={0.7}
        >
          <ChevronLeft size={22} color={Colors.text} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>RIDE DETAILS</Text>

        <TouchableOpacity
          onPress={handleDeleteRide}
          style={styles.navBtn}
          activeOpacity={0.7}
        >
          <Trash2 size={16} color={Colors.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Route Map */}
        <View style={styles.mapCard}>
          <RideMap
            coordinates={routeCoords}
            interactive={true}
            followUser={false}
            showStartEndMarkers={true}
            height={240}
          />
        </View>

        {/* Date / Time Card */}
        <View style={styles.metaCard}>
          <View style={styles.metaItem}>
            <Calendar size={14} color={Colors.primary} />
            <Text style={styles.metaText}>{startDateFormatted.toUpperCase()}</Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <Clock size={14} color={Colors.primary} />
            <Text style={styles.metaText}>
              {startTimeFormatted} {endTimeFormatted ? `· ${endTimeFormatted}` : ''}
            </Text>
          </View>
        </View>

        {/* Detailed Stats */}
        <View style={styles.statsContainer}>
          <RideStats
            distanceKm={ride.distance}
            durationSeconds={ride.duration}
            movingTimeSeconds={ride.moving_time}
            avgSpeedKmh={ride.average_speed}
            maxSpeedKmh={ride.max_speed}
            mode="summary"
          />
        </View>

        {/* Export GPX Action Button */}
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={handleExportGPX}
          disabled={exporting}
          activeOpacity={0.85}
        >
          <Share2 size={18} color="#0C0E12" strokeWidth={2.4} />
          <Text style={styles.exportBtnText}>
            {exporting ? 'EXPORTING GPX...' : 'EXPORT GPX FILE'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
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
  navBtn: {
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
    fontSize: 14,
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
  mapCard: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: 12,
  },
  metaCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metaDivider: {
    width: 1,
    height: 18,
    backgroundColor: Colors.surfaceBorder,
  },
  statsContainer: {
    marginBottom: 16,
  },
  exportBtn: {
    height: 50,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  exportBtnText: {
    color: '#0C0E12',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: 15,
    marginBottom: 10,
  },
  backBtnText: {
    padding: 8,
  },
});
