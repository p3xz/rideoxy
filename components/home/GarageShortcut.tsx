import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Svg, { Defs, LinearGradient, Stop, Rect, Path, Circle, G } from 'react-native-svg';
import { ChevronRight } from 'lucide-react-native';
import { Colors } from '../../constants/theme';
import { HOME_HERO_IMAGE } from './HomeHero';
import { BikeImage } from '../BikeImage';
import { getDefaultBikePhotoUri } from '../garage/garageStorage';

const SURFACE = '#101513';

/** Clean automotive sport-motorcycle silhouette matching the prototype's Your Garage icon. */
const MotorcycleIcon: React.FC = () => (
  <Svg width={24} height={24} viewBox="0 0 28 24" fill="none">
    <G stroke={Colors.text} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="6.2" cy="17.2" r="4.1" />
      <Circle cx="21.8" cy="17.2" r="4.1" />
      <Path d="M 6.2 17.2 L 11.2 11.2 H 17.2 L 14.2 17.2 H 9.5" />
      <Path d="M 16.2 8.2 H 19.8 L 21.8 17.2" />
      <Path d="M 8.5 11.2 L 11.2 9.4 H 14.5" />
      <Path d="M 19.2 8.2 L 21.5 9.8" />
    </G>
  </Svg>
);

export const GarageShortcut: React.FC<{ bikeName: string; onPress: () => void }> = ({ bikeName, onPress }) => {
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getDefaultBikePhotoUri().then((uri) => {
        if (active) setPhotoUri(uri);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={bikeName ? `Your garage, ${bikeName}` : 'Your garage, 1 motorcycle'}
      style={({ pressed }) => [styles.container, pressed && { opacity: 0.72 }]}
    >
      <BikeImage
        variant="shortcut"
        photoUri={photoUri}
        fallbackSource={HOME_HERO_IMAGE}
        imageStyle={styles.bgImage}
      />
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="garageFade" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0.22" stopColor={SURFACE} stopOpacity="1" />
            <Stop offset="1" stopColor={SURFACE} stopOpacity="0.32" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#garageFade)" />
      </Svg>
      <View style={styles.highlight} />

      <View style={styles.iconBox}>
        <MotorcycleIcon />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>Your Garage</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {bikeName ? `${bikeName}  ·  1 motorcycle` : '1 motorcycle'}
        </Text>
      </View>
      <ChevronRight size={18} color={Colors.textSecondary} strokeWidth={1.8} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 68,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: 'rgba(230, 255, 239, 0.13)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 13,
  },
  bgImage: {
    position: 'absolute',
    right: 0,
    top: -42,
    width: '72%',
    height: 210,
    opacity: 0.52,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 1,
    backgroundColor: Colors.glassHighlight,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(230, 255, 239, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
  },
  title: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
});
