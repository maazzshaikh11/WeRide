/**
 * Toast — single toast item (spec §3.3.3, §5.7).
 * toastSlide animation: translateY -30 -> 0, opacity 0 -> 1, spring (native).
 * Tap anywhere on the toast (44pt+ target) to dismiss; auto-dismiss after 2600ms.
 *
 * Haptics: fired ONCE when a toast appears (keyed on the toast id, never on
 * re-render): success -> 'success', warn -> 'warning', error -> 'error'.
 * A caller that already gave stronger feedback for its own message (the SOS
 * confirmation) can mute that one with `muteToastHaptic(message)`.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { WeRideColors, WeRideRadius } from '../theme/theme';
import { type } from '../theme/typography';
import { ToastItem } from '../store/toastStore';
import { haptic, HapticKind, PressableScale } from '../ui';

const AUTO_DISMISS_MS = 2600;
const MUTE_TTL_MS = 3000;

const COLORS: Record<ToastItem['variant'], { border: string; dot: string }> = {
  success: { border: '#22C55E55', dot: WeRideColors.green },
  error: { border: '#FF3B3B66', dot: WeRideColors.red },
  warn: { border: '#FBBF2455', dot: WeRideColors.gold },
};

const VARIANT_HAPTIC: Record<ToastItem['variant'], HapticKind> = {
  success: 'success',
  warn: 'warning',
  error: 'error',
};

const muted = new Map<string, number>();

/** Skip the variant haptic for the next toast with exactly this message. */
export function muteToastHaptic(message: string): void {
  muted.set(message, Date.now() + MUTE_TTL_MS);
}

function consumeMute(message: string): boolean {
  const until = muted.get(message);
  if (until === undefined) return false;
  muted.delete(message);
  return until >= Date.now();
}

export default function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const anim = useRef(new Animated.Value(0)).current;
  const c = COLORS[toast.variant];
  const hapticFor = useRef<number | null>(null);

  // Once per toast: the id guard keeps re-renders (and effect re-runs) silent.
  useEffect(() => {
    if (hapticFor.current === toast.id) return;
    hapticFor.current = toast.id;
    if (!consumeMute(toast.message)) haptic(VARIANT_HAPTIC[toast.variant]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id]);

  useEffect(() => {
    const entry = Animated.spring(anim, {
      toValue: 1,
      speed: 20,
      bounciness: 8,
      useNativeDriver: true,
    });
    entry.start();
    const timer = setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
    return () => {
      entry.stop();
      clearTimeout(timer);
    };
  }, [anim, toast.id, onDismiss]);

  return (
    <Animated.View
      style={[
        styles.toast,
        { borderColor: c.border },
        {
          opacity: anim,
          transform: [{
            translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }),
          }],
        },
      ]}
    >
      <PressableScale
        style={styles.press}
        scaleTo={0.98}
        haptic={false}
        onPress={() => onDismiss(toast.id)}
        accessibilityRole="button"
        accessibilityLabel={`Dismiss notification: ${toast.message}`}
      >
        <View style={[styles.dot, { backgroundColor: c.dot }]} />
        <Text style={styles.text}>{toast.message}</Text>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    backgroundColor: '#111111F5',
    borderWidth: 1,
    borderRadius: WeRideRadius.xl,
  },
  press: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { ...type.body, flex: 1 },
});
