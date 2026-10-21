import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Animated,
  Easing,
  useWindowDimensions,
  AccessibilityInfo,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

interface AnimatedSplashProps {
  /** Progress value from 0 to 1.0 representing real startup milestones. */
  progress: number;
  /** Invoked when exit animation completes, signaling root layout to unmount splash. */
  onFinish: () => void;
}

const MIN_DISPLAY_MS = 700;

export const AnimatedSplash: React.FC<AnimatedSplashProps> = ({ progress, onFinish }) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [reduceMotion, setReduceMotion] = useState(false);
  const [nativeSplashDismissed, setNativeSplashDismissed] = useState(false);

  // Animation values
  const wordmarkAnim = useRef(new Animated.Value(0)).current;
  const taglineAnim = useRef(new Animated.Value(0)).current;
  const trackAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  const mountTimeRef = useRef(Date.now());
  const exitTriggeredRef = useRef(false);
  const isMountedRef = useRef(true);

  // Content width with 28px left & right margins
  const contentWidth = Math.max(0, width - 56);
  // Base font size 44px, scaled down on narrow screens (< 370px) so it never wraps or clips
  const fontSize = Math.min(44, Math.floor(contentWidth / 7.2));
  const letterSpacing = Math.round(fontSize * 0.24);

  // Dismiss native splash once React Native screen has laid out
  const handleLayout = () => {
    if (!nativeSplashDismissed) {
      setNativeSplashDismissed(true);
      SplashScreen.hideAsync().catch(() => {});
    }
  };

  // Check reduced motion & run entrance animations
  useEffect(() => {
    isMountedRef.current = true;
    SplashScreen.hideAsync().catch(() => {});

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (!isMountedRef.current) return;
        setReduceMotion(enabled);

        if (enabled) {
          wordmarkAnim.setValue(1);
          taglineAnim.setValue(1);
          trackAnim.setValue(1);
        } else {
          // Staggered entrance animations
          Animated.parallel([
            Animated.timing(wordmarkAnim, {
              toValue: 1,
              duration: 450,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.delay(120),
              Animated.timing(taglineAnim, {
                toValue: 1,
                duration: 450,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.delay(200),
              Animated.timing(trackAnim, {
                toValue: 1,
                duration: 300,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
            ]),
          ]).start();
        }
      })
      .catch(() => {
        // Fallback: render at final state immediately
        wordmarkAnim.setValue(1);
        taglineAnim.setValue(1);
        trackAnim.setValue(1);
      });

    return () => {
      isMountedRef.current = false;
      wordmarkAnim.stopAnimation();
      taglineAnim.stopAnimation();
      trackAnim.stopAnimation();
      scaleAnim.stopAnimation();
      containerOpacity.stopAnimation();
    };
  }, [containerOpacity, scaleAnim, taglineAnim, trackAnim, wordmarkAnim]);

  // Smoothly animate progress bar to each new milestone
  useEffect(() => {
    const target = Math.max(0, Math.min(1, progress));

    if (target < 1.0) {
      Animated.timing(scaleAnim, {
        toValue: target,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    // When progress hits 100%, guarantee minimum display time of 700ms from mount
    const elapsed = Date.now() - mountTimeRef.current;
    const remainingWait = Math.max(0, MIN_DISPLAY_MS - elapsed);

    const timer = setTimeout(() => {
      if (!isMountedRef.current) return;

      Animated.timing(scaleAnim, {
        toValue: 1.0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !exitTriggeredRef.current) {
          exitTriggeredRef.current = true;
          // Hold 150ms at 100%, then fade out whole screen over 250ms
          setTimeout(() => {
            if (!isMountedRef.current) return;
            Animated.timing(containerOpacity, {
              toValue: 0,
              duration: 250,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }).start(() => {
              if (isMountedRef.current) {
                onFinish();
              }
            });
          }, 150);
        }
      });
    }, remainingWait);

    return () => clearTimeout(timer);
  }, [progress, scaleAnim, containerOpacity, onFinish]);

  return (
    <Animated.View
      onLayout={handleLayout}
      style={[
        styles.container,
        {
          opacity: containerOpacity,
        },
      ]}
      pointerEvents="auto"
    >
      {/* Hide status bar on splash screen only */}
      <StatusBar hidden />

      {/* Wordmark and Tagline placed with top at ~46% screen height */}
      <View style={[styles.centerBlock, { top: height * 0.46 }]}>
        <Animated.View
          style={{
            opacity: wordmarkAnim,
            transform: [
              {
                translateY: wordmarkAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [reduceMotion ? 0 : 12, 0],
                }),
              },
            ],
          }}
        >
          <Text
            style={[
              styles.wordmark,
              {
                fontSize,
                letterSpacing,
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            RIDEO<Text style={styles.emeraldX}>X</Text>Y
          </Text>
        </Animated.View>

        <Animated.View
          style={{
            opacity: taglineAnim,
            transform: [
              {
                translateY: taglineAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [reduceMotion ? 0 : 12, 0],
                }),
              },
            ],
          }}
        >
          <Text style={styles.tagline}>More Rides. Better Days.</Text>
        </Animated.View>
      </View>

      {/* Progress line 48px above bottom safe-area inset */}
      <Animated.View
        style={[
          styles.track,
          {
            bottom: insets.bottom + 48,
            opacity: trackAnim,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.fill,
            {
              width: contentWidth,
              transform: [
                {
                  translateX: scaleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-contentWidth / 2, 0],
                  }),
                },
                { scaleX: scaleAnim },
              ],
            },
          ]}
        />
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#070B0A',
    zIndex: 99999,
    elevation: 99999,
  },
  centerBlock: {
    position: 'absolute',
    left: 28,
    right: 28,
  },
  wordmark: {
    color: '#FFFFFF',
    fontWeight: '300',
    includeFontPadding: false,
  },
  emeraldX: {
    color: '#34D399',
    fontWeight: '400',
  },
  tagline: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '400',
    color: '#9CA3AF',
    letterSpacing: 14 * 0.04,
  },
  track: {
    position: 'absolute',
    left: 28,
    right: 28,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    height: 2,
    backgroundColor: '#34D399',
    borderRadius: 1,
  },
});
