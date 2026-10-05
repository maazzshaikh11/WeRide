/**
 * NetworkBanner — connection status banner (spec §3.3.5).
 * States: lost (gold) / recovered (green). Auto-dismiss recovered after 2.5s.
 * Slides down + fades in on a spring (native driver); a state change replays
 * the entrance so "recovered" reads as a new event. The dismiss timer is keyed
 * on the state only, so a parent re-render (new onDismiss identity) never
 * restarts it or replays the animation.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { WeRideColors, WeRideRadius } from '../theme/theme';
import { type } from '../theme/typography';
import { Motion, PressableScale, useReducedMotion } from '../ui';

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

  return (
    <Animated.View
      style={[
        styles.banner,
        { borderColor: isLost ? '#FBBF2466' : '#22C55E66' },
        {
          opacity: slide.interpolate({ inputRange: [0, 0.6], outputRange: [0, 1], extrapolate: 'clamp' }),
          transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }],
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: isLost ? WeRideColors.gold : WeRideColors.green }]} />
      <Text style={styles.text}>
        {isLost
          ? `${riderName} lost connection. Showing last known location.`
          : `${riderName} is active again. Position resynced.`}
      </Text>
      {!isLost && (
        <PressableScale
          style={styles.close}
          onPress={onDismiss}
          haptic="tap"
          hitSlop={8}
          accessibilityLabel="Dismiss notification"
          accessibilityRole="button"
        >
          <Text style={styles.closeText}>✕</Text>
        </PressableScale>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#111111F5',
    borderWidth: 1,
    borderRadius: WeRideRadius.xl,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    marginHorizontal: 16,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { ...type.caption, color: WeRideColors.text, flex: 1 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { ...type.body, color: WeRideColors.textSub },
});
