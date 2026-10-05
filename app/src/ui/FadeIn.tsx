/**
 * FadeIn — entrance animation (fade + small rise) for list rows and cards.
 * Pass the row `index` to stagger (capped, so a long list doesn't make the last
 * rows wait seconds). Plays once on mount. Reduced-motion: renders instantly.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import { Motion, useReducedMotion } from './motion';

interface Props {
  index?: number;
  /** Extra delay in ms on top of the stagger. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export default function FadeIn({ index = 0, delay = 0, style, children }: Props) {
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      t.setValue(1);
      return;
    }
    const anim = Animated.timing(t, {
      toValue: 1,
      duration: Motion.enter.durationMs,
      delay: delay + Math.min(index, Motion.enter.maxStaggered) * Motion.enter.staggerMs,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [t, index, delay, reduced]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: t,
          transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [Motion.enter.distance, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
