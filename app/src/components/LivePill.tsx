/**
 * LivePill — connection status pill (spec §3.3.1, §5.4).
 * The demo `.pill`: 26 high, 13 radius, 11.5 ExtraBold caps.
 * Variants: live (red pill, LIVE), green (ok tint), gold (accent pill, SYNCING),
 * grey (default pill, OFFLINE). Pulsing dot per livePulse animation (1200ms loop).
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { withAlpha } from '../theme/palettes';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from '../ui';

export type LivePillVariant = 'live' | 'green' | 'gold' | 'grey';

interface Props {
  variant: LivePillVariant;
  label?: string;
}

export default function LivePill({ variant, label }: Props) {
  const { colors, type } = useTheme();
  const styles = useStyles(() => ({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      height: 26,
      paddingHorizontal: 10,
      borderRadius: 13,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
  }));
  const v = ({
    live: { bg: colors.bad, text: '#FFFFFF', border: 'transparent' },
    green: { bg: withAlpha(colors.ok, 0.16), text: colors.ok, border: 'transparent' },
    gold: { bg: colors.pri, text: colors.priInk, border: 'transparent' },
    grey: { bg: colors.card2, text: colors.ink2, border: colors.line },
  } as Record<LivePillVariant, { bg: string; text: string; border: string }>)[variant];
  const dotOpacity = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();

  // livePulse animation — dot opacity 1 → 0.3 → 1, 1200ms infinite loop.
  // Fully defensive against partial Animated mocks in test environments.
  useEffect(() => {
    // Decorative pulse: a static dot under reduced motion.
    if (reduced) {
      dotOpacity.setValue(1);
      return;
    }
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
  }, [dotOpacity, reduced]);

  const text = label ?? (variant === 'live' ? 'LIVE' : variant === 'gold' ? 'SYNCING' : 'OFFLINE');

  return (
    <View style={[styles.pill, { backgroundColor: v.bg, borderColor: v.border, borderWidth: v.border === 'transparent' ? 0 : 1.5 }]}>
      <Animated.View style={[styles.dot, { backgroundColor: v.text, opacity: dotOpacity }]} />
      <Text style={[type.pill, { color: v.text }]}>{text.toUpperCase()}</Text>
    </View>
  );
}
