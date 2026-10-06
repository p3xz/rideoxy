import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';
import { Ride } from '../../types/ride';
import { getAllCompletedRides } from '../../database/rideRepository';
import { RideCard } from '../../components/RideCard';
import { EmptyRideIllustration } from '../../components/svg/EmptyRideIllustration';
import { Wordmark } from '../../components/svg/Wordmark';

export default function HistoryScreen() {
  const router = useRouter();
  const [rides, setRides] = useState<Ride[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadRides = useCallback(async () => {
    try {
      const data = await getAllCompletedRides();
      setRides(data);
    } catch (err) {
      console.error('[rideoxy] Error loading rides history:', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRides();
    }, [loadRides])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRides();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Wordmark size="md" showTagline={false} />
        <View style={styles.titleRow}>
          <Text style={styles.headerTitle}>RIDES JOURNAL</Text>
          {rides.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{rides.length} SESSIONS</Text>
            </View>
          )}
        </View>
      </View>

      <FlatList
        data={rides}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RideCard
            ride={item}
            onPress={() => router.push(`/ride/${item.id}`)}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <EmptyRideIllustration width={220} height={140} />
            <Text style={styles.emptyTitle}>No Recorded Rides</Text>
            <Text style={styles.emptySubtitle}>
              Your completed motorcycle trips will appear in this journal.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  badge: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  badgeText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 18,
    marginBottom: 4,
  },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
