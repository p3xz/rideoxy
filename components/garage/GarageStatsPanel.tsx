import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { Colors } from '../../constants/theme';
import { GlassSurface } from '../GlassSurface';
import { formatGarageDistance } from './garageStorage';

/** Perspective highway/road outline icon matching Column 1 of the prototype. */
export const RoadPerspectiveIcon: React.FC<{ color?: string; size?: number }> = ({
  color = Colors.textSecondary,
  size = 19,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M4 19L8.2 5H15.8L20 19H4Z"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M12 7.5V9.5M12 12V14M12 16.5V17.5"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </Svg>
);

/** Map pin outline icon matching Column 2 of the prototype. */
export const MapPinOutlineIcon: React.FC<{ color?: string; size?: number }> = ({
  color = Colors.textSecondary,
  size = 19,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 20.5C12 20.5 18 14.8 18 9.75C18 6.3 15.3137 3.5 12 3.5C8.68629 3.5 6 6.3 6 9.75C6 14.8 12 20.5 12 20.5Z"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx="12" cy="9.75" r="2.2" stroke={color} strokeWidth="1.5" />
  </Svg>
);

/** Fuel pump dispenser outline icon matching Column 3 of the prototype. */
export const FuelDispenserIcon: React.FC<{ color?: string; size?: number }> = ({
  color = Colors.textSecondary,
  size = 19,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M5 20V5.8C5 4.80589 5.80589 4 6.8 4H13.2C14.1941 4 15 4.80589 15 5.8V20"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path d="M3.5 20H16.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    <Path d="M5 10.5H15" stroke={color} strokeWidth="1.5" />
    <Path
      d="M15 9.5H16.8C17.6837 9.5 18.4 10.2163 18.4 11.1V15.7C18.4 16.5837 19.1163 17.3 20 17.3C20.8837 17.3 21.5 16.5837 21.5 15.7V8.5L18.8 5.8"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/** Calendar outline icon with top pegs and date grid dots matching Column 4 of the prototype. */
export const CalendarGridIcon: React.FC<{ color?: string; size?: number }> = ({
  color = Colors.textSecondary,
  size = 19,
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
      d="M8 3.2V6.2M16 3.2V6.2M3.5 9.5H20.5"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <Circle cx="8.2" cy="13.2" r="0.9" fill={color} />
    <Circle cx="12" cy="13.2" r="0.9" fill={color} />
    <Circle cx="15.8" cy="13.2" r="0.9" fill={color} />
    <Circle cx="8.2" cy="16.8" r="0.9" fill={color} />
    <Circle cx="12" cy="16.8" r="0.9" fill={color} />
    <Circle cx="15.8" cy="16.8" r="0.9" fill={color} />
  </Svg>
);

interface StatColumnProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
}

const StatColumn: React.FC<StatColumnProps> = ({ icon, label, value, unit }) => (
  <View
    style={styles.cell}
    accessible
    accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}`}
  >
    {icon}
    <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>
      {label}
    </Text>
    <View style={styles.valueRow}>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
        {value}
      </Text>
      {unit ? (
        <Text style={styles.unit} numberOfLines={1}>
          {unit}
        </Text>
      ) : null}
    </View>
  </View>
);

export interface GarageStatsPanelProps {
  totalDistanceKm: number;
  distanceUnit?: string;
  totalRides: number;
  avgFuelEconomy: number | null;
  fuelEconomyUnit?: string;
  purchaseDate?: string | null;
  loaded: boolean;
}

export const GarageStatsPanel: React.FC<GarageStatsPanelProps> = ({
  totalDistanceKm,
  distanceUnit = 'km',
  totalRides,
  avgFuelEconomy,
  fuelEconomyUnit = 'km/L',
  purchaseDate,
  loaded,
}) => {
  const distanceValue = loaded ? formatGarageDistance(totalDistanceKm) : '—';
  const ridesValue = loaded ? String(totalRides) : '—';
  const fuelValue =
    loaded && avgFuelEconomy !== null && avgFuelEconomy > 0
      ? avgFuelEconomy.toFixed(1)
      : '—';
  const purchaseValue =
    loaded && purchaseDate && purchaseDate.trim().length > 0
      ? purchaseDate.trim()
      : '—';

  return (
    <GlassSurface variant="primary" intensity={28} borderRadius={18} style={styles.surface}>
      <View style={styles.row}>
        <StatColumn
          icon={<RoadPerspectiveIcon />}
          label="TOTAL DISTANCE"
          value={distanceValue}
          unit={distanceUnit}
        />
        <View style={styles.hairline} />
        <StatColumn
          icon={<MapPinOutlineIcon />}
          label="TOTAL RIDES"
          value={ridesValue}
        />
        <View style={styles.hairline} />
        <StatColumn
          icon={<FuelDispenserIcon />}
          label="AVG. FUEL ECONOMY"
          value={fuelValue}
          unit={avgFuelEconomy !== null && avgFuelEconomy > 0 ? fuelEconomyUnit : undefined}
        />
        <View style={styles.hairline} />
        <StatColumn
          icon={<CalendarGridIcon />}
          label="PURCHASE DATE"
          value={purchaseValue}
        />
      </View>
    </GlassSurface>
  );
};

const styles = StyleSheet.create({
  surface: {
    backgroundColor: 'rgba(17, 23, 20, 0.84)',
    borderColor: 'rgba(230, 255, 239, 0.13)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 15,
    paddingHorizontal: 3,
  },
  cell: {
    flex: 1,
    paddingHorizontal: 8,
    justifyContent: 'space-between',
  },
  hairline: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(230, 255, 239, 0.13)',
    marginVertical: 4,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 8.5,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginTop: 10,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  value: {
    color: Colors.text,
    fontSize: 17.5,
    fontWeight: '700',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  unit: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '400',
    marginLeft: 3,
  },
});
