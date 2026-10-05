/**
 * Progressbar — stop progress bar (spec §3.4).
 * Fill width animates over 500ms. Exposes progress to screen readers.
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { WeRideColors, WeRideRadius } from '../theme/theme';
import { useReducedMotion } from '../ui';

interface Props {
  completed: number;
  total: number;
}

export default function Progressbar({ completed, total }: Props) {
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
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityLabel="Stops reached"
      accessibilityValue={{ min: 0, max: total, now: Math.min(completed, total) }}
    >
      <Animated.View
        style={[
          styles.fill,
          { width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: WeRideRadius.pill,
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    overflow: 'hidden',
  },
  fill: { height: 4, borderRadius: WeRideRadius.pill, backgroundColor: WeRideColors.primary },
});
