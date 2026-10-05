/**
 * Progressbar — stop progress bar (spec §3.4).
 * Fill width animates over 500ms. Exposes progress to screen readers.
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { WeRideColors, WeRideRadius } from '../theme/theme';

interface Props {
  completed: number;
  total: number;
}

export default function Progressbar({ completed, total }: Props) {
  const width = useRef(new Animated.Value(total > 0 ? Math.min(1, completed / total) : 0)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: total > 0 ? Math.min(1, completed / total) : 0,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [completed, total, width]);

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
