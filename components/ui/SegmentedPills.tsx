import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, LayoutChangeEvent } from 'react-native';
import { UI } from '../../constants/ui';
import { triggerLightHaptic, useReducedMotion, MOTION_DURATIONS, MOTION_EASINGS } from '../../lib/motion';

export interface PillOption<T extends string> {
  key: T;
  label: string;
}

interface SegmentedPillsProps<T extends string> {
  options: PillOption<T>[];
  value: T;
  onChange: (key: T) => void;
  /** Let pills wrap onto several lines with intrinsic width (for long option lists). */
  wrap?: boolean;
}

const GAP = 8;
const PILL_HEIGHT = 36;

/**
 * Segmented pills with a smoothly sliding emerald highlight that glides via translateX.
 * Selected = filled emerald, others outlined. Haptic feedback on press.
 */
export function SegmentedPills<T extends string>({ options, value, onChange, wrap }: SegmentedPillsProps<T>) {
  const reduceMotion = useReducedMotion();
  const [containerWidth, setContainerWidth] = useState(0);

  const selectedIndex = Math.max(
    0,
    options.findIndex((opt) => opt.key === value)
  );

  const numOptions = options.length;
  const pillWidth =
    !wrap && containerWidth > 0 && numOptions > 0
      ? (containerWidth - (numOptions - 1) * GAP) / numOptions
      : 0;

  const targetX = selectedIndex * (pillWidth + GAP);

  const translateX = useRef(new Animated.Value(targetX)).current;
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (wrap || pillWidth <= 0) return;

    if (isFirstRender.current || reduceMotion) {
      isFirstRender.current = false;
      translateX.setValue(targetX);
      return;
    }

    const anim = Animated.spring(translateX, {
      toValue: targetX,
      speed: 20,
      bounciness: 3,
      useNativeDriver: true,
    });
    anim.start();

    return () => {
      anim.stop();
    };
  }, [targetX, pillWidth, wrap, reduceMotion, translateX]);

  const onContainerLayout = (e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    if (w !== containerWidth && w > 0) {
      setContainerWidth(w);
    }
  };

  const handlePress = (key: T) => {
    triggerLightHaptic();
    onChange(key);
  };

  return (
    <View
      onLayout={wrap ? undefined : onContainerLayout}
      style={[styles.row, wrap && styles.rowWrap]}
    >
      {/* Sliding emerald highlight pill for flexed rows */}
      {!wrap && pillWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.slider,
            {
              width: pillWidth,
              transform: [{ translateX }],
            },
          ]}
        />
      ) : null}

      {options.map((opt) => {
        const selected = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => handlePress(opt.key)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={opt.label}
            accessibilityHint={selected ? "Selected option" : "Double tap to select"}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            style={({ pressed }) => [
              styles.pill,
              wrap ? styles.pillWrap : styles.pillFlex,
              wrap && selected && styles.pillSelected,
              // If sliding indicator hasn't measured yet, give active styling as fallback
              !wrap && pillWidth === 0 && selected && styles.pillSelected,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text
              style={[
                styles.text,
                selected && styles.textSelected,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              maxFontSizeMultiplier={1.3}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'relative',
    flexDirection: 'row',
    gap: GAP,
  },
  rowWrap: {
    flexWrap: 'wrap',
  },
  slider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    height: PILL_HEIGHT,
    borderRadius: 18,
    backgroundColor: UI.accent,
    zIndex: 0,
  },
  pill: {
    height: PILL_HEIGHT,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    zIndex: 1,
  },
  pillFlex: {
    flex: 1,
  },
  pillWrap: {
    paddingHorizontal: 14,
  },
  pillSelected: {
    backgroundColor: UI.accent,
    borderColor: UI.accent,
  },
  text: {
    color: UI.textSecondary,
    fontSize: 12.5,
    fontWeight: '600',
  },
  textSelected: {
    color: '#06140D',
    fontWeight: '700',
  },
});
