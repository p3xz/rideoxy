import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Animated,
  Easing,
  AccessibilityInfo,
  Platform,
  StyleProp,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Standard durations for consistent, snappy motion throughout Rideoxy.
 * Kept between 150ms and 600ms per guidelines.
 */
export const MOTION_DURATIONS = {
  instant: 0,
  tap: 140,
  fast: 180,
  normal: 240,
  stagger: 45,
  chart: 520,
  counter: 420,
} as const;

export const MOTION_EASINGS = {
  outCubic: Easing.out(Easing.cubic),
  inOutCubic: Easing.inOut(Easing.cubic),
};

/** Safe light haptic trigger with error boundary for platforms/emulators without vibration. */
export async function triggerLightHaptic(): Promise<void> {
  try {
    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {
    // Safely swallow if device does not support haptics
  }
}

/** Safe medium haptic trigger (e.g. Start Ride, toggle pause). */
export async function triggerMediumHaptic(): Promise<void> {
  try {
    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  } catch {
    // Safely swallow
  }
}

/** Safe success notification haptic (e.g. save ride, save fuel log). */
export async function triggerSuccessHaptic(): Promise<void> {
  try {
    if (Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  } catch {
    // Safely swallow
  }
}

/** Safe warning notification haptic (e.g. destructive actions, discard confirms). */
export async function triggerWarningHaptic(): Promise<void> {
  try {
    if (Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  } catch {
    // Safely swallow
  }
}


/** Hook to listen for system-wide reduced motion settings. */
export function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        if (mounted) setReduceMotion(enabled);
      }
    );

    return () => {
      mounted = false;
      sub?.remove();
    };
  }, []);

  return reduceMotion;
}

/**
 * Press-in scale animation hook (scales to target e.g. 0.97, springs back to 1.0).
 * Animates strictly using native driver (transform: [{ scale }]).
 */
export function usePressScale(options?: {
  scaleTo?: number;
  haptic?: boolean;
}) {
  const scaleTo = options?.scaleTo ?? 0.97;
  const enableHaptic = options?.haptic ?? false;
  const reduceMotion = useReducedMotion();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const activeAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    return () => {
      if (activeAnimRef.current) {
        activeAnimRef.current.stop();
      }
    };
  }, []);

  const onPressIn = useCallback(() => {
    if (enableHaptic) {
      triggerLightHaptic();
    }
    if (reduceMotion) return;

    if (activeAnimRef.current) activeAnimRef.current.stop();
    const anim = Animated.timing(scaleAnim, {
      toValue: scaleTo,
      duration: MOTION_DURATIONS.tap,
      easing: MOTION_EASINGS.outCubic,
      useNativeDriver: true,
    });
    activeAnimRef.current = anim;
    anim.start();
  }, [enableHaptic, reduceMotion, scaleAnim, scaleTo]);

  const onPressOut = useCallback(() => {
    if (reduceMotion) {
      scaleAnim.setValue(1);
      return;
    }

    if (activeAnimRef.current) activeAnimRef.current.stop();
    const anim = Animated.spring(scaleAnim, {
      toValue: 1,
      speed: 18,
      bounciness: 4,
      useNativeDriver: true,
    });
    activeAnimRef.current = anim;
    anim.start();
  }, [reduceMotion, scaleAnim]);

  const animatedStyle = {
    transform: [{ scale: scaleAnim }],
  };

  return {
    scaleAnim,
    onPressIn,
    onPressOut,
    animatedStyle,
  };
}

/**
 * Screen entrance animation for headers, cards, and sections.
 * Staggers items by (index * 45ms), fades in and slides up by 12px.
 * Applies only to the first 8 items (index 0..7). Rest render at final state immediately.
 * Guaranteed safe: if reduced motion is enabled or animation fails, renders at final state.
 */
export function useFadeInUp(index = 0, staggerMs = MOTION_DURATIONS.stagger) {
  const reduceMotion = useReducedMotion();
  const shouldAnimate = index < 8 && !reduceMotion;

  const anim = useRef(new Animated.Value(shouldAnimate ? 0 : 1)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!shouldAnimate) {
      anim.setValue(1);
      return;
    }

    const delay = Math.min(index * staggerMs, 350);
    const timing = Animated.sequence([
      Animated.delay(delay),
      Animated.timing(anim, {
        toValue: 1,
        duration: MOTION_DURATIONS.normal,
        easing: MOTION_EASINGS.outCubic,
        useNativeDriver: true,
      }),
    ]);

    animRef.current = timing;
    timing.start();

    return () => {
      timing.stop();
    };
  }, [shouldAnimate, anim, index, staggerMs]);

  const opacity = anim;
  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });

  return {
    animatedStyle: {
      opacity,
      transform: [{ translateY }],
    },
  };
}

/**
 * Convenient wrapper component for staggered entrance animations.
 * Applies only up to index 7 (first 8 items). Rest render at final state immediately.
 */
export const FadeInUpView: React.FC<{
  index: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}> = ({ index, style, children }) => {
  const { animatedStyle } = useFadeInUp(index);
  return React.createElement(Animated.View, { style: [animatedStyle, style] }, children);
};

/**
 * Parses numeric value from a string (e.g. "1,248" -> 1248, "42.5" -> 42.5).
 * Returns null if string is non-numeric (e.g. "–" or "None").
 */
export function parseDisplayNumber(str: string): { num: number; decimals: number } | null {
  if (!str) return null;
  const cleaned = str.replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  if (!Number.isFinite(num)) return null;

  const dotIdx = cleaned.indexOf('.');
  const decimals = dotIdx >= 0 ? cleaned.length - dotIdx - 1 : 0;
  return { num, decimals };
}

/**
 * Hook to smoothly count a numeric value up/down on change.
 * If non-numeric or reduced motion is enabled, returns target string directly.
 */
export function useAnimatedNumber(
  targetDisplay: string,
  options?: { duration?: number }
): string {
  const reduceMotion = useReducedMotion();
  const duration = options?.duration ?? MOTION_DURATIONS.counter;
  const parsed = parseDisplayNumber(targetDisplay);

  const [currentDisplay, setCurrentDisplay] = useState(targetDisplay);
  const currentNumRef = useRef<number>(parsed ? parsed.num : 0);
  const targetNumRef = useRef<number | null>(parsed ? parsed.num : null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const nextParsed = parseDisplayNumber(targetDisplay);

    if (!nextParsed || reduceMotion) {
      setCurrentDisplay(targetDisplay);
      currentNumRef.current = nextParsed ? nextParsed.num : 0;
      targetNumRef.current = nextParsed ? nextParsed.num : null;
      return;
    }

    const startNum = currentNumRef.current;
    const endNum = nextParsed.num;
    targetNumRef.current = endNum;

    if (Math.abs(startNum - endNum) < 0.0001) {
      setCurrentDisplay(targetDisplay);
      return;
    }

    const startTime = Date.now();
    const decimals = nextParsed.decimals;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Easing.out(Easing.cubic) in JS: 1 - Math.pow(1 - progress, 3)
      const eased = 1 - Math.pow(1 - progress, 3);
      const val = startNum + (endNum - startNum) * eased;

      currentNumRef.current = val;

      // Format back with same decimals and commas if originally formatted
      let formatted: string;
      if (decimals > 0) {
        formatted = val.toFixed(decimals);
      } else {
        formatted = Math.round(val).toLocaleString('en-US');
      }

      setCurrentDisplay(formatted);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        currentNumRef.current = endNum;
        setCurrentDisplay(targetDisplay);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [targetDisplay, duration, reduceMotion]);

  return currentDisplay;
}
