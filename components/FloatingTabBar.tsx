import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {
  Home,
  Wrench,
  Fuel,
  Compass,
  BarChart2,
  Settings,
  LucideIcon,
} from 'lucide-react-native';
import { Colors } from '../constants/theme';
import { hapticFeedback } from '../services/haptics';
import { setSetting } from '../database/settingsRepository';

export const FLOATING_TAB_BAR_HEIGHT = 62;

/**
 * Returns the total bottom padding required for scrollable screen content
 * so nothing is obscured behind the floating oval tab bar:
 * (bar height + safe-area bottom inset + 16px).
 */
export function useTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  const bottomOffset = insets.bottom + 8;
  return FLOATING_TAB_BAR_HEIGHT + bottomOffset + 16;
}

export interface TabConfigItem {
  name: string;
  label: string;
  icon: LucideIcon;
}

export const TAB_CONFIG: readonly TabConfigItem[] = [
  { name: 'index', label: 'Home', icon: Home },
  { name: 'garage', label: 'Garage', icon: Wrench },
  { name: 'fuel', label: 'Fuel', icon: Fuel },
  { name: 'history', label: 'Rides', icon: Compass },
  { name: 'stats', label: 'Stats', icon: BarChart2 },
  { name: 'settings', label: 'Settings', icon: Settings },
] as const;

const ACTIVE_COLOR = Colors.primary; // Emerald accent (#63E6A4)
const INACTIVE_COLOR = '#8E9892'; // Lightened for > 4.5:1 WCAG contrast against near-black

/** Central rule for any full-screen routes where the floating bar should hide. */
const HIDDEN_ROUTE_NAMES = new Set([
  'active-ride',
  'ride-summary',
  'ride/[id]',
  'fuel-entry',
  'privacy',
  'licenses',
]);

interface TabButtonProps {
  item: TabConfigItem;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({
  item,
  isFocused,
  onPress,
  onLongPress,
}) => {
  const scale = useSharedValue(1);
  const IconComponent = item.icon;
  const tintColor = isFocused ? ACTIVE_COLOR : INACTIVE_COLOR;

  React.useEffect(() => {
    if (isFocused) {
      scale.value = withSpring(1.08, { damping: 14, stiffness: 240 }, (finished) => {
        if (finished) {
          scale.value = withSpring(1, { damping: 16, stiffness: 260 });
        }
      });
    } else {
      scale.value = withSpring(1, { damping: 16, stiffness: 260 });
    }
  }, [isFocused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(isFocused ? 1.08 : 1, { damping: 15, stiffness: 300 }, (finished) => {
      if (finished && isFocused) {
        scale.value = withSpring(1, { damping: 16, stiffness: 260 });
      }
    });
  };

  const handlePress = () => {
    hapticFeedback.selection();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={item.label}
      style={styles.tabButton}
    >
      {isFocused && <View style={styles.activeTopIndicator} />}
      <Animated.View style={[styles.tabInner, animatedStyle]}>
        <View style={[styles.iconPill, isFocused && styles.iconPillActive]}>
          <IconComponent
            size={19}
            color={tintColor}
            fill={isFocused ? ACTIVE_COLOR : 'none'}
            strokeWidth={isFocused ? 2.2 : 1.8}
          />
        </View>
        <Text
          style={[
            styles.tabLabel,
            { color: tintColor },
            isFocused && styles.tabLabelActive,
          ]}
          numberOfLines={1}
          ellipsizeMode="clip"
          maxFontSizeMultiplier={1.3}
        >
          {item.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
};

export const FloatingTabBar: React.FC<BottomTabBarProps> = ({
  state,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const currentRoute = state.routes[state.index];

  React.useEffect(() => {
    const route = state.routes[state.index];
    if (route && !HIDDEN_ROUTE_NAMES.has(route.name)) {
      setSetting('last_active_tab', route.name).catch(() => {});
    }
  }, [state.index, state.routes]);

  if (currentRoute && HIDDEN_ROUTE_NAMES.has(currentRoute.name)) {
    return null;
  }

  const bottomOffset = Math.max(insets.bottom, 8) + 8;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.outerWrapper, { bottom: bottomOffset }]}
    >
      <View style={styles.pillContainer}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 40 : 24}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.topHighlight} />

        {TAB_CONFIG.map((item) => {
          const routeIndex = state.routes.findIndex((r) => r.name === item.name);
          const route = routeIndex >= 0 ? state.routes[routeIndex] : null;
          const isFocused = state.index === routeIndex;

          const handlePress = () => {
            if (!route) return;
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const handleLongPress = () => {
            if (!route) return;
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <TabButton
              key={item.name}
              item={item}
              isFocused={isFocused}
              onPress={handlePress}
              onLongPress={handleLongPress}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 50,
  },
  pillContainer: {
    height: FLOATING_TAB_BAR_HEIGHT,
    borderRadius: 999,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(14, 20, 18, 0.76)' : 'rgba(14, 20, 18, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOpacity: 0.48,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
      android: {
        elevation: 12,
      },
      default: {},
    }),
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 28,
    right: 28,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  tabButton: {
    flex: 1,
    height: '100%',
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeTopIndicator: {
    position: 'absolute',
    top: 0,
    width: 20,
    height: 2,
    borderRadius: 1,
    backgroundColor: ACTIVE_COLOR,
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: {
    backgroundColor: 'rgba(99, 230, 164, 0.12)',
  },
  tabLabel: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  tabLabelActive: {
    fontWeight: '700',
  },
});
