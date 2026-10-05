/**
 * StatBox — reusable stat value/label box (spec §3.3.8, §5.3).
 * `display` true → large stat number; false → compact text value (e.g. next stop name).
 * When the value changes it dips and fades back in (opacity only, native driver),
 * so a live number updating reads as a change, not a flicker. Layout is untouched.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle, Animated } from 'react-native';
import { WeRideColors, WeRideRadius, WeRideSpacing } from '../theme/theme';
import { type } from '../theme/typography';
import { useReducedMotion } from '../ui';

interface Props {
  value: string;
  label: string;
  display?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function StatBox({ value, label, display = true, style }: Props) {
  const reduced = useReducedMotion();
  const fade = useRef(new Animated.Value(1)).current;
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    if (reduced) return;
    fade.setValue(0.3);
    const anim = Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [value, reduced, fade]);

  return (
    <View style={[styles.box, style]}>
      <Animated.Text
        style={[display ? type.statSm : [type.bodyStrong, styles.compactValue], { opacity: fade }]}
        numberOfLines={1}
      >
        {value}
      </Animated.Text>
      <Text style={type.caption} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    backgroundColor: WeRideColors.dark3,
    borderRadius: WeRideRadius.lg,
    paddingHorizontal: WeRideSpacing.md,
    paddingVertical: WeRideSpacing.sm,
  },
  // statSm is 24pt line-height; keep the compact value on the same baseline rhythm.
  compactValue: { color: WeRideColors.primary, lineHeight: 24 },
});
