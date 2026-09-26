/**
 * SosFab — SOS FAB with anti-accidental hold guard (spec §4.2).
 * Requires a 2-second press-and-hold; shows a progress ring during the hold.
 * On complete hold → opens the SOS confirmation modal (SosModal).
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Pressable, Easing } from 'react-native';
import { WeRideColors, WeRideFonts } from '../theme/theme';

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

  // Progress ring drawn as a border arc approximation: the outer ring
  // brightens as the hold completes.
  const ringOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });

  return (
    <Pressable
      onPressIn={startHold}
      onPressOut={cancelHold}
      disabled={disabled}
      accessibilityLabel="Hold for 2 seconds to send SOS"
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

const styles = StyleSheet.create({
  wrap: { width: 46, height: 46, position: 'relative' },
  ring: {
    ...({} as object),
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: WeRideColors.white,
  },
  fab: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: WeRideColors.red,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  fabHolding: { transform: [{ scale: 0.92 }] },
  fabText: { fontFamily: WeRideFonts.mono, fontSize: 10, fontWeight: '700', color: WeRideColors.white },
});