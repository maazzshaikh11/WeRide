/**
 * SosFab — SOS FAB with anti-accidental hold guard (spec §4.2).
 * Requires a 2-second press-and-hold; shows a progress ring during the hold.
 * On complete hold → opens the SOS confirmation modal (SosModal).
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { WeRideColors } from '../theme/theme';
import { type } from '../theme/typography';

const HOLD_MS = 2000;

interface Props {
  onHoldComplete: () => void;
  disabled?: boolean;
}

export default function SosFab({ onHoldComplete, disabled }: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const [holding, setHolding] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHold = () => {
    setHolding(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    Animated.timing(progress, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
      easing: (t: number) => t,
    }).start();
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const startHold = () => {
    if (disabled) return;
    setHolding(true);
    Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_MS,
      useNativeDriver: false,
      easing: (t: number) => t,
    }).start();
    timerRef.current = setTimeout(() => {
      setHolding(false);
      onHoldComplete();
    }, HOLD_MS);
  };

  // Hold progress: a ring just outside the button that brightens as the hold
  // completes (it sits outside the 48 px button so the button never hides it).
  const ringOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Pressable
      onPressIn={startHold}
      onPressOut={cancelHold}
      disabled={disabled}
      accessibilityLabel="Hold for 2 seconds to send SOS"
      accessibilityHint="Press and hold to open the SOS confirmation"
      accessibilityRole="button"
    >
      <View style={styles.wrap}>
        <Animated.View
          style={[styles.ring, { opacity: ringOpacity }]}
          pointerEvents="none"
        />
        <View style={[styles.fab, holding && styles.fabHolding]}>
          <Text style={styles.fabText}>SOS</Text>
        </View>
      </View>
    </Pressable>
  );
}

const SIZE = 48;
const RING_GAP = 4;

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, position: 'relative' },
  ring: {
    position: 'absolute',
    top: -RING_GAP,
    left: -RING_GAP,
    width: SIZE + RING_GAP * 2,
    height: SIZE + RING_GAP * 2,
    borderRadius: (SIZE + RING_GAP * 2) / 2,
    borderWidth: 3,
    borderColor: WeRideColors.white,
  },
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
  fabHolding: { transform: [{ scale: 0.92 }] },
  fabText: { ...type.labelStrong, letterSpacing: 0.5, color: WeRideColors.white },
});
