import React from 'react';
import Svg, { Path, G } from 'react-native-svg';
import { Colors } from '../../constants/theme';

interface RideoxyWordmarkProps {
  width?: number;
  height?: number;
}

/**
 * Custom geometric automotive-inspired SVG wordmark for RIDEOXY.
 * Wide tracking, precision vector letterforms, soft-silver/white primary characters,
 * and a restrained emerald-green accent stroke on the 'X' matching the prototype.
 */
export const RideoxyWordmark: React.FC<RideoxyWordmarkProps> = ({
  width = 212,
  height = 22,
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 236 24" fill="none">
      <G
        stroke={Colors.text}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* R (x: 2..20) */}
        <Path d="M 3 20 V 4 H 14.5 C 17.8 4 19.5 5.8 19.5 8.5 C 19.5 11.2 17.8 13 14.5 13 H 3 M 13.5 13 L 19.5 20" />

        {/* I (x: 36) */}
        <Path d="M 36 4 V 20" />

        {/* D (x: 52..70) */}
        <Path d="M 52 4 V 20 H 61.5 C 66.8 20 70 16.6 70 12 C 70 7.4 66.8 4 61.5 4 H 52 Z" />

        {/* E (x: 86..103) */}
        <Path d="M 103 4 H 86 V 20 H 103 M 86 12 H 99.5" />

        {/* O (x: 119..139) */}
        <Path d="M 126 4 H 132 C 136.2 4 139 6.8 139 11 V 13 C 139 17.2 136.2 20 132 20 H 126 C 121.8 20 119 17.2 119 13 V 11 C 119 6.8 121.8 4 126 4 Z" />

        {/* X — Primary diagonal stroke in white (top-left to bottom-right) */}
        <Path d="M 155 4 L 173 20" />

        {/* Y (x: 189..207) */}
        <Path d="M 189 4 L 198 12.8 L 207 4 M 198 12.8 V 20" />
      </G>

      {/* X — Restrained emerald-green intersecting stroke (bottom-left to top-right) */}
      <Path
        d="M 155 20 L 173 4"
        stroke={Colors.primary}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </Svg>
  );
};
