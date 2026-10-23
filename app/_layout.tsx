import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Platform, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { Colors } from '../constants/theme';
import { trackingService } from '../services/tracking';
import { RecoveryModal } from '../components/RecoveryModal';
import { AnimatedSplash } from '../components/AnimatedSplash';
import { GpsPermissionModal, GpsModalMode } from '../components/GpsPermissionModal';
import { registerGpsExplainerHandler, GpsExplainerRequest } from '../services/location';
import { getSetting } from '../database/settingsRepository';
import { useAppReady } from '../hooks/useAppReady';
import '../tasks/locationTask';

// Prevent native splash screen from auto-hiding before animated splash mounts
SplashScreen.preventAutoHideAsync().catch(() => {});

// Ensure any keep-awake calls are failure-silent if the native module is absent (e.g., in Expo Go)
try {
  const KeepAwake = require('expo-keep-awake');
  if (KeepAwake) {
    if (typeof KeepAwake.activateKeepAwakeAsync === 'function') {
      const origActivate = KeepAwake.activateKeepAwakeAsync;
      KeepAwake.activateKeepAwakeAsync = async (...args: any[]) => {
        try {
          return await origActivate(...args);
        } catch {
          // Failure-silent
        }
      };
    }
    if (typeof KeepAwake.deactivateKeepAwake === 'function') {
      const origDeactivate = KeepAwake.deactivateKeepAwake;
      KeepAwake.deactivateKeepAwake = async (...args: any[]) => {
        try {
          return await origDeactivate(...args);
        } catch {
          // Failure-silent
        }
      };
    }
  }
} catch {}

export default function RootLayout() {
  const router = useRouter();
  const { isSplashFinished, progress, interruptedRide, onSplashFinished } = useAppReady();
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const hasRestoredRoute = useRef(false);

  const [gpsModalState, setGpsModalState] = useState<{
    visible: boolean;
    mode: GpsModalMode;
    resolver: ((proceed: boolean) => void) | null;
  }>({
    visible: false,
    mode: 'explainer',
    resolver: null,
  });

  // Register GPS permission explainer handler before system prompt
  useEffect(() => {
    registerGpsExplainerHandler((req: GpsExplainerRequest) => {
      setGpsModalState({
        visible: true,
        mode: req.mode,
        resolver: req.resolve,
      });
    });

    return () => {
      registerGpsExplainerHandler(null);
    };
  }, []);

  const handleGpsContinue = () => {
    const res = gpsModalState.resolver;
    setGpsModalState({ visible: false, mode: 'explainer', resolver: null });
    res?.(true);
  };

  const handleGpsCancel = () => {
    const res = gpsModalState.resolver;
    setGpsModalState({ visible: false, mode: 'explainer', resolver: null });
    res?.(false);
  };

  // If a ride is being recovered, finish the splash first, then show recovery modal
  useEffect(() => {
    if (isSplashFinished && interruptedRide) {
      setShowRecoveryModal(true);
    }
  }, [isSplashFinished, interruptedRide]);

  // Restore state: persist the last tab locally and reopen after splash when OS killed the app
  // Never restore into active ride screen unless a ride is actually being recovered
  useEffect(() => {
    if (isSplashFinished && !interruptedRide && !hasRestoredRoute.current) {
      hasRestoredRoute.current = true;
      getSetting('last_active_tab')
        .then((lastTab) => {
          if (
            lastTab &&
            lastTab !== 'index' &&
            ['garage', 'fuel', 'history', 'stats', 'settings'].includes(lastTab)
          ) {
            router.replace(`/(tabs)/${lastTab}` as never);
          }
        })
        .catch(() => {});
    }
  }, [isSplashFinished, interruptedRide, router]);

  const handleResumeRide = async () => {
    const res = await trackingService.resumeRide();
    if (!res.success) {
      Alert.alert(
        'GPS Location Required',
        res.error ?? 'Location permission is required to resume tracking.'
      );
      setShowRecoveryModal(true);
      return;
    }
    setShowRecoveryModal(false);
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
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="ride/[id]"
          options={{
            headerShown: false,
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="privacy"
          options={{
            headerShown: false,
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="licenses"
          options={{
            headerShown: false,
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="fuel-entry"
          options={{
            headerShown: false,
            gestureEnabled: true,
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

      <GpsPermissionModal
        visible={gpsModalState.visible}
        mode={gpsModalState.mode}
        onContinue={handleGpsContinue}
        onCancel={handleGpsCancel}
      />

      {!isSplashFinished ? (
        <AnimatedSplash progress={progress} onFinish={onSplashFinished} />
      ) : null}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
