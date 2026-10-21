import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from 'react-native-svg';
import { Plus, ChevronRight } from 'lucide-react-native';
import { Colors } from '../../constants/theme';
import { RideoxyWordmark } from '../home/RideoxyWordmark';
import { GarageMotorcycle } from './garageStorage';
import { BikeImage, STOCK_GARAGE_IMAGE } from '../BikeImage';

export const GARAGE_HERO_IMAGE = STOCK_GARAGE_IMAGE;
const BG = Colors.background;

/** Square edit icon matching the prototype's "View Details" button icon. */
const EditDetailsIcon: React.FC<{ color: string }> = ({ color }) => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
    <Path
      d="M11 4H6C4.89543 4 4 4.89543 4 6V18C4 19.1046 4.89543 20 6 20H18C19.1046 20 20 19.1046 20 18V13"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M17.5 3.5C18.3284 2.67157 19.6716 2.67157 20.5 3.5C21.3284 4.32843 21.3284 5.67157 20.5 6.5L12 15L8 16L9 12L17.5 3.5Z"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

interface GarageHeroBackdropProps {
  photoUri?: string | null;
}

/**
 * Scroll-attached cinematic hero backdrop using `BikeImage`.
 * - When `photoUri` exists: renders the user's real motorcycle photo centered (`cover`) filling the hero frame.
 * - When `photoUri` is empty: renders the dimmed fallback with a subtle "Stock image" badge.
 */
export const GarageHeroBackdrop: React.FC<GarageHeroBackdropProps> = ({ photoUri }) => {
  const { width } = useWindowDimensions();
  const height = Math.round(width * 1.14);
  const hasUserPhoto = !!(photoUri && photoUri.trim().length > 0);

  return (
    <View pointerEvents="none" style={[styles.backdrop, { width, height }]}>
      <BikeImage
        photoUri={photoUri}
        variant="hero"
        showStockBadge={!hasUserPhoto}
        style={{ width, height }}
        imageStyle={
          hasUserPhoto
            ? { width, height }
            : {
                position: 'absolute',
                left: Math.round(width * 0.16),
                top: -Math.round(width * 0.04),
                width: Math.round(width * 0.88),
                height: Math.round(width * 1.16),
              }
        }
      />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="garageHeroH" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={BG} stopOpacity={hasUserPhoto ? '0.88' : '1'} />
            <Stop offset="0.24" stopColor={BG} stopOpacity={hasUserPhoto ? '0.72' : '0.94'} />
            <Stop offset="0.50" stopColor={BG} stopOpacity={hasUserPhoto ? '0.32' : '0.52'} />
            <Stop offset="0.75" stopColor={BG} stopOpacity="0.10" />
            <Stop offset="1" stopColor={BG} stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="garageHeroV" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={BG} stopOpacity="0.82" />
            <Stop offset="0.16" stopColor={BG} stopOpacity="0.30" />
            <Stop offset="0.46" stopColor={BG} stopOpacity="0.04" />
            <Stop offset="0.74" stopColor={BG} stopOpacity="0.32" />
            <Stop offset="0.89" stopColor={BG} stopOpacity="0.90" />
            <Stop offset="1" stopColor={BG} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#garageHeroH)" />
        <Rect x="0" y="0" width={width} height={height} fill="url(#garageHeroV)" />
      </Svg>
    </View>
  );
};

interface GarageHeaderProps {
  onAddMotorcycle: () => void;
}

export const GarageHeader: React.FC<GarageHeaderProps> = ({ onAddMotorcycle }) => (
  <View style={styles.header}>
    <View accessibilityRole="header" accessibilityLabel="Rideoxy — More Rides. Better Days.">
      <RideoxyWordmark width={206} height={21} />
      <Text style={styles.tagline}>More Rides. Better Days.</Text>
    </View>
    <Pressable
      onPress={onAddMotorcycle}
      accessibilityRole="button"
      accessibilityLabel="Add motorcycle"
      hitSlop={8}
      style={({ pressed }) => [
        styles.addBtn,
        pressed && { opacity: 0.72, transform: [{ scale: 0.96 }] },
      ]}
    >
      <Plus size={20} color={Colors.primary} strokeWidth={2} />
    </Pressable>
  </View>
);

