/**
 * Progressbar — stop progress bar (spec §3.4). Demo step-bar look: 5 px,
 * `line2` track, `ink` fill. Fill width animates over 500ms and is exposed to
 * screen readers.
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { useStyles } from '../theme/ThemeProvider';
import { useReducedMotion } from '../ui';

interface Props {
  completed: number;
  total: number;
}

export default function Progressbar({ completed, total }: Props) {
  const s = useStyles(({ colors }) => ({
    track: { height: 5, borderRadius: 3, backgroundColor: colors.line2, overflow: 'hidden' },
    fill: { height: 5, borderRadius: 3, backgroundColor: colors.ink },
  }));
  const reduced = useReducedMotion();
  const width = useRef(new Animated.Value(total > 0 ? Math.min(1, completed / total) : 0)).current;

  useEffect(() => {
    const target = total > 0 ? Math.min(1, completed / total) : 0;
    if (reduced) {
      width.setValue(target);
      return;
    }
    // Width is a layout property, so this one cannot use the native driver.
    const anim = Animated.timing(width, { toValue: target, duration: 500, useNativeDriver: false });
    anim.start();
    return () => anim.stop();
  }, [completed, total, width, reduced]);

  return (
    <View
      style={s.track}
      accessibilityRole="progressbar"
      accessibilityLabel="Stops reached"
      accessibilityValue={{ min: 0, max: total, now: Math.min(completed, total) }}
    >
      <Animated.View style={[s.fill, { width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
    </View>
  );
}
