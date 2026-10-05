/**
 * LivePill — connection status pill (spec §3.3.1, §5.4).
 * Variants: red (LIVE), green (custom text), gold (SYNCING), grey (OFFLINE).
 * Pulsing dot per livePulse animation (1200ms loop).
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { WeRideColors, WeRideRadius } from '../theme/theme';
import { type } from '../theme/typography';

export type LivePillVariant = 'live' | 'green' | 'gold' | 'grey';

interface Props {
  variant: LivePillVariant;
  label?: string;
}

const VARIANT_STYLES: Record<LivePillVariant, { bg: string; border: string; text: string; dot: string }> = {
  live:   { bg: WeRideColors.redDim,   border: '#FF3B3B55', text: WeRideColors.red,   dot: WeRideColors.red },
  green:  { bg: WeRideColors.greenDim, border: '#22C55E44', text: WeRideColors.green, dot: WeRideColors.green },
  gold:   { bg: '#FBBF2444',           border: '#FBBF2455', text: '#fde68a',          dot: WeRideColors.gold },
  grey:   { bg: '#33333355',           border: '#33333355', text: WeRideColors.textSub, dot: WeRideColors.textSub },
};

export default function LivePill({ variant, label }: Props) {
  const v = VARIANT_STYLES[variant];
  const dotOpacity = useRef(new Animated.Value(1)).current;

  // livePulse animation — dot opacity 1 → 0.3 → 1, 1200ms infinite loop.
  // Fully defensive against partial Animated mocks in test environments.
  useEffect(() => {
    const timing = Animated.timing;
    if (typeof timing !== 'function' || typeof Animated.sequence !== 'function') {
      return;
    }
    let stopped = false;
    const sequence = Animated.sequence([
      timing(dotOpacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      timing(dotOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]);
    const run = () => {
      if (stopped) return;
      try {
        sequence.start((result) => {
          if (!stopped && result?.finished !== false) run();
        });
      } catch {
        // Animated mock incomplete — leave dot static
      }
    };
    run();
    return () => {
      stopped = true;
      try {
        sequence.stop?.();
      } catch {
        // noop
      }
    };
  }, [dotOpacity]);

  const text = label ?? (variant === 'live' ? 'LIVE' : variant === 'gold' ? 'SYNCING' : 'OFFLINE');

  return (
    <View style={[styles.pill, { backgroundColor: v.bg, borderColor: v.border }]}>
      <Animated.View style={[styles.dot, { backgroundColor: v.dot, opacity: dotOpacity }]} />
      <Text style={[styles.label, { color: v.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: WeRideRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { ...type.labelStrong, letterSpacing: 0.5 },
});
