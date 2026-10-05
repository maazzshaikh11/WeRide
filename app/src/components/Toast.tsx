/**
 * Toast — single toast item (spec §3.3.3, §5.7).
 * toastSlide animation: translateY -30 → 0, opacity 0 → 1, 300ms,
 * cubic-bezier(0.4,1.4,0.5,1) approximated with an overshooting spring.
 * Auto-dismiss after 2600ms.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { WeRideColors, WeRideRadius } from '../theme/theme';
import { type } from '../theme/typography';
import { ToastItem } from '../store/toastStore';

const AUTO_DISMISS_MS = 2600;

const COLORS: Record<ToastItem['variant'], { border: string; dot: string }> = {
  success: { border: '#22C55E55', dot: WeRideColors.green },
  error: { border: '#FF3B3B66', dot: WeRideColors.red },
  warn: { border: '#FBBF2455', dot: WeRideColors.gold },
};

export default function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const anim = useRef(new Animated.Value(0)).current;
  const c = COLORS[toast.variant];

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      speed: 20,
      bounciness: 8,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
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
      <Pressable
        style={styles.press}
        onPress={() => onDismiss(toast.id)}
        accessibilityLabel={`Dismiss notification: ${toast.message}`}
      >
        <View style={[styles.dot, { backgroundColor: c.dot }]} />
        <Text style={styles.text}>{toast.message}</Text>
      </Pressable>
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
