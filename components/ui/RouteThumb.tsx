import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, Line } from 'react-native-svg';
import { UI } from '../../constants/ui';
import { getTrackPointsByRideId } from '../../database/trackPointRepository';

/** Offline, tile-free route preview. Falls back to a plain grid when there is no route. */
export function projectRoute(
  coords: [number, number][],
  size: number,
  pad: number
): { x: number; y: number }[] {
  if (coords.length < 2) return [];
  const step = Math.max(1, Math.floor(coords.length / 70));
  const sampled = coords.filter((_, i) => i % step === 0 || i === coords.length - 1);
  const meanLat = sampled.reduce((s, c) => s + c[1], 0) / sampled.length;
  const kx = Math.cos((meanLat * Math.PI) / 180);
  const xs = sampled.map((c) => c[0] * kx);
  const ys = sampled.map((c) => c[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY);
  if (!Number.isFinite(span) || span <= 0) return [];
  const inner = size - pad * 2;
  const offX = (inner - ((maxX - minX) / span) * inner) / 2;
  const offY = (inner - ((maxY - minY) / span) * inner) / 2;
  return sampled.map((_, i) => ({
    x: pad + offX + ((xs[i] - minX) / span) * inner,
    y: pad + offY + ((maxY - ys[i]) / span) * inner,
  }));
}

interface RouteThumbProps {
  rideId: string;
  size?: number;
}

export const RouteThumb: React.FC<RouteThumbProps> = ({ rideId, size = 60 }) => {
  const [coords, setCoords] = useState<[number, number][]>([]);

  useEffect(() => {
    let active = true;
    getTrackPointsByRideId(rideId)
      .then((pts) => {
        if (active) setCoords(pts.map((p) => [p.longitude, p.latitude] as [number, number]));
      })
      .catch(() => {
        if (active) setCoords([]);
      });
    return () => {
      active = false;
    };
  }, [rideId]);

  const pts = projectRoute(coords, size, 11);
  const grid = (
    <>
      <Line x1="0" y1={size * 0.32} x2={size} y2={size * 0.26} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      <Line x1="0" y1={size * 0.7} x2={size} y2={size * 0.76} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      <Line x1={size * 0.34} y1="0" x2={size * 0.28} y2={size} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      <Line x1={size * 0.72} y1="0" x2={size * 0.78} y2={size} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
    </>
  );

  return (
    <View style={[styles.thumb, { width: size, height: size }]} accessibilityLabel={pts.length ? 'Route preview' : 'No route recorded'}>
      <Svg width={size} height={size}>
        {grid}
        {pts.length > 1 ? (
          <>
            <Polyline
              points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
              fill="none"
              stroke={UI.accent}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <Circle cx={pts[0].x} cy={pts[0].y} r="2.6" fill={UI.accent} />
            <Circle
              cx={pts[pts.length - 1].x}
              cy={pts[pts.length - 1].y}
              r="2.6"
              fill="#0B100E"
              stroke={UI.accent}
              strokeWidth="1.4"
            />
          </>
        ) : null}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  thumb: {
    borderRadius: 14,
    backgroundColor: '#0C1411',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
});
