/**
 * Progressbar — stop progress bar (spec §3.4).
 * progressFill animation: width change, 500ms ease.
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { WeRideColors } from '../theme/theme';

interface Props {
  completed: number;
  total: number;
}

export default function Progressbar({ completed, total }: Props) {
  const width = useRef(new Animated.Value(total > 0 ? completed / total : 0)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: total > 0 ? Math.min(1, completed / total) : 0,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [completed, total, width]);

  return (
    <View style={styles.track}>
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
    height: 5,
    borderRadius: 99,
    backgroundColor: WeRideColors.dark3,
    overflow: 'hidden',
    marginVertical: 12,
  },
  fill: { height: 5, borderRadius: 99, backgroundColor: WeRideColors.primary },
});