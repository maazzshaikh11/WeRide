/**
 * Skeleton — pulsing placeholder block for loading states (so content fades in
 * where the placeholder was instead of the layout jumping). Reduced-motion:
 * static. Defensive about partial Animated mocks like LivePill is.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import { WeRideColors, WeRideRadius } from '../theme/theme';
import { useReducedMotion } from './motion';

interface Props {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export default function Skeleton({ width = '100%', height = 16, radius = WeRideRadius.md, style }: Props) {
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    if (reduced || typeof Animated.loop !== 'function' || typeof Animated.sequence !== 'function') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduced]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius, backgroundColor: WeRideColors.border, opacity: pulse }, style]}
    />
  );
}
