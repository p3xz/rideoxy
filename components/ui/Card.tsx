import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, Pressable, Animated } from 'react-native';
import { UI } from '../../constants/ui';
import { usePressScale } from '../../lib/motion';

interface CardProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Apply default 16px inner padding. */
  padded?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'none';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  padded = true,
  onPress,
  accessibilityLabel,
  accessibilityRole = onPress ? 'button' : 'none',
}) => {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale({ scaleTo: 0.985 });

  if (!onPress) {
    return <View style={[styles.card, padded && styles.padded, style]}>{children}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[styles.card, padded && styles.padded, animatedStyle, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: UI.cardBg,
    borderWidth: 1,
    borderColor: UI.cardBorder,
    borderRadius: UI.cardRadius,
    overflow: 'hidden',
  },
  padded: {
    padding: 16,
  },
});
