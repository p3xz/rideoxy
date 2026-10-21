import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../../constants/theme';
import { OverallStatistics } from '../../types/statistics';
import {
  FuelPreferences,
  DEFAULT_FUEL_PREFERENCES,
} from '../../types/fuel';
import { getOverallStatistics } from '../../database/statisticsService';
import { getFuelLogsForVehicle } from '../../database/fuelRepository';
import { getFuelPreferences } from '../../database/fuelPreferencesRepository';
import {
  deriveFuelLogs,
  computeFuelSummary,
  convertMileageFromCanonical,
  convertKmToMiles,
} from '../../services/fuelCalculation';
import {
  GarageMotorcycle,
  loadGarageMotorcycles,
  saveGarageMotorcycles,
  resolveMotorcycleOdometerKm,
  persistBikePhotoFile,
  deleteBikePhotoFile,
  updateMotorcyclePhotoUri,
} from '../../components/garage/garageStorage';
import {
  GarageHeroBackdrop,
  GarageHeader,
  GarageHeroContent,
} from '../../components/garage/GarageHero';
import { GarageStatsPanel } from '../../components/garage/GarageStatsPanel';
import { GarageMotorcyclesSection } from '../../components/garage/GarageMotorcyclesSection';
import { AddMotorcyclePanel } from '../../components/garage/AddMotorcyclePanel';
import { MotorcycleModal } from '../../components/garage/MotorcycleModal';
import { promptBikePhotoPicker } from '../../components/BikeImage';
import { useTabBarHeight } from '../../components/FloatingTabBar';

const H_PAD = 20;

const EMPTY_STATS: OverallStatistics = {
  totalDistanceKm: 0,
  totalRidesCount: 0,
  totalDurationSeconds: 0,
  totalMovingTimeSeconds: 0,
  overallAverageSpeedKmh: 0,
  topSpeedKmh: 0,
  longestRideDistanceKm: 0,
  longestRideDurationSeconds: 0,
  averageRideDistanceKm: 0,
  thisMonthDistanceKm: 0,
};

