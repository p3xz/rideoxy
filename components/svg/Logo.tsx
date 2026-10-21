import React from 'react';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Colors } from '../../constants/theme';

interface LogoProps {
  size?: number;
  color?: string;
  accentColor?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 36,
  color = Colors.text,
  accentColor = Colors.primary,
}) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Defs>
        <LinearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#181E1D" />
          <Stop offset="100%" stopColor="#111515" />
        </LinearGradient>
        <LinearGradient id="accentGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={accentColor} />
          <Stop offset="100%" stopColor="#2B8F89" />
        </LinearGradient>
      </Defs>

      {/* Hexagonal Technical Shield Base */}
      <Path
        d="M50 8 L88 28 L88 68 L50 92 L12 68 L12 28 Z"
        fill="url(#shieldGrad)"
        stroke={Colors.surfaceBorder}
        strokeWidth="2.5"
      />

      {/* Road / Speed Perspective Lines */}
      <Path
        d="M32 76 L46 36 L54 36 L68 76 Z"
        fill="#080A0A"
        stroke={Colors.surfaceBorder}
        strokeWidth="1.5"
      />

      {/* Center Dashed Trajectory */}
      <Path
        d="M50 42 L50 50 M50 56 L50 66 M50 72 L50 82"
        stroke={accentColor}
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* Motorcycle Visor / Wing Line */}
      <Path
        d="M26 32 C38 22, 62 22, 74 32 L68 40 C58 34, 42 34, 32 40 Z"
        fill="url(#accentGlow)"
      />

      {/* Apex Core Marker */}
      <Circle cx="50" cy="24" r="3" fill={color} />
    </Svg>
  );
};
