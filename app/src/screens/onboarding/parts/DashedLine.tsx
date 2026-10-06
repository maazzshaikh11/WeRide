/**
 * DashedLine — straight dashed road paint. Vertical (`Promise` rail) or horizontal (`Splash` centre-line, which can
 * scroll: `scrollPx` > 0 translates it left by that many px per loop, endlessly, on the native driver).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { useReducedMotion } from '../../../ui';

export function VerticalDashes({ color, width = 3, dash = 12, gap = 10, style }: {
  color: string; width?: number; dash?: number; gap?: number; style?: StyleProp<ViewStyle>;
}) {
  const [h, setH] = useState(0);
  return (
    <View style={[{ width }, style]} onLayout={(e) => setH(e.nativeEvent.layout.height)} pointerEvents="none" testID="vdashes">
      {h > 0 ? (
        <Svg width={width} height={h}>
          <Line x1={width / 2} y1={0} x2={width / 2} y2={h} stroke={color} strokeWidth={width} strokeDasharray={`${dash} ${gap}`} />
        </Svg>
      ) : null}
    </View>
  );
}

/** Endlessly scrolling horizontal dashes (demo splash: 22 px dashes every 42 px, 1 s per period). */
export function MovingDashes({ color, height = 4, dash = 22, period = 42, durationMs = 1000, width }: {
  color: string; height?: number; dash?: number; period?: number; durationMs?: number; width: number;
}) {
  const reduced = useReducedMotion();
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) {
      x.setValue(0);
      return;
    }
    const loop = Animated.loop(Animated.timing(x, { toValue: -period, duration: durationMs, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [reduced, x, period, durationMs]);
  const total = width + period * 2;
  return (
    <View style={{ height, width, overflow: 'hidden' }} pointerEvents="none" testID="moving-dashes">
      <Animated.View style={{ width: total, height, transform: [{ translateX: x }] }}>
        <Svg width={total} height={height}>
          <Line x1={0} y1={height / 2} x2={total} y2={height / 2} stroke={color} strokeWidth={height} strokeDasharray={`${dash} ${period - dash}`} />
        </Svg>
      </Animated.View>
    </View>
  );
}
