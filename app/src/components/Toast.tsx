/**
 * Toast — single toast item (spec §3.3.3, §5.7), drawn as the demo's compact
 * road-sign Plate: info -> black, warn -> yellow, error -> red, success -> green.
 * Plate colours are fixed road-sign colours (same in every theme).
 * toastSlide animation: translateY -30 -> 0, opacity 0 -> 1, spring (native).
 * Tap anywhere on the toast (44pt+ target) to dismiss; auto-dismiss after 2600ms.
 *
 * Haptics: fired ONCE when a toast appears (keyed on the toast id, never on
 * re-render): success -> 'success', warn -> 'warning', error -> 'error'.
 * A caller that already gave stronger feedback for its own message (the SOS
 * confirmation) can mute that one with `muteToastHaptic(message)`.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import type { PlateTone } from '../theme/palettes';
import { ToastItem } from '../store/toastStore';
import { haptic, HapticKind, Plate, PressableScale } from '../ui';

const AUTO_DISMISS_MS = 2600;
const MUTE_TTL_MS = 3000;

/** Plate tone per toast kind (demo `toast({ c })`). */
export const TOAST_TONE: Record<ToastItem['variant'], PlateTone> = {
  info: 'black',
  warn: 'yellow',
  error: 'red',
  success: 'green',
};

const VARIANT_HAPTIC: Record<ToastItem['variant'], HapticKind> = {
  info: 'select',
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
        <Plate compact tone={TOAST_TONE[toast.variant]} title={toast.message} />
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: { maxWidth: '100%' },
  press: { minHeight: 44 },
});
