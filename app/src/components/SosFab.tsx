/**
 * SosFab — SOS FAB with anti-accidental hold guard (spec §4.2).
 * Requires a 2-second press-and-hold; a progress ring just outside the button
 * fills clockwise during the hold. On a complete hold -> opens the SOS
 * confirmation modal (SosModal).
 *
 * Feel:
 *  - the button visibly depresses while held (PressableScale, scaleTo 0.88) and
 *    springs back on release;
 *  - `haptic('warning')` once the hold registers (REGISTER_MS — a brush or tap
 *    never buzzes), `haptic('heavy')` when it completes;
 *  - releasing early cancels everything: no completion, no further haptic.
 *
 * The ring is SEGMENTS short bars laid out around the circle. Each bar's
 * opacity is interpolated from one native-driven progress value (0 -> 1 over
 * HOLD_MS), so the ring fills smoothly on the UI thread without SVG.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { WeRideColors } from '../theme/theme';
import { type } from '../theme/typography';
import { haptic, PressableScale } from '../ui';

const HOLD_MS = 2000;
/** The hold must persist this long before it "registers" (warning haptic). */
const REGISTER_MS = 200;
const SEGMENTS = 24;
const SEGMENT_INDEXES = Array.from({ length: SEGMENTS }, (_, i) => i);

interface Props {
  onHoldComplete: () => void;
  disabled?: boolean;
}

export default function SosFab({ onHoldComplete, disabled }: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const registerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdingRef = useRef(false);

  const clearTimers = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (registerTimer.current) clearTimeout(registerTimer.current);
    holdTimer.current = null;
    registerTimer.current = null;
  };

  const resetRing = (durationMs: number) => {
    progress.stopAnimation();
    Animated.timing(progress, {
      toValue: 0,
      duration: durationMs,
      useNativeDriver: true,
    }).start();
  };

  const cancelHold = () => {
    holdingRef.current = false;
    clearTimers();
    resetRing(150);
  };

  useEffect(() => {
    return () => {
      clearTimers();
      progress.stopAnimation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startHold = () => {
    if (disabled || holdingRef.current) return;
    holdingRef.current = true;
    progress.stopAnimation();
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_MS,
      useNativeDriver: true,
      easing: (t: number) => t,
    }).start();
    registerTimer.current = setTimeout(() => {
      registerTimer.current = null;
      haptic('warning');
    }, REGISTER_MS);
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      holdingRef.current = false;
      if (registerTimer.current) {
        clearTimeout(registerTimer.current);
        registerTimer.current = null;
      }
      haptic('heavy');
      // Flash the full ring briefly, then clear it (the release may never be
      // delivered once the modal takes over the touch).
      resetRing(350);
      onHoldComplete();
    }, HOLD_MS);
  };

  // Track appears as soon as the hold starts; bars light up one after another.
  const trackOpacity = progress.interpolate({ inputRange: [0, 0.01], outputRange: [0, 0.18], extrapolate: 'clamp' });

  return (
    <View style={styles.wrap}>
      <View style={styles.ring} pointerEvents="none">
        {SEGMENT_INDEXES.map((i) => {
          const from = i / SEGMENTS;
          const to = (i + 1) / SEGMENTS;
          const fill = progress.interpolate({
            inputRange: [from, to],
            outputRange: [0, 1],
            extrapolate: 'clamp',
          });
          return (
            <View key={i} style={[styles.segmentBox, { transform: [{ rotate: `${(360 / SEGMENTS) * i}deg` }] }]}>
              <Animated.View style={[styles.bar, styles.track, { opacity: trackOpacity }]} />
              <Animated.View style={[styles.bar, styles.fill, { opacity: fill }]} />
            </View>
          );
        })}
      </View>
      <PressableScale
        onPressIn={startHold}
        onPressOut={cancelHold}
        disabled={disabled}
        haptic={false}
        scaleTo={0.88}
        style={styles.fab}
        accessibilityLabel="Hold for 2 seconds to send SOS"
        accessibilityHint="Press and hold to open the SOS confirmation"
        accessibilityRole="button"
      >
        <Text style={styles.fabText}>SOS</Text>
      </PressableScale>
    </View>
  );
}

const SIZE = 48;
const RING_GAP = 4;
const RING_SIZE = SIZE + RING_GAP * 2;

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE },
  // The ring sits just outside the 48 px button so the button never hides it.
  ring: {
    position: 'absolute',
    top: -RING_GAP,
    left: -RING_GAP,
    width: RING_SIZE,
    height: RING_SIZE,
  },
  segmentBox: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
  },
  bar: {
    position: 'absolute',
    top: 0,
    width: 6,
    height: 3,
    borderRadius: 1,
  },
  track: { backgroundColor: WeRideColors.white },
  fill: { backgroundColor: WeRideColors.white },
  fab: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: WeRideColors.red,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  fabText: { ...type.labelStrong, letterSpacing: 0.5, color: WeRideColors.white },
});
