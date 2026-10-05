/**
 * StatBox — stat value/label (demo `.kv`: tabular value over an uppercase key),
 * on a recessed `card2` tile.
 * `display` true → large stat number; false → compact text value (e.g. next stop name).
 * When the value changes it dips and fades back in (opacity only, native driver),
 * so a live number updating reads as a change, not a flicker. Layout is untouched.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleProp, ViewStyle, Animated } from 'react-native';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from '../ui';

interface Props {
  value: string;
  label: string;
  display?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function StatBox({ value, label, display = true, style }: Props) {
  const { type } = useTheme();
  const s = useStyles(({ colors }) => ({
    box: { flex: 1, backgroundColor: colors.card2, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, gap: 6 },
  }));
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
    <View style={[s.box, style]}>
      <Animated.Text style={[display ? type.statValue : type.h3, { opacity: fade }]} numberOfLines={1}>
        {value}
      </Animated.Text>
      <Text style={type.statKey} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}
