import React from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { UI } from '../../constants/ui';
import { RideoxyWordmark } from '../home/RideoxyWordmark';
import { usePressScale } from '../../lib/motion';

interface HeaderIconButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  label: string;
  accent?: boolean;
}

/** Circular outline icon button used in screen headers with smooth press scale and light haptics. */
export const HeaderIconButton: React.FC<HeaderIconButtonProps> = ({ icon, onPress, label, accent }) => {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale({ scaleTo: 0.92, haptic: true });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
    >
      <Animated.View
        style={[
          styles.iconBtn,
          accent && styles.iconBtnAccent,
          animatedStyle,
        ]}
      >
        {icon}
      </Animated.View>
    </Pressable>
  );
};

interface ScreenHeaderProps {
  title: string;
  subtitle: string;
  /** Optional icon buttons rendered at the top right. */
  right?: React.ReactNode;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, subtitle, right }) => (
  <View style={styles.wrap}>
    <View style={styles.topRow}>
      <View accessibilityLabel="Rideoxy — More Rides. Better Days.">
        <RideoxyWordmark width={150} height={15} />
        <Text style={styles.tagline}>More Rides. Better Days.</Text>
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
    <Text style={styles.title} accessibilityRole="header">
      {title}
    </Text>
    <Text style={styles.subtitle}>{subtitle}</Text>
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 18,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tagline: {
    color: UI.textSecondary,
    fontSize: 10.5,
    marginTop: 5,
    letterSpacing: 0.2,
  },
  title: {
    color: UI.textPrimary,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.6,
    marginTop: 22,
  },
  subtitle: {
    color: UI.textSecondary,
    fontSize: 13.5,
    marginTop: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnAccent: {
    borderColor: UI.accentBorder,
    backgroundColor: 'rgba(14, 36, 26, 0.72)',
  },
});
