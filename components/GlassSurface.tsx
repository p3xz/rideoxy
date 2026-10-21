import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors } from '../constants/theme';

interface GlassSurfaceProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  variant?: 'primary' | 'secondary' | 'modal' | 'prominent';
  borderRadius?: number;
}

export const GlassSurface: React.FC<GlassSurfaceProps> = ({
  children,
  style,
  intensity = 30,
  variant = 'primary',
  borderRadius = 14,
}) => {
  const getBackgroundColor = () => {
    switch (variant) {
      case 'secondary':
        return Colors.surfaceGlassSecondary;
      case 'modal':
        return Colors.surfaceGlassModal;
      case 'prominent':
        return Colors.surfaceGlassTint;
      case 'primary':
      default:
        return Colors.surfaceGlassTint;
    }
  };

  const getBorderColor = () => {
    switch (variant) {
      case 'prominent':
        return Colors.surfaceBorderProminent;
      case 'modal':
        return Colors.surfaceBorderProminent;
      default:
        return Colors.surfaceBorder;
    }
  };

  return (
    <View
      style={[
        styles.outerContainer,
        {
          borderRadius,
          borderColor: getBorderColor(),
          backgroundColor: getBackgroundColor(),
        },
        style,
      ]}
    >
      {Platform.OS === 'ios' && (
        <BlurView
          intensity={intensity}
          tint="dark"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius,
              overflow: 'hidden',
            },
          ]}
        />
      )}
      {/* Fine Upper Highlight */}
      <View
        style={[
          styles.topHighlight,
          { borderTopLeftRadius: borderRadius, borderTopRightRadius: borderRadius },
        ]}
      />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.glassHighlight,
    zIndex: 1,
  },
});
