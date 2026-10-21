import React from 'react';
import Svg, {
  Path,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  G,
} from 'react-native-svg';
import { Colors } from '../../constants/theme';

interface MotorcycleIllustrationProps {
  width?: number;
  height?: number;
  accentColor?: string;
  lineColor?: string;
}

export const MotorcycleIllustration: React.FC<MotorcycleIllustrationProps> = ({
  width = 280,
  height = 160,
  accentColor = Colors.primary,
  lineColor = '#D1D5DB',
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 320 180" fill="none">
      <Defs>
        <LinearGradient id="motoGlow" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor={accentColor} stopOpacity="0.8" />
          <Stop offset="100%" stopColor="#2B8F89" stopOpacity="0.25" />
        </LinearGradient>
        <LinearGradient id="chassisGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#181E1D" />
          <Stop offset="100%" stopColor="#111515" />
        </LinearGradient>
      </Defs>

      {/* Ground Horizon Lines */}
      <Path
        d="M20 152 L300 152 M60 160 L260 160 M110 168 L210 168"
        stroke="#252E2A"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="8 6"
      />

      <G>
        {/* Rear Wheel & Rim */}
        <Circle
          cx="70"
          cy="125"
          r="26"
          stroke={lineColor}
          strokeWidth="3"
        />
        <Circle cx="70" cy="125" r="17" stroke="#334155" strokeWidth="2" />
        <Circle cx="70" cy="125" r="6" fill={accentColor} />
        <Path d="M70 108 L70 142 M53 125 L87 125" stroke="#334155" strokeWidth="1" />

        {/* Front Wheel & Rim */}
        <Circle
          cx="250"
          cy="125"
          r="26"
          stroke={lineColor}
          strokeWidth="3"
        />
        <Circle cx="250" cy="125" r="17" stroke="#334155" strokeWidth="2" />
        <Circle cx="250" cy="125" r="6" fill={accentColor} />
        <Path d="M250 108 L250 142 M233 125 L267 125" stroke="#334155" strokeWidth="1" />

        {/* Swingarm and Rear Suspension */}
        <Path
          d="M70 125 L125 118 L120 100 L95 118"
          stroke={lineColor}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Monoshock (Accent) */}
        <Path
          d="M102 114 L122 88"
          stroke={accentColor}
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Engine Block / Trellis Frame Silhouette */}
        <Path
          d="M120 120 L180 120 L195 95 L145 78 L120 100 Z"
          fill="url(#chassisGrad)"
          stroke="#384357"
          strokeWidth="1.8"
        />
        {/* Exhaust Pipe & Muffler */}
        <Path
          d="M160 115 C140 128, 100 134, 75 112 L50 112"
          stroke="#475569"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Front Inverted Fork Suspension */}
        <Path
          d="M250 125 L215 62 L208 64"
          stroke={lineColor}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <Path
          d="M246 122 L212 60"
          stroke={accentColor}
          strokeWidth="1.5"
        />

        {/* Fuel Tank & Sharp Technical Bodywork (Copper Accent) */}
        <Path
          d="M135 78 C150 58, 185 58, 205 68 L218 72 L198 88 L142 84 Z"
          fill="url(#motoGlow)"
          stroke={accentColor}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />

        {/* Tail Fairing & Seat */}
        <Path
          d="M135 78 L90 74 L82 82 L125 88 Z"
          fill="#1E2633"
          stroke={lineColor}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Aerodynamic Tail Winglet */}
        <Path
          d="M82 82 L65 72"
          stroke={accentColor}
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Rider Helmet Silhouette */}
        <Path
          d="M168 32 C178 32, 188 38, 188 48 C188 56, 178 60, 166 60 C156 60, 150 54, 150 44 C150 36, 158 32, 168 32 Z"
          fill="#1E2633"
          stroke={lineColor}
          strokeWidth="2"
        />
        {/* Helmet Visor / Tint */}
        <Path
          d="M176 40 C186 42, 186 48, 178 52"
          stroke={accentColor}
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Rider Torso & Arms (Leaning Forward / Sport Riding Position) */}
        <Path
          d="M162 58 C150 68, 138 78, 128 84"
          stroke={lineColor}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        {/* Arm reaching to Clip-on Handlebars */}
        <Path
          d="M164 62 L192 68 L206 65"
          stroke={lineColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Rider Leg tucked into Rearsets */}
        <Path
          d="M130 84 L146 100 L128 108"
          stroke={lineColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Headlight Beam / Speed Accent */}
        <Path
          d="M222 70 L260 66 M224 74 L255 72"
          stroke={accentColor}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </G>
    </Svg>
  );
};
