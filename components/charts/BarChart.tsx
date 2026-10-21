import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Easing, LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path, Line, Text as SvgText } from 'react-native-svg';
import { UI } from '../../constants/ui';
import { axisTicks, formatAxisValue, labelStep, niceMax, roundedTopBarPath } from './chartMath';
import { useReducedMotion, MOTION_DURATIONS, MOTION_EASINGS } from '../../lib/motion';

export interface BarDatum {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarDatum[];
  height?: number;
  /** Formats y-axis tick values. */
  formatY?: (v: number) => string;
}

const PAD_LEFT = 34;
const PAD_RIGHT = 6;
const PAD_TOP = 10;
const PAD_BOTTOM = 24;

/** Drives a 0→1 progress value on mount / whenever `resetKey` changes, respecting reduced motion. */
function useMountProgress(resetKey: string, reduceMotion: boolean): number {
  const anim = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const [progress, setProgress] = useState(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      setProgress(1);
      return;
    }
    anim.setValue(0);
    const id = anim.addListener(({ value }) => setProgress(value));
    const animation = Animated.timing(anim, {
      toValue: 1,
      duration: MOTION_DURATIONS.chart,
      easing: MOTION_EASINGS.outCubic,
      useNativeDriver: false,
    });
    animation.start();

    return () => {
      animation.stop();
      anim.removeListener(id);
    };
  }, [resetKey, anim, reduceMotion]);

  return reduceMotion ? 1 : progress;
}

/**
 * Reusable emerald bar chart. Handles empty, single-point and all-zero data,
 * uses "nice" y-axis maxima and sizes to its container width.
 */
export const BarChart: React.FC<BarChartProps> = ({ data, height = 170, formatY = formatAxisValue }) => {
  const [width, setWidth] = useState(0);
  const reduceMotion = useReducedMotion();
  const resetKey = data.map((d) => `${d.label}:${d.value}`).join('|');
  const progress = useMountProgress(resetKey, reduceMotion);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    if (w !== width) setWidth(w);
  };

  if (data.length === 0) return <View style={{ height }} />;

  const plotW = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const rawMax = Math.max(...data.map((d) => (Number.isFinite(d.value) ? d.value : 0)), 0);
  const max = niceMax(rawMax);
  const ticks = axisTicks(max);
  const slot = plotW / data.length;
  const barW = Math.max(4, Math.min(26, slot * 0.58));
  const step = labelStep(data.length, plotW);

  const summaryText = React.useMemo(() => {
    if (!data.length) return 'Empty bar chart';
    const total = data.reduce((acc, d) => acc + d.value, 0);
    const avg = total / data.length;
    return `Bar comparison chart, ${data.length} periods. Average ${formatY(avg)}, peak ${formatY(rawMax)}.`;
  }, [data, formatY, rawMax]);

  return (
    <View
      style={{ height }}
      onLayout={onLayout}
      accessible={true}
      accessibilityRole="image"
      accessibilityLabel={summaryText}
    >
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={UI.chartTop} stopOpacity="1" />
              <Stop offset="1" stopColor={UI.chartBottom} stopOpacity="0.9" />
            </LinearGradient>
          </Defs>

          {ticks.map((t) => {
            const y = PAD_TOP + plotH - (t / max) * plotH;
            return (
              <React.Fragment key={`g-${t}`}>
                <Line x1={PAD_LEFT} x2={width - PAD_RIGHT} y1={y} y2={y} stroke={UI.gridLine} strokeWidth={1} />
                <SvgText x={PAD_LEFT - 8} y={y + 3.5} fontSize={10} fill={UI.textMuted} textAnchor="end">
                  {formatY(t)}
                </SvgText>
              </React.Fragment>
            );
          })}

          {data.map((d, i) => {
            const v = Number.isFinite(d.value) ? Math.max(0, d.value) : 0;
            const fullH = (v / max) * plotH;
            const h = fullH * progress;
            const cx = PAD_LEFT + slot * i + slot / 2;
            const x = cx - barW / 2;
            const y = PAD_TOP + plotH - h;
            return (
              <React.Fragment key={`b-${i}`}>
                {h > 0.5 ? <Path d={roundedTopBarPath(x, y, barW, h, 5)} fill="url(#barGrad)" /> : null}
                {i % step === 0 ? (
                  <SvgText x={cx} y={height - 6} fontSize={10} fill={UI.textMuted} textAnchor="middle">
                    {d.label}
                  </SvgText>
                ) : null}
              </React.Fragment>
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
};

export const chartStyles = StyleSheet.create({});
