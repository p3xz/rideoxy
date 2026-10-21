import React, { useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, PanResponder, LayoutChangeEvent, Animated } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path, Line, Circle, Text as SvgText } from 'react-native-svg';
import { UI } from '../../constants/ui';
import { axisTicks, formatAxisValue, labelStep, niceMax, smoothPath } from './chartMath';
import { useReducedMotion, MOTION_DURATIONS, MOTION_EASINGS } from '../../lib/motion';

export interface AreaDatum {
  label: string;
  /** Longer label shown in the tooltip (exact date). */
  tooltipLabel: string;
  value: number;
}

interface AreaChartProps {
  data: AreaDatum[];
  height?: number;
  formatY?: (v: number) => string;
  /** Formats the tooltip value, e.g. "86.2 km". */
  formatValue?: (v: number) => string;
}

const PAD_LEFT = 34;
const PAD_RIGHT = 14;
const PAD_TOP = 14;
const PAD_BOTTOM = 24;

/**
 * Reusable smooth emerald area chart with gradient fill, gridlines, axis labels,
 * a dot on the latest point, and tap / drag tooltip. Handles empty, single-point and all-zero data.
 */
export const AreaChart: React.FC<AreaChartProps> = ({
  data,
  height = 190,
  formatY = formatAxisValue,
  formatValue = (v) => String(Number(v.toFixed(1))),
}) => {
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();
  const fadeAnim = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const tipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      fadeAnim.setValue(1);
      return;
    }
    fadeAnim.setValue(0);
    const anim = Animated.timing(fadeAnim, {
      toValue: 1,
      duration: MOTION_DURATIONS.fast + 60,
      easing: MOTION_EASINGS.outCubic,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [data, fadeAnim, reduceMotion]);

  useEffect(() => {
    if (activeIndex !== null) {
      if (reduceMotion) {
        tipAnim.setValue(1);
      } else {
        tipAnim.setValue(0);
        const anim = Animated.timing(tipAnim, {
          toValue: 1,
          duration: 110,
          useNativeDriver: true,
        });
        anim.start();
        return () => anim.stop();
      }
    }
  }, [activeIndex, reduceMotion, tipAnim]);

  const geometry = useMemo(() => {
    const plotW = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
    const plotH = height - PAD_TOP - PAD_BOTTOM;
    const rawMax = Math.max(...data.map((d) => (Number.isFinite(d.value) ? d.value : 0)), 0);
    const max = niceMax(rawMax);
    const n = data.length;
    const points = data.map((d, i) => {
      const v = Number.isFinite(d.value) ? Math.max(0, d.value) : 0;
      const x = n === 1 ? PAD_LEFT + plotW / 2 : PAD_LEFT + (plotW * i) / (n - 1);
      const y = PAD_TOP + plotH - (v / max) * plotH;
      return { x, y };
    });
    return { plotW, plotH, max, points };
  }, [data, width, height]);

  const geomRef = useRef(geometry);
  geomRef.current = geometry;
  const countRef = useRef(data.length);
  countRef.current = data.length;

  const pickIndex = (touchX: number) => {
    const g = geomRef.current;
    const n = countRef.current;
    if (n === 0) return;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < n; i++) {
      const dist = Math.abs(g.points[i].x - touchX);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    setActiveIndex(best);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => pickIndex(e.nativeEvent.locationX),
      onPanResponderMove: (e) => pickIndex(e.nativeEvent.locationX),
      onPanResponderTerminationRequest: () => true,
    })
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    if (w !== width) setWidth(w);
  };

  if (data.length === 0) return <View style={{ height }} />;

  const { plotW, plotH, max, points } = geometry;
  const ticks = axisTicks(max);
  const step = labelStep(data.length, plotW);
  const baselineY = PAD_TOP + plotH;
  const linePath = smoothPath(points);
  const areaPath =
    points.length > 1
      ? `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${baselineY} L ${points[0].x.toFixed(2)} ${baselineY} Z`
      : '';

  const shown = activeIndex !== null && activeIndex < data.length ? activeIndex : null;
  const last = points[points.length - 1];
  const tipPoint = shown !== null ? points[shown] : null;

  const summaryText = useMemo(() => {
    if (!data.length) return 'Empty area chart';
    const total = data.reduce((acc, d) => acc + d.value, 0);
    const peak = Math.max(...data.map((d) => d.value), 0);
    return `Distance trend chart, ${data.length} records. Peak ${formatValue(peak)}, total ${formatValue(total)}.`;
  }, [data, formatValue]);

  return (
    <View
      style={{ height }}
      onLayout={onLayout}
      accessible={true}
      accessibilityRole="image"
      accessibilityLabel={summaryText}
      {...panResponder.panHandlers}
    >
      {width > 0 ? (
        <Animated.View style={{ opacity: fadeAnim }} pointerEvents="none">
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={UI.chartTop} stopOpacity="0.38" />
                <Stop offset="1" stopColor={UI.chartTop} stopOpacity="0" />
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

            {areaPath ? <Path d={areaPath} fill="url(#areaFill)" /> : null}
            {points.length > 1 ? (
              <Path d={linePath} stroke={UI.accent} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ) : null}

            {tipPoint ? (
              <Line x1={tipPoint.x} x2={tipPoint.x} y1={PAD_TOP} y2={baselineY} stroke="rgba(255,255,255,0.18)" strokeWidth={1} strokeDasharray="3,3" />
            ) : null}

            {data.map((d, i) =>
              i % step === 0 ? (
                <SvgText
                  key={`x-${i}`}
                  x={points[i].x}
                  y={height - 6}
                  fontSize={10}
                  fill={UI.textMuted}
                  textAnchor={data.length > 1 && i === 0 ? 'start' : data.length > 1 && i === data.length - 1 ? 'end' : 'middle'}
                >
                  {d.label}
                </SvgText>
              ) : null
            )}

            <Circle cx={last.x} cy={last.y} r={7} fill={UI.accent} fillOpacity={0.2} />
            <Circle cx={last.x} cy={last.y} r={3.8} fill={UI.accent} stroke="#06140D" strokeWidth={1.5} />
            {tipPoint && shown !== data.length - 1 ? (
              <Circle cx={tipPoint.x} cy={tipPoint.y} r={4} fill={UI.accent} stroke="#06140D" strokeWidth={1.5} />
            ) : null}
          </Svg>
        </Animated.View>
      ) : null}

      {shown !== null && tipPoint ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.tooltip,
            {
              opacity: tipAnim,
              transform: [{ scale: tipAnim.interpolate({ inputRange: [0, 1], outputRange: [0.93, 1] }) }],
              left: Math.max(4, Math.min(width - 128, tipPoint.x - 62)),
              top: Math.max(0, tipPoint.y - 54),
            },
          ]}
        >
          <Text style={styles.tooltipValue}>{formatValue(data[shown].value)}</Text>
          <Text style={styles.tooltipDate}>{data[shown].tooltipLabel}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  tooltip: {
    position: 'absolute',
    width: 124,
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(12, 18, 15, 0.96)',
    borderWidth: 1,
    borderColor: UI.accentBorder,
    alignItems: 'center',
  },
  tooltipValue: {
    color: UI.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  tooltipDate: {
    color: UI.textSecondary,
    fontSize: 10.5,
    marginTop: 1,
  },
});
