import { useState, useEffect, useRef, useCallback } from 'react';
import { getDatabase } from '../database/database';
import { getFuelPreferences } from '../database/fuelPreferencesRepository';
import { trackingService } from '../services/tracking';
import { Ride } from '../types/ride';

/** Module-level flag so splash only runs on cold start, not when returning from background. */
let hasColdStarted = false;

export interface AppReadyState {
  /** False while the splash gate is active on cold start; true once finished. */
  isSplashFinished: boolean;
  /** Real progress from 0 to 1.0. */
  progress: number;
  /** Recovered ride from previous session/crash (null if none). */
  interruptedRide: Ride | null;
  /** Callback to notify hook that the splash exit animation has completed. */
  onSplashFinished: () => void;
}

const MAX_FALLBACK_TIMEOUT_MS = 4000;

export function useAppReady(): AppReadyState {
  // If already cold started in this runtime, skip splash entirely.
  const [isSplashFinished, setIsSplashFinished] = useState(() => hasColdStarted);
  const [progress, setProgress] = useState(() => (hasColdStarted ? 1 : 0.08));
  const [interruptedRide, setInterruptedRide] = useState<Ride | null>(null);

  const isMountedRef = useRef(true);
  const finishedRef = useRef(hasColdStarted);

  const onSplashFinished = useCallback(() => {
    hasColdStarted = true;
    finishedRef.current = true;
    setIsSplashFinished(true);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    if (hasColdStarted) {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    // Safety timeout: user must never get stuck past 4 seconds.
    timeoutId = setTimeout(() => {
      if (isMountedRef.current && !finishedRef.current) {
        console.warn('[Rideoxy] Startup timeout fallback triggered (4s limit). Continuing.');
        setProgress(1.0);
        onSplashFinished();
      }
    }, MAX_FALLBACK_TIMEOUT_MS);

    async function initializeApp() {
      let recovered: Ride | null = null;

      try {
        // Step 1: SQLite initialization and schema migrations
        await getDatabase();
        if (isMountedRef.current) setProgress(0.38);

        // Step 2: Settings and units hydration
        await getFuelPreferences();
        if (isMountedRef.current) setProgress(0.68);

        // Step 3: Crash-recovery check
        recovered = await trackingService.checkForInterruptedRide();
        if (isMountedRef.current && recovered) {
          setInterruptedRide(recovered);
        }

        if (isMountedRef.current) {
          setProgress(1.0);
        }
      } catch (err) {
        console.error('[Rideoxy] Startup error occurred during boot:', err);
        // On error, still proceed to unblock user
        if (isMountedRef.current) {
          setProgress(1.0);
        }
      }
    }

    initializeApp();

    return () => {
      isMountedRef.current = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [onSplashFinished]);

  return {
    isSplashFinished,
    progress,
    interruptedRide,
    onSplashFinished,
  };
}
