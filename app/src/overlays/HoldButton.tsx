/**
 * HoldButton — a full-width key you must press and hold for `ms` (demo `bindHold` + `.hf` fill): a translucent
 * fill grows left to right while held; letting go early resets it and calls `onEarlyRelease`.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, Text, TextProps, TextStyle, ViewStyle } from 'react-native';
import { haptic, PressableScale } from '../ui';

export default function HoldButton({ label, ms, onDone, onEarlyRelease, style, textStyle, textProps, fillColor, accessibilityLabel, accessibilityHint, testID }: {
  label: string;
  ms: number;
  onDone: () => void;
  onEarlyRelease?: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  /** Extra props for the label (e.g. `maxFontSizeMultiplier`). */
  textProps?: TextProps;
  fillColor: string;
  accessibilityLabel: string;
  accessibilityHint?: string;
  testID?: string;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holding = useRef(false);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const reset = () => {
    progress.stopAnimation();
    Animated.timing(progress, { toValue: 0, duration: 120, useNativeDriver: false }).start();
  };

  useEffect(
    () => () => {
      clear();
      progress.stopAnimation();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const start = () => {
    if (holding.current) return;
    holding.current = true;
    progress.stopAnimation();
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: ms, useNativeDriver: false, easing: (t: number) => t }).start();
    timer.current = setTimeout(() => {
      timer.current = null;
      holding.current = false;
      haptic('heavy');
      onDone();
    }, ms);
  };
  const release = () => {
    if (!holding.current) return;
    holding.current = false;
    clear();
    reset();
    onEarlyRelease?.();
  };

  return (
    <PressableScale
      onPressIn={start}
      onPressOut={release}
      haptic={false}
      scaleTo={0.98}
      style={[{ overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
    >
      <Animated.View
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: fillColor, width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }}
      />
      <Text style={textStyle} {...textProps}>{label}</Text>
    </PressableScale>
  );
}
