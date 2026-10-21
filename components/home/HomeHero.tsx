import React from 'react';
import { View, Text, Image, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Settings, ArrowUp } from 'lucide-react-native';
import { Colors } from '../../constants/theme';
import { RideoxyWordmark } from './RideoxyWordmark';

export const HOME_HERO_IMAGE = require('../../assets/images/home-hero.jpg');
const HERO_ASPECT = 1152 / 896;
const BG = Colors.background;

/** Absolute, scroll-attached cinematic backdrop that fades into the page background. */
export const HomeHeroBackdrop: React.FC = () => {
  const { width } = useWindowDimensions();
  const height = Math.round(width * HERO_ASPECT);

  return (
    <View pointerEvents="none" style={[styles.backdrop, { width, height }]}>
      <Image
        source={HOME_HERO_IMAGE}
        style={{ width, height }}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="heroV" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={BG} stopOpacity="0.68" />
            <Stop offset="0.22" stopColor={BG} stopOpacity="0.30" />
            <Stop offset="0.45" stopColor={BG} stopOpacity="0.04" />
            <Stop offset="0.64" stopColor={BG} stopOpacity="0.45" />
            <Stop offset="0.82" stopColor={BG} stopOpacity="0.98" />
            <Stop offset="1" stopColor={BG} stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="heroH" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={BG} stopOpacity="0.82" />
            <Stop offset="0.40" stopColor={BG} stopOpacity="0.36" />
            <Stop offset="0.65" stopColor={BG} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#heroH)" />
        <Rect x="0" y="0" width={width} height={height} fill="url(#heroV)" />
      </Svg>
    </View>
  );
};

interface HomeHeaderProps {
  onOpenSettings: () => void;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({ onOpenSettings }) => (
  <View style={styles.header}>
    <View accessibilityRole="header" accessibilityLabel="Rideoxy — More Rides. Better Days.">
      <RideoxyWordmark width={206} height={21} />
      <Text style={styles.tagline}>More Rides. Better Days.</Text>
    </View>
    <Pressable
      onPress={onOpenSettings}
      accessibilityRole="button"
      accessibilityLabel="Open settings"
      hitSlop={8}
      style={({ pressed }) => [
        styles.settingsBtn,
        pressed && { opacity: 0.65, transform: [{ scale: 0.96 }] },
      ]}
    >
      <View style={styles.settingsHighlight} />
      <Settings size={20} color={Colors.text} strokeWidth={1.7} />
    </Pressable>
  </View>
);

/** Formats kilometres with one decimal under 100, thousands separators above. */
export function formatHeroDistance(km: number): string {
  if (km < 100) return km.toFixed(1);
  return String(Math.round(km)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

interface HeroTelemetryProps {
  totalKm: number;
  thisMonthKm: number;
  loaded: boolean;
}

export const HeroTelemetry: React.FC<HeroTelemetryProps> = ({ totalKm, thisMonthKm, loaded }) => {
  const share = totalKm > 0 ? Math.min(1, thisMonthKm / totalKm) : 0;
  const sharePct = Math.round(share * 100);
  const value = loaded ? formatHeroDistance(totalKm) : '—';

  return (
    <View
      style={styles.telemetry}
      accessible
      accessibilityLabel={`Total distance ${value} kilometres. ${thisMonthKm.toFixed(1)} kilometres this month.`}
    >
      <Text style={styles.telemetryLabel}>TOTAL DISTANCE</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        <Text style={styles.unit}>km</Text>
      </View>

      {loaded && totalKm > 0 ? (
        <>
          <View style={styles.monthRow}>
            <ArrowUp size={13} color={Colors.primary} strokeWidth={2.4} />
            <Text style={styles.monthValue}>{sharePct}%</Text>
            <Text style={styles.monthLabel}>
              this month ({thisMonthKm.toFixed(1)} km)
            </Text>
          </View>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${
                    share >= 0.99
                      ? 44
                      : Math.max(Math.min(share * 100, 88), share > 0 ? 22 : 0)
                  }%`,
                },
              ]}
            />
          </View>
        </>
      ) : loaded ? (
        <>
          <View style={styles.monthRow}>
            <Text style={styles.monthLabel}>Ready for your first ride</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: '0%' }]} />
          </View>
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tagline: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '400',
    marginTop: 7,
    letterSpacing: 0.2,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: 'rgba(22, 28, 25, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(230, 255, 239, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  settingsHighlight: {
    position: 'absolute',
    top: 0,
    left: 10,
    right: 10,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
  },
  telemetry: {
    maxWidth: '64%',
  },
  telemetryLabel: {
    color: Colors.textSecondary,
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  value: {
    color: Colors.text,
    fontSize: 64,
    lineHeight: 72,
    fontWeight: '600',
    letterSpacing: -2.2,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    color: Colors.textSecondary,
    fontSize: 22,
    fontWeight: '400',
    marginLeft: 8,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  monthValue: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 3,
    fontVariant: ['tabular-nums'],
  },
  monthLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '400',
    marginLeft: 6,
  },
  track: {
    width: 170,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginTop: 12,
    overflow: 'hidden',
  },
  fill: {
    height: 3.5,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
});
