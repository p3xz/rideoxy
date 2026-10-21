import React from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect } from 'react-native-svg';
import { Plus, ChevronRight } from 'lucide-react-native';
import { Colors } from '../../constants/theme';
import { GARAGE_HERO_IMAGE } from './GarageHero';

const PANEL_BG = '#07150F';

export interface AddMotorcyclePanelProps {
  onPress: () => void;
}

export const AddMotorcyclePanel: React.FC<AddMotorcyclePanelProps> = ({ onPress }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel="Add Motorcycle. Register a new bike to your garage."
    style={({ pressed }) => [
      styles.container,
      pressed && { opacity: 0.84, transform: [{ scale: 0.992 }] },
    ]}
  >
    <Image
      source={GARAGE_HERO_IMAGE}
      style={styles.bgImage}
      resizeMode="cover"
      accessibilityIgnoresInvertColors
    />

    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="addBikeFade" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={PANEL_BG} stopOpacity="0.96" />
          <Stop offset="0.48" stopColor="#0B2218" stopOpacity="0.88" />
          <Stop offset="0.78" stopColor="#0D291D" stopOpacity="0.58" />
          <Stop offset="1" stopColor="#081A12" stopOpacity="0.42" />
        </LinearGradient>
        <RadialGradient id="addBikeGlow" cx="0.12" cy="0.5" rx="0.28" ry="0.85">
          <Stop offset="0" stopColor="#2E9864" stopOpacity="0.26" />
          <Stop offset="1" stopColor={PANEL_BG} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#addBikeFade)" />
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#addBikeGlow)" />
    </Svg>

    <View style={styles.topHighlight} />

    <View style={styles.outerCircle}>
      <View style={styles.innerCircle}>
        <Plus size={15} color="#06150E" strokeWidth={2.8} />
      </View>
    </View>

    <View style={styles.textBlock}>
      <Text style={styles.title} numberOfLines={1}>
        Add Motorcycle
      </Text>
      <Text style={styles.subtitle} numberOfLines={1}>
        Register a new bike to your garage
      </Text>
    </View>

    <ChevronRight size={19} color={Colors.text} strokeWidth={1.8} />
  </Pressable>
);

const styles = StyleSheet.create({
  container: {
    height: 78,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: PANEL_BG,
    borderWidth: 1,
    borderColor: 'rgba(99, 230, 164, 0.34)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    gap: 14,
    marginTop: 14,
    position: 'relative',
  },
  bgImage: {
    position: 'absolute',
    right: -12,
    top: -36,
    width: '68%',
    height: 210,
    opacity: 0.48,
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 18,
    right: 18,
    height: 1,
    backgroundColor: 'rgba(130, 240, 185, 0.22)',
  },
  outerCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(18, 66, 44, 0.56)',
    borderWidth: 1,
    borderColor: 'rgba(99, 230, 164, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: Colors.text,
    fontSize: 15.5,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 12.5,
    fontWeight: '400',
    marginTop: 3,
  },
});
