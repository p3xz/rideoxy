import React, { useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, ActivityIndicator, Platform } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Play, Navigation } from 'lucide-react-native';
import { hapticFeedback } from '../../services/haptics';

const WHITE = '#FFFFFF';
const HEIGHT = 56;

interface StartRideCTAProps {
  onPress: () => void;
  loading?: boolean;
  /** When a ride is already recording, the action returns to it instead. */
  activeLabel?: string | null;
}

export const StartRideCTA: React.FC<StartRideCTAProps> = ({ onPress, loading = false, activeLabel }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const isActive = !!activeLabel;

  const animateTo = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 4 }).start();

  const handlePress = () => {
    if (isActive) hapticFeedback.medium();
    else hapticFeedback.heavy();
    onPress();
  };

  return (
    <Animated.View style={[styles.shadow, { transform: [{ scale }] }]}>
      <Pressable
        onPress={handlePress}
        onPressIn={() => animateTo(0.975)}
        onPressOut={() => animateTo(1)}
        disabled={loading}
        accessibilityRole="button"
        accessibilityState={{ busy: loading, disabled: loading }}
        accessibilityLabel={isActive ? 'Return to active ride' : 'Start ride recording'}
        style={styles.button}
      >
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="ctaFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#42B57B" />
              <Stop offset="0.5" stopColor="#2F9864" />
              <Stop offset="1" stopColor="#21784D" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#ctaFill)" />
        </Svg>
        <View style={styles.highlight} />

        <View style={[styles.content, loading && { opacity: 0.78 }]}>
          {loading ? (
            <ActivityIndicator size="small" color={WHITE} />
          ) : isActive ? (
            <Navigation size={18} color={WHITE} strokeWidth={2.2} />
          ) : (
            <Play size={18} color={WHITE} fill={WHITE} />
          )}
          <Text style={styles.label} numberOfLines={1}>
            {loading ? 'Acquiring GPS…' : isActive ? activeLabel : 'Start Ride'}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  shadow: {
    borderRadius: HEIGHT / 2,
    ...Platform.select({
      ios: {
        shadowColor: '#2E9864',
        shadowOpacity: 0.32,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 5 },
      default: {},
    }),
  },
  button: {
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(130, 235, 180, 0.38)',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  label: {
    color: WHITE,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
});
