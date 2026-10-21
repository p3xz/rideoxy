import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Rect, Path, Circle } from 'react-native-svg';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Colors } from '../../constants/theme';
import { GarageMotorcycle, formatGarageDistance } from './garageStorage';
import { BikeImage } from '../BikeImage';

/** Rounded-square odometer dial icon matching the prototype's motorcycle card. */
const OdometerDialIcon: React.FC<{ color?: string; size?: number }> = ({
  color = Colors.textSecondary,
  size = 19,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect
      x="3.5"
      y="4.5"
      width="17"
      height="15"
      rx="4.5"
      stroke={color}
      strokeWidth="1.6"
    />
    <Circle cx="7.5" cy="10" r="0.9" fill={color} />
    <Circle cx="12" cy="8" r="0.9" fill={color} />
    <Circle cx="16.5" cy="10" r="0.9" fill={color} />
    <Path
      d="M8.5 15.2C9.4 16.2 10.6 16.7 12 16.7C13.4 16.7 14.6 16.2 15.5 15.2"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <Path
      d="M12 14L14.2 11.2"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </Svg>
);

/** Compact calendar outline icon matching the prototype's motorcycle card. */
const CompactCalendarIcon: React.FC<{ color?: string; size?: number }> = ({
  color = Colors.textSecondary,
  size = 17,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect
      x="3.5"
      y="5"
      width="17"
      height="15.5"
      rx="2.6"
      stroke={color}
      strokeWidth="1.6"
    />
    <Path
      d="M8 3.2V6.2M16 3.2V6.2M3.5 9.8H20.5"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </Svg>
);

export function formatCardSpecs(bike: GarageMotorcycle): string {
  const cc = bike.engineCc != null && bike.engineCc > 0 ? `${bike.engineCc} cc` : null;
  const cat = bike.category?.trim();
  if (cc && cat) return `${cc} • ${cat}`;
  if (cc) return cc;
  if (cat) return cat;
  return 'Tap to add engine & category';
}

export interface GarageMotorcyclesSectionProps {
  motorcycles: GarageMotorcycle[];
  activeIndex: number;
  onSelectIndex: (index: number) => void;
  onOpenMotorcycle: (bike: GarageMotorcycle) => void;
  onAddMotorcycle: () => void;
  onAddBikePhoto?: (bike: GarageMotorcycle) => void;
  resolvedOdometerKm: number | null;
  distanceUnit?: string;
}

export const GarageMotorcyclesSection: React.FC<GarageMotorcyclesSectionProps> = ({
  motorcycles,
  activeIndex,
  onSelectIndex,
  onOpenMotorcycle,
  onAddMotorcycle,
  resolvedOdometerKm,
  distanceUnit = 'km',
}) => {
  const count = motorcycles.length;
  const safeIndex = count > 0 ? Math.min(Math.max(0, activeIndex), count - 1) : 0;
  const currentBike = count > 0 ? motorcycles[safeIndex] : null;
  const canCycle = count > 1;

  const handlePrev = () => {
    if (!canCycle) return;
    const prev = (safeIndex - 1 + count) % count;
    onSelectIndex(prev);
  };

  const handleNext = () => {
    if (!canCycle) return;
    const next = (safeIndex + 1) % count;
    onSelectIndex(next);
  };

  const odometerDisplay =
    resolvedOdometerKm !== null && resolvedOdometerKm >= 0
      ? `${formatGarageDistance(resolvedOdometerKm)} ${distanceUnit}`
      : '—';

  const purchaseDisplay =
    currentBike?.purchaseDate && currentBike.purchaseDate.trim().length > 0
      ? currentBike.purchaseDate.trim()
      : '—';

  const bikePhotoUri = currentBike?.photo_uri ?? currentBike?.imageUri ?? null;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Your Motorcycles
        </Text>
        <View style={styles.pagerRow}>
          <Text style={styles.pagerCount}>
            {count > 0 ? `${safeIndex + 1} of ${count}` : '0 of 0'}
          </Text>
          <Pressable
            onPress={handlePrev}
            disabled={!canCycle}
            accessibilityRole="button"
            accessibilityLabel="Previous motorcycle"
            hitSlop={8}
            style={({ pressed }) => [
              styles.arrowBtn,
              !canCycle && styles.arrowDisabled,
              pressed && canCycle && { opacity: 0.6 },
            ]}
          >
            <ChevronLeft
              size={16}
              color={canCycle ? Colors.textSecondary : Colors.textMuted}
              strokeWidth={1.8}
            />
          </Pressable>
          <Pressable
            onPress={handleNext}
            disabled={!canCycle}
            accessibilityRole="button"
            accessibilityLabel="Next motorcycle"
            hitSlop={8}
            style={({ pressed }) => [
              styles.arrowBtn,
              !canCycle && styles.arrowDisabled,
              pressed && canCycle && { opacity: 0.6 },
            ]}
          >
            <ChevronRight
              size={16}
              color={canCycle ? Colors.textSecondary : Colors.textMuted}
              strokeWidth={1.8}
            />
          </Pressable>
        </View>
      </View>

      {currentBike ? (
        <Pressable
          onPress={() => onOpenMotorcycle(currentBike)}
          accessibilityRole="button"
          accessibilityLabel={`${currentBike.name}, ${formatCardSpecs(currentBike)}, Odometer ${odometerDisplay}, Purchase Date ${purchaseDisplay}`}
          style={({ pressed }) => [
            styles.card,
            currentBike.isDefault && styles.cardDefault,
            pressed && { opacity: 0.82, transform: [{ scale: 0.992 }] },
          ]}
        >
          <View style={styles.cardTopHighlight} />
          <BikeImage
            photoUri={bikePhotoUri}
            variant="card"
            style={styles.thumbWrap}
          />

          <View style={styles.cardBody}>
            <View style={styles.badgePill}>
              <View style={styles.badgeDot} />
              <Text style={styles.badgeText}>
                {currentBike.isDefault ? 'DEFAULT' : 'GARAGE BAY'}
              </Text>
            </View>

            <Text style={styles.bikeTitle} numberOfLines={1}>
              {currentBike.name}
            </Text>

            <Text style={styles.bikeSubtitle} numberOfLines={1}>
              {formatCardSpecs(currentBike)}
            </Text>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <OdometerDialIcon />
                <View style={styles.metaTextCol}>
                  <Text style={styles.metaValue} numberOfLines={1}>
                    {odometerDisplay}
                  </Text>
                  <Text style={styles.metaLabel} numberOfLines={1}>
                    Odometer
                  </Text>
                </View>
              </View>

              <View style={styles.metaDivider} />

              <View style={[styles.metaItem, { flex: 1 }]}>
                <CompactCalendarIcon />
                <View style={styles.metaTextCol}>
                  <Text style={styles.metaValue} numberOfLines={1}>
                    {purchaseDisplay}
                  </Text>
                  <Text style={styles.metaLabel} numberOfLines={1}>
                    Purchase Date
                  </Text>
                </View>
              </View>

              <View style={styles.endDivider} />

              <ChevronRight size={17} color={Colors.textSecondary} strokeWidth={1.8} />
            </View>
          </View>
        </Pressable>
      ) : (
        <Pressable
          onPress={onAddMotorcycle}
          accessibilityRole="button"
          accessibilityLabel="No motorcycles in garage yet. Tap to add your first motorcycle."
          style={({ pressed }) => [
            styles.card,
            pressed && { opacity: 0.82 },
          ]}
        >
          <View style={styles.cardTopHighlight} />
          <BikeImage
            photoUri={null}
            variant="card"
            style={styles.thumbWrap}
          />

          <View style={styles.cardBody}>
            <View style={styles.badgePill}>
              <View style={styles.badgeDot} />
              <Text style={styles.badgeText}>EMPTY GARAGE</Text>
            </View>
            <Text style={styles.bikeTitle} numberOfLines={1}>
              No Motorcycle Saved
            </Text>
            <Text style={styles.bikeSubtitle} numberOfLines={1}>
              Register your bike to track specs & mileage
            </Text>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <OdometerDialIcon />
                <View style={styles.metaTextCol}>
                  <Text style={styles.metaValue}>—</Text>
                  <Text style={styles.metaLabel}>Odometer</Text>
                </View>
              </View>
              <View style={styles.metaDivider} />
              <View style={[styles.metaItem, { flex: 1 }]}>
                <CompactCalendarIcon />
                <View style={styles.metaTextCol}>
                  <Text style={styles.metaValue}>—</Text>
                  <Text style={styles.metaLabel}>Purchase Date</Text>
                </View>
              </View>
              <View style={styles.endDivider} />
              <ChevronRight size={17} color={Colors.textSecondary} strokeWidth={1.8} />
            </View>
          </View>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginTop: 22,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 19,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  pagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pagerCount: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginRight: 4,
    fontVariant: ['tabular-nums'],
  },
  arrowBtn: {
    padding: 2,
  },
  arrowDisabled: {
    opacity: 0.55,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 13,
    backgroundColor: 'rgba(17, 23, 20, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(230, 255, 239, 0.13)',
    overflow: 'hidden',
    position: 'relative',
  },
  cardDefault: {
    borderColor: 'rgba(99, 230, 164, 0.22)',
  },
  cardTopHighlight: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 1,
    backgroundColor: Colors.glassHighlight,
  },
  thumbWrap: {
    width: 96,
    height: 96,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0D1310',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(230, 255, 239, 0.14)',
  },
  cardBody: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  badgePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 999,
    backgroundColor: 'rgba(14, 46, 31, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(99, 230, 164, 0.34)',
  },
  badgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.primary,
  },
  badgeText: {
    color: Colors.primary,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  bikeTitle: {
    color: Colors.text,
    fontSize: 16.5,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginTop: 5,
  },
  bikeSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 9,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaTextCol: {
    justifyContent: 'center',
  },
  metaValue: {
    color: Colors.text,
    fontSize: 11.5,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  metaLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '400',
    marginTop: 1,
  },
  metaDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    backgroundColor: 'rgba(230, 255, 239, 0.13)',
    marginHorizontal: 9,
  },
  endDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    backgroundColor: 'rgba(230, 255, 239, 0.10)',
    marginLeft: 6,
    marginRight: 6,
  },
});
