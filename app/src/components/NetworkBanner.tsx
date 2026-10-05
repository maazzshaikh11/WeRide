/**
 * NetworkBanner — connection status banner (spec §3.3.5).
 * States: lost (yellow road-sign plate) / recovered (green plate). Auto-dismiss recovered after 2.5s.
 * Slides down + fades in on a spring (native driver); a state change replays
 * the entrance so "recovered" reads as a new event. The dismiss timer is keyed
 * on the state only, so a parent re-render (new onDismiss identity) never
 * restarts it or replays the animation.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Plates } from '../theme/palettes';
import { Icon, Motion, Plate, PressableScale, useReducedMotion } from '../ui';

interface Props {
  state: 'lost' | 'recovered';
  riderName: string;
  onDismiss?: () => void;
}

export default function NetworkBanner({ state, riderName, onDismiss }: Props) {
  const slide = useRef(new Animated.Value(0)).current;
  const isLost = state === 'lost';
  const reduced = useReducedMotion();
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    slide.setValue(0);
    const anim = reduced
      ? Animated.timing(slide, { toValue: 1, duration: 150, useNativeDriver: true })
      : Animated.spring(slide, { toValue: 1, ...Motion.spring, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [slide, isLost, reduced]);

  useEffect(() => {
    if (isLost) return;
    const t = setTimeout(() => onDismissRef.current?.(), 2500);
    return () => clearTimeout(t);
  }, [isLost]);

  const tone = isLost ? 'yellow' : 'green';
  const fg = Plates[tone].fg;

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          opacity: slide.interpolate({ inputRange: [0, 0.6], outputRange: [0, 1], extrapolate: 'clamp' }),
          transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }],
        },
      ]}
    >
      <Plate
        compact
        tone={tone}
        icon={isLost ? 'wifioff' : 'check'}
        title={isLost ? `${riderName} lost connection` : `${riderName} is active again`}
        subtitle={isLost ? 'Showing last known location.' : 'Position resynced.'}
        right={
          isLost ? undefined : (
            <PressableScale
              style={styles.close}
              onPress={onDismiss}
              haptic="tap"
              hitSlop={8}
              accessibilityLabel="Dismiss notification"
              accessibilityRole="button"
            >
              <Icon name="close" size={20} color={fg} />
            </PressableScale>
          )
        }
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: { marginHorizontal: 16 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
});
