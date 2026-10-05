/**
 * PressableCard — a card that responds to touch like a hover on desktop:
 * it sinks slightly (scale), the surface warms with an ember tint, and the
 * border lights up in the accent. All on the native driver (opacity overlays,
 * no colour interpolation on the JS thread).
 *
 * Use for any tappable card: rides, history, alerts, stops, rows.
 * `active` marks the card as current/selected (permanent accent border).
 */
import React, { useCallback, useRef } from 'react';
import { Animated, GestureResponderEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { WeRideColors, WeRideRadius } from '../theme/theme';
import { Motion, useReducedMotion } from './motion';
import PressableScale, { PressableScaleProps } from './PressableScale';

export interface PressableCardProps extends Omit<PressableScaleProps, 'style' | 'scaleTo'> {
  style?: StyleProp<ViewStyle>;
  /** Corner radius; must match the card's visual radius for the overlays. */
  radius?: number;
  active?: boolean;
}

export default function PressableCard({
  style,
  radius = WeRideRadius.xxl,
  active,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: PressableCardProps) {
  const glow = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  const to = useCallback(
    (v: 0 | 1) =>
      Animated.timing(glow, {
        toValue: v,
        duration: v ? Motion.press.inMs : Motion.press.outMs,
        useNativeDriver: true,
      }).start(),
    [glow],
  );

  return (
    <PressableScale
      {...rest}
      scaleTo={Motion.scale.card}
      onPressIn={(e: GestureResponderEvent) => {
        to(1);
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        to(0);
        onPressOut?.(e);
      }}
      style={[
        styles.card,
        { borderRadius: radius },
        active && styles.active,
        style,
      ]}
    >
      {children}
      {/* Warm surface tint + accent border, fading in while pressed. */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { opacity: reduced ? 0 : glow }]}
      >
        <View style={[StyleSheet.absoluteFill, styles.tint, { borderRadius: radius }]} />
        <View style={[StyleSheet.absoluteFill, styles.ring, { borderRadius: radius }]} />
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    overflow: 'hidden',
  },
  active: { borderColor: WeRideColors.primary },
  tint: { backgroundColor: WeRideColors.primary, opacity: 0.07 },
  ring: { borderWidth: 1, borderColor: WeRideColors.primary },
});
