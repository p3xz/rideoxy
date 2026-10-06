import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import { getDatabase } from '../database/database';
import { trackingService } from '../services/tracking';
import { RecoveryModal } from '../components/RecoveryModal';
import { Ride } from '../types/ride';
import '../tasks/locationTask';

export default function RootLayout() {
  const router = useRouter();
  const [interruptedRide, setInterruptedRide] = useState<Ride | null>(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function prepareApp() {
      try {
        await getDatabase();

        // Check for interrupted/uncompleted ride from previous session
        const recovered = await trackingService.checkForInterruptedRide();
        if (isMounted && recovered) {
          setInterruptedRide(recovered);
          setShowRecoveryModal(true);
        }
      } catch (err) {
        console.error('[rideoxy] App initialization error:', err);
      }
    }

    prepareApp();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleResumeRide = async () => {
    setShowRecoveryModal(false);
    await trackingService.resumeRide();
    router.push('/active-ride');
  };

  const handleEndAndSaveRide = async () => {
    setShowRecoveryModal(false);
    const finalized = await trackingService.endInterruptedRideAndSave();
    if (finalized) {
      router.push('/ride-summary');
    }
  };

  const handleDiscardRide = async () => {
    setShowRecoveryModal(false);
    await trackingService.discardRide();
    setInterruptedRide(null);
  };

  return (
    <SafeAreaProvider style={styles.container}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="active-ride"
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="ride-summary"
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="ride/[id]"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="privacy"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="licenses"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="fuel-entry"
          options={{
            headerShown: false,
          }}
        />
      </Stack>

      <RecoveryModal
        visible={showRecoveryModal}
        ride={interruptedRide}
        onResume={handleResumeRide}
        onEndAndSave={handleEndAndSaveRide}
        onDiscard={handleDiscardRide}
      />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
