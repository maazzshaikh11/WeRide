/**
 * Fab — shared FAB press behavior (spec §3.3.6, §5.1).
 * 48 px circle on the dark2 surface with a hairline border; `active` swaps the
 * border to the accent. fabPress animation: scale 1 → 0.92, 150ms.
 */
import React, { useRef } from 'react';
import { Pressable, Animated, StyleSheet, PressableProps } from 'react-native';
import { WeRideColors } from '../theme/theme';

export const FAB_SIZE = 48;

interface Props extends PressableProps {
  size?: number;
  /** Highlights the border with the accent (e.g. follow mode on). */
  active?: boolean;
  children: React.ReactNode;
}

export default function Fab({ size = FAB_SIZE, active = false, children, style, ...rest }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.timing(scale, { toValue: 0.92, duration: 150, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    Animated.timing(scale, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  };

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut} {...rest}>
      <Animated.View
        style={[
          { width: size, height: size, borderRadius: size / 2 },
          styles.surface,
          active && styles.surfaceActive,
          { transform: [{ scale }] },
          style as object,
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  surface: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: WeRideColors.dark2,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  surfaceActive: { borderColor: WeRideColors.primary },
});
