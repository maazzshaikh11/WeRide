/**
 * Fab — shared FAB press behavior (spec §3.3.6, §5.1).
 * fabPress animation: scale 1 → 0.92, 150ms.
 */
import React, { useRef } from 'react';
import { Pressable, Animated, StyleSheet, PressableProps } from 'react-native';

interface Props extends PressableProps {
  size?: number;
  children: React.ReactNode;
}

export default function Fab({ size = 46, children, style, ...rest }: Props) {
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
          styles.shadow,
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
  shadow: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
});