export default function GarageScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();

  const [motorcycles, setMotorcycles] = useState<GarageMotorcycle[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [stats, setStats] = useState<OverallStatistics>(EMPTY_STATS);
  const [prefs, setPrefs] = useState<FuelPreferences>(DEFAULT_FUEL_PREFERENCES);
  const [avgFuelEconomy, setAvgFuelEconomy] = useState<number | null>(null);
  const [latestFuelOdoKm, setLatestFuelOdoKm] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingBike, setEditingBike] = useState<GarageMotorcycle | null>(null);

  const loadVehicleTelemetry = useCallback(
    async (vehicleId: string, loadedPrefs: FuelPreferences) => {
      try {
        let logs = await getFuelLogsForVehicle(vehicleId);
        if (logs.length === 0 && vehicleId !== 'default') {
          logs = await getFuelLogsForVehicle('default');
        }
        const derived = deriveFuelLogs(logs);
        const summary = computeFuelSummary(derived, loadedPrefs.currency);
        if (summary.averageMileage !== null && summary.averageMileage > 0) {
          const converted = convertMileageFromCanonical(
            summary.averageMileage,
            loadedPrefs.efficiencyUnit
          );
          setAvgFuelEconomy(Math.round(converted * 10) / 10);
        } else {
          setAvgFuelEconomy(null);
        }
        setLatestFuelOdoKm(derived.length > 0 ? derived[0].odometer : null);
      } catch (err) {
        console.error('[Rideoxy] Error loading garage fuel telemetry:', err);
        setAvgFuelEconomy(null);
        setLatestFuelOdoKm(null);
      }
    },
    []
  );

  const loadGarageData = useCallback(async () => {
    try {
      const [bikes, overallStats, fuelPrefs] = await Promise.all([
        loadGarageMotorcycles(),
        getOverallStatistics(),
        getFuelPreferences(),
      ]);

      setMotorcycles(bikes);
      setStats(overallStats);
      setPrefs(fuelPrefs);

      let nextIndex = 0;
      if (bikes.length > 0) {
        const defaultIdx = bikes.findIndex((b) => b.isDefault);
        nextIndex = defaultIdx >= 0 ? defaultIdx : 0;
      }
      setActiveIndex((prev) => (prev < bikes.length ? prev : nextIndex));

      const selectedBike = bikes[nextIndex] || null;
      await loadVehicleTelemetry(selectedBike?.id || 'default', fuelPrefs);
    } catch (err) {
      console.error('[Rideoxy] Error loading garage screen data:', err);
    } finally {
      setLoaded(true);
    }
  }, [loadVehicleTelemetry]);

  useFocusEffect(
    useCallback(() => {
      loadGarageData();
    }, [loadGarageData])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadGarageData();
    setRefreshing(false);
  };

  const handleSelectIndex = async (index: number) => {
    setActiveIndex(index);
    const bike = motorcycles[index];
    if (bike) {
      await loadVehicleTelemetry(bike.id, prefs);
    }
  };

  const handleOpenAddModal = () => {
    setEditingBike(null);
    setModalVisible(true);
  };

  const handleOpenDetailsModal = (bike: GarageMotorcycle | null) => {
    setEditingBike(bike);
    setModalVisible(true);
  };

  const handleDirectAddPhoto = (bike: GarageMotorcycle | null) => {
    if (!bike) {
      handleOpenAddModal();
      return;
    }
    promptBikePhotoPicker(async (pickedUri) => {
      const updated = await updateMotorcyclePhotoUri(bike.id, pickedUri);
      setMotorcycles(updated);
    });
  };

  const handleSaveMotorcycle = async (data: {
    id?: string;
    name: string;
    category?: string;
    engineCc?: number | null;
    odometerKm?: number | null;
    purchaseDate?: string | null;
    photoUri?: string | null;
    isDefault: boolean;
  }) => {
    let nextList = [...motorcycles];

    if (data.isDefault) {
      nextList = nextList.map((b) => ({ ...b, isDefault: false }));
    }

    if (data.id) {
      const existing = nextList.find((b) => b.id === data.id);
      const oldPhotoUri = existing?.photo_uri ?? existing?.imageUri ?? null;
      let persistedPhotoUri: string | null = null;

      if (data.photoUri) {
        persistedPhotoUri = await persistBikePhotoFile(
          data.id,
          data.photoUri,
          oldPhotoUri
        );
      } else if (oldPhotoUri) {
        await deleteBikePhotoFile(oldPhotoUri);
      }

      nextList = nextList.map((b) =>
        b.id === data.id
          ? {
              ...b,
              name: data.name,
              category: data.category,
              engineCc: data.engineCc,
              odometerKm: data.odometerKm,
              purchaseDate: data.purchaseDate,
              photo_uri: persistedPhotoUri,
              imageUri: persistedPhotoUri,
              isDefault: data.isDefault,
            }
          : b
      );
    } else {
      const newId = nextList.length === 0 ? 'default' : `bike_${Date.now()}`;
      let persistedPhotoUri: string | null = null;
      if (data.photoUri) {
        persistedPhotoUri = await persistBikePhotoFile(newId, data.photoUri, null);
      }

      const newBike: GarageMotorcycle = {
        id: newId,
        name: data.name,
        category: data.category,
        engineCc: data.engineCc,
        odometerKm: data.odometerKm,
        purchaseDate: data.purchaseDate,
        photo_uri: persistedPhotoUri,
        imageUri: persistedPhotoUri,
        isDefault: data.isDefault || nextList.length === 0,
        createdAt: Date.now(),
      };
      nextList.push(newBike);
    }

    const saved = await saveGarageMotorcycles(nextList);
    setMotorcycles(saved);

    const targetId = data.id || saved[saved.length - 1]?.id;
    const idx = saved.findIndex((b) => b.id === targetId);
    const resolvedIdx = idx >= 0 ? idx : 0;
    setActiveIndex(resolvedIdx);
    await loadVehicleTelemetry(saved[resolvedIdx]?.id || 'default', prefs);
  };

  const handleDeleteMotorcycle = async (id: string) => {
    const target = motorcycles.find((b) => b.id === id);
    const oldPhotoUri = target?.photo_uri ?? target?.imageUri ?? null;
    if (oldPhotoUri) {
      await deleteBikePhotoFile(oldPhotoUri);
    }

    const filtered = motorcycles.filter((b) => b.id !== id);
    const saved = await saveGarageMotorcycles(filtered);
    setMotorcycles(saved);
    const nextIdx = 0;
    setActiveIndex(nextIdx);
    await loadVehicleTelemetry(saved[nextIdx]?.id || 'default', prefs);
  };

  const safeIndex =
    motorcycles.length > 0
      ? Math.min(Math.max(0, activeIndex), motorcycles.length - 1)
      : 0;
  const currentBike = motorcycles.length > 0 ? motorcycles[safeIndex] : null;
  const currentPhotoUri = currentBike?.photo_uri ?? currentBike?.imageUri ?? null;

  const resolvedOdoKm = resolveMotorcycleOdometerKm(
    currentBike,
    latestFuelOdoKm,
    stats.totalDistanceKm
  );

  // Total distance in the 4-column panel reflects real odometer or recorded ride distance
  const totalDistanceBaseKm =
    resolvedOdoKm !== null && resolvedOdoKm > stats.totalDistanceKm
      ? resolvedOdoKm
      : stats.totalDistanceKm;

  const displayDistance =
    prefs.distanceUnit === 'mi'
      ? convertKmToMiles(totalDistanceBaseKm)
      : totalDistanceBaseKm;

  const displayOdometer =
    resolvedOdoKm !== null
      ? prefs.distanceUnit === 'mi'
        ? convertKmToMiles(resolvedOdoKm)
        : resolvedOdoKm
      : null;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: insets.top + 14,
          paddingBottom: tabBarHeight,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.textSecondary}
            progressBackgroundColor={Colors.surface}
            colors={[Colors.primary]}
          />
        }
      >
        <GarageHeroBackdrop photoUri={currentPhotoUri} />

        <View style={styles.pad}>
          <GarageHeader onAddMotorcycle={handleOpenAddModal} />

          <GarageHeroContent
            motorcycle={currentBike}
            onViewDetails={() =>
              currentBike
                ? handleOpenDetailsModal(currentBike)
                : handleOpenAddModal()
            }
            onAddBikePhoto={() => handleDirectAddPhoto(currentBike)}
          />

          <GarageStatsPanel
            totalDistanceKm={displayDistance}
            distanceUnit={prefs.distanceUnit}
            totalRides={stats.totalRidesCount}
            avgFuelEconomy={avgFuelEconomy}
            fuelEconomyUnit={prefs.efficiencyUnit}
            purchaseDate={currentBike?.purchaseDate}
            loaded={loaded}
          />

          <GarageMotorcyclesSection
            motorcycles={motorcycles}
            activeIndex={safeIndex}
            onSelectIndex={handleSelectIndex}
            onOpenMotorcycle={(bike) => handleOpenDetailsModal(bike)}
            onAddMotorcycle={handleOpenAddModal}
            resolvedOdometerKm={displayOdometer}
            distanceUnit={prefs.distanceUnit}
          />

          <AddMotorcyclePanel onPress={handleOpenAddModal} />
        </View>
      </ScrollView>

      <MotorcycleModal
        visible={modalVisible}
        editingBike={editingBike}
        onClose={() => setModalVisible(false)}
        onSave={handleSaveMotorcycle}
        onDelete={motorcycles.length > 0 ? handleDeleteMotorcycle : undefined}
        onOpenFuelLogs={() => router.push('/(tabs)/fuel')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  pad: {
    paddingHorizontal: H_PAD,
  },
});