export function formatHeroSpecs(bike: GarageMotorcycle | null): string {
  if (!bike) return 'Register your motorcycle below';
  const cat = bike.category?.trim();
  const cc = bike.engineCc != null && bike.engineCc > 0 ? `${bike.engineCc} cc` : null;
  if (cat && cc) return `${cat} • ${cc}`;
  if (cat) return cat;
  if (cc) return cc;
  return 'Specs not set • Tap View Details';
}

interface GarageHeroContentProps {
  motorcycle: GarageMotorcycle | null;
  onViewDetails: () => void;
  onAddBikePhoto: () => void;
}

export const GarageHeroContent: React.FC<GarageHeroContentProps> = ({
  motorcycle,
  onViewDetails,
  onAddBikePhoto,
}) => {
  const hasBike = !!motorcycle;
  const currentPhotoUri = motorcycle?.photo_uri ?? motorcycle?.imageUri ?? null;
  const hasUserPhoto = !!(currentPhotoUri && currentPhotoUri.trim().length > 0);

  const badgeLabel = !hasBike
    ? 'NO BIKE SAVED'
    : motorcycle.isDefault
      ? 'DEFAULT'
      : 'SELECTED';

  return (
    <View style={styles.heroContainer}>
      <View style={styles.titleBlock}>
        <Text style={styles.pageTitle} accessibilityRole="header">
          My Garage
        </Text>
        <Text style={styles.pageSubtitle}>Your motorcycles, all in one place.</Text>
      </View>

      <View style={styles.bikeBlock}>
        <View style={styles.badgePill}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeText}>{badgeLabel}</Text>
        </View>

        <Text style={styles.bikeName} numberOfLines={2}>
          {hasBike ? motorcycle.name : 'Empty Garage'}
        </Text>

        <Text style={styles.bikeSpecs} numberOfLines={1}>
          {formatHeroSpecs(motorcycle)}
        </Text>

        <View style={styles.actionsRow}>
          <Pressable
            onPress={onViewDetails}
            accessibilityRole="button"
            accessibilityLabel={
              hasBike ? `View details for ${motorcycle.name}` : 'Add motorcycle details'
            }
            hitSlop={6}
            style={({ pressed }) => [
              styles.detailsBtn,
              pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
            ]}
          >
            <View style={styles.detailsBtnHighlight} />
            <EditDetailsIcon color={Colors.textSecondary} />
            <Text style={styles.detailsBtnText}>
              {hasBike ? 'View Details' : 'Add Motorcycle'}
            </Text>
            <ChevronRight size={14} color={Colors.textSecondary} strokeWidth={2} />
          </Pressable>

          {!hasUserPhoto && (
            <Pressable
              onPress={onAddBikePhoto}
              accessibilityRole="button"
              accessibilityLabel="Add your bike's photo"
              hitSlop={6}
              style={({ pressed }) => [
                styles.photoPromptChip,
                pressed && { opacity: 0.78, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Text style={styles.photoPromptText}>📷 Add your bike's photo</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
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
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(14, 36, 26, 0.72)',
    borderWidth: 1.2,
    borderColor: 'rgba(99, 230, 164, 0.52)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContainer: {
    marginTop: 26,
    marginBottom: 24,
  },
  titleBlock: {
    maxWidth: '72%',
  },
  pageTitle: {
    color: Colors.text,
    fontSize: 35,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  pageSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13.5,
    fontWeight: '400',
    marginTop: 5,
    letterSpacing: 0.1,
  },
  bikeBlock: {
    marginTop: 32,
  },
  badgePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(14, 46, 31, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(99, 230, 164, 0.36)',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  badgeText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  bikeName: {
    color: Colors.text,
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginTop: 10,
    maxWidth: '68%',
  },
  bikeSpecs: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '400',
    marginTop: 4,
    maxWidth: '68%',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 36,
    paddingHorizontal: 13,
    borderRadius: 18,
    backgroundColor: 'rgba(20, 26, 23, 0.80)',
    borderWidth: 1,
    borderColor: 'rgba(230, 255, 239, 0.16)',
    overflow: 'hidden',
  },
  detailsBtnHighlight: {
    position: 'absolute',
    top: 0,
    left: 10,
    right: 10,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  detailsBtnText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  photoPromptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(14, 38, 26, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(99, 230, 164, 0.38)',
  },
  photoPromptText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
