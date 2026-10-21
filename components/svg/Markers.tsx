import React from 'react';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Polygon } from 'react-native-svg';
import { Colors } from '../../constants/theme';

export const StartMarker: React.FC<{ size?: number }> = ({ size = 26 }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <Circle cx="16" cy="16" r="14" fill={Colors.primary} fillOpacity="0.15" />
    <Circle cx="16" cy="16" r="8" fill={Colors.surface} stroke={Colors.primary} strokeWidth="2" />
    <Circle cx="16" cy="16" r="3.5" fill={Colors.text} />
  </Svg>
);

export const EndMarker: React.FC<{ size?: number }> = ({ size = 26 }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <Circle cx="16" cy="16" r="14" fill={Colors.danger} fillOpacity="0.15" />
    <Circle cx="16" cy="16" r="8" fill={Colors.surface} stroke={Colors.danger} strokeWidth="2" />
    <Polygon points="13,13 19,13 16,19" fill={Colors.text} />
  </Svg>
);

export const LiveRiderMarker: React.FC<{ size?: number; heading?: number | null }> = ({
  size = 36,
  heading = 0,
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    style={{ transform: [{ rotate: `${heading ?? 0}deg` }] }}
  >
    <Defs>
      <LinearGradient id="beamGrad" x1="0%" y1="100%" x2="0%" y2="0%">
        <Stop offset="0%" stopColor={Colors.secondary} stopOpacity="0.5" />
        <Stop offset="100%" stopColor={Colors.secondary} stopOpacity="0.0" />
      </LinearGradient>
    </Defs>
    {/* Heading Beam */}
    <Path d="M20 20 L8 0 L32 0 Z" fill="url(#beamGrad)" />
    {/* Outer Glow Ring */}
    <Circle cx="20" cy="20" r="13" fill={Colors.primary} fillOpacity="0.2" />
    {/* Rider Core Beacon */}
    <Circle cx="20" cy="20" r="8" fill={Colors.primary} stroke="#080A0A" strokeWidth="2" />
    {/* Center Direction Pointer */}
    <Path d="M20 15 L22.5 22 L20 20.5 L17.5 22 Z" fill="#080A0A" />
  </Svg>
);
