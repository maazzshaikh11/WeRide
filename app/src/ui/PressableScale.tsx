/**
 * PressableScale — the base of every tappable thing in the app.
 * Press-in: quick scale-down (+ slight dim). Release: eases back with a small
 * spring. Optional haptic on press. Disabled: dimmed, no feedback.
 *
 * The Pressable itself is animated, so layout styles (flex, margins, width…)
 * passed in `style` behave exactly as they would on a plain Pressable.
 * Reduced-motion: no scale, only the dim.
 */
import React, { useCallback, useRef } from 'react';
import { Animated, GestureResponderEvent, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { haptic, HapticKind } from './haptics';
import { Motion, useReducedMotion } from './motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed (default Motion.scale.control). */
  scaleTo?: number;
  /** Haptic on press; `false` for none. Default 'tap'. */
  haptic?: HapticKind | false;
  children?: React.ReactNode;
}

export default function PressableScale({
  style,
  scaleTo = Motion.scale.control,
  haptic: hapticKind = 'tap',
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: PressableScaleProps) {
  const pressed = useRef(new Animated.Value(0)).current; // 0 rest → 1 pressed
  const reduced = useReducedMotion();

  const animateTo = useCallback(
    (to: 0 | 1) => {
      if (to === 1) {
        Animated.timing(pressed, { toValue: 1, duration: Motion.press.inMs, useNativeDriver: true }).start();
      } else {
        Animated.spring(pressed, { toValue: 0, ...Motion.spring, useNativeDriver: true }).start();
      }
    },
    [pressed],
  );

  const handleIn = (e: GestureResponderEvent) => {
    if (!disabled) animateTo(1);
    onPressIn?.(e);
  };
  const handleOut = (e: GestureResponderEvent) => {
    animateTo(0);
    onPressOut?.(e);
  };
  const handlePress = (e: GestureResponderEvent) => {
    if (hapticKind) haptic(hapticKind);
    onPress?.(e);
  };

  const scale = reduced
    ? 1
    : pressed.interpolate({ inputRange: [0, 1], outputRange: [1, scaleTo] });
  const opacity = disabled
    ? 0.45
    : pressed.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] });

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={handleIn}
      onPressOut={handleOut}
      onPress={handlePress}
      accessibilityState={{ ...(rest.accessibilityState ?? {}), disabled: Boolean(disabled) }}
      style={[style, { opacity, transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}
