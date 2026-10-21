import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Polyline, Circle, Line } from 'react-native-svg';
import { ChevronRight, Route } from 'lucide-react-native';
import { Colors } from '../../constants/theme';
import { Ride } from '../../types/ride';
import { formatDuration } from '../../services/distance';

const THUMB = 56;

/** Offline, tile-free route preview drawn from recorded [lon, lat] coordinates. */
export const RouteThumbnail: React.FC<{ coords: [number, number][] }> = ({ coords }) => {
  const grid = (
    <>
      <Line x1="0" y1="18" x2={THUMB} y2="14" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      <Line x1="0" y1="40" x2={THUMB} y2="44" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      <Line x1="20" y1="0" x2="16" y2={THUMB} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      <Line x1="40" y1="0" x2="44" y2={THUMB} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
    </>
  );

  if (coords.length < 2) {
    return (
      <View style={styles.thumb}>
        <Svg width={THUMB} height={THUMB}>
          {grid}
          <Polyline
            points="14,42 26,28 34,31 43,15"
            fill="none"
            stroke={Colors.primary}
            strokeWidth="1.8"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <Circle cx="14" cy="42" r="2.4" fill={Colors.primary} />
          <Circle
            cx="43"
            cy="15"
            r="2.4"
            fill={Colors.background}
            stroke={Colors.primary}
            strokeWidth="1.4"
          />
        </Svg>
      </View>
    );
  }

  const step = Math.max(1, Math.floor(coords.length / 60));
  const sampled = coords.filter((_, i) => i % step === 0 || i === coords.length - 1);
  const meanLat = sampled.reduce((s, c) => s + c[1], 0) / sampled.length;
  const kx = Math.cos((meanLat * Math.PI) / 180);
  const xs = sampled.map((c) => c[0] * kx);
  const ys = sampled.map((c) => c[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const pad = 11;
  const inner = THUMB - pad * 2;
  const offX = (inner - ((maxX - minX) / span) * inner) / 2;
  const offY = (inner - ((maxY - minY) / span) * inner) / 2;
  const pts = sampled.map((_, i) => [
    pad + offX + ((xs[i] - minX) / span) * inner,
    pad + offY + ((maxY - ys[i]) / span) * inner,
  ]);
  const first = pts[0];
  const last = pts[pts.length - 1];

  return (
    <View style={styles.thumb}>
      <Svg width={THUMB} height={THUMB}>
        {grid}
        <Polyline
          points={pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}
          fill="none"
          stroke={Colors.primary}
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <Circle cx={first[0]} cy={first[1]} r="2.4" fill={Colors.primary} />
        <Circle cx={last[0]} cy={last[1]} r="2.4" fill={Colors.background} stroke={Colors.primary} strokeWidth="1.4" />
      </Svg>
    </View>
  );
};

function rideName(startMs: number): string {
  const h = new Date(startMs).getHours();
  if (h >= 5 && h < 12) return 'Morning Ride';
  if (h >= 12 && h < 17) return 'Afternoon Ride';
  if (h >= 17 && h < 21) return 'Evening Ride';
  return 'Night Ride';
}

function rideDate(startMs: number): string {
  const d = new Date(startMs);
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date}  ·  ${time}`;
}

interface RecentRideRowProps {
  ride: Ride;
  coords: [number, number][];
  onPress: () => void;
  showDivider: boolean;
}

export const RecentRideRow: React.FC<RecentRideRowProps> = ({ ride, coords, onPress, showDivider }) => {
  const dist = ride.distance < 100 ? ride.distance.toFixed(1) : String(Math.round(ride.distance));
  const name = rideName(ride.start_time);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${rideDate(ride.start_time)}, ${dist} kilometres, ${formatDuration(ride.duration)}`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <RouteThumbnail coords={coords} />
      <View style={styles.middle}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.date} numberOfLines={1}>
          {rideDate(ride.start_time)}
        </Text>
      </View>
      <View style={styles.right}>
        <View style={styles.distRow}>
          <Text style={styles.dist}>{dist}</Text>
          <Text style={styles.distUnit}>km</Text>
        </View>
        <Text style={styles.duration}>{formatDuration(ride.duration)}</Text>
      </View>
      <ChevronRight size={18} color={Colors.textMuted} strokeWidth={1.8} />
      {showDivider ? <View style={styles.divider} /> : null}
    </Pressable>
  );
};

export const RecentRidesSkeleton: React.FC = () => (
  <View accessibilityLabel="Loading recent rides">
    {[0, 1, 2].map((i) => (
      <View key={i} style={styles.row}>
        <View style={[styles.thumb, { opacity: 0.6 }]} />
        <View style={styles.middle}>
          <View style={[styles.skel, { width: '55%' }]} />
          <View style={[styles.skel, { width: '75%', marginTop: 8, opacity: 0.6 }]} />
        </View>
      </View>
    ))}
  </View>
);

export const RecentRidesEmpty: React.FC = () => (
  <View style={styles.empty}>
    <View style={styles.thumb}>
      <Route size={20} color={Colors.textSecondary} strokeWidth={1.6} />
    </View>
    <View style={styles.middle}>
      <Text style={styles.name}>No rides yet</Text>
      <Text style={styles.date}>Your recorded routes will appear here.</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 14,
  },
  rowPressed: {
    opacity: 0.6,
  },
  divider: {
    position: 'absolute',
    left: THUMB + 14,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(230,255,239,0.12)',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 12,
    backgroundColor: '#0F1513',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(230,255,239,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  middle: {
    flex: 1,
  },
  name: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  date: {
    color: Colors.textMuted,
    fontSize: 12.5,
    marginTop: 4,
  },
  right: {
    alignItems: 'flex-end',
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  dist: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  distUnit: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginLeft: 3,
  },
  duration: {
    color: Colors.textMuted,
    fontSize: 12.5,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  skel: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
  },
});
