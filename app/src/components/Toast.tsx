/**
 * Toast — single toast item (spec §3.3.3, §5.7).
 * toastSlide animation: translateY -30 → 0, opacity 0 → 1, 300ms,
 * cubic-bezier(0.4,1.4,0.5,1) approximated with an overshooting spring.
 * Auto-dismiss after 2600ms.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { WeRideColors, WeRideFonts } from '../theme/theme';
import { ToastItem } from '../store/toastStore';

const AUTO_DISMISS_MS = 2600;

const ICONS: Record<ToastItem['variant'], string> = {
  success: '✅',
  error: '🆘',
  warn: '📡',
};

const COLORS: Record<ToastItem['variant'], { border: string; text: string }> = {
  success: { border: '#22C55E55', text: '#b9f0ce' },
  error: { border: '#FF3B3B55', text: '#ffb4b4' },
  warn: { border: '#FBBF2455', text: '#fde68a' },
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
      <Pressable onPress={() => onDismiss(toast.id)} accessibilityLabel={`Dismiss notification: ${toast.message}`}>
        <Text style={styles.icon}>{ICONS[toast.variant]}</Text>
      </Pressable>
      <Text style={[styles.text, { color: c.text }]}>{toast.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#161616f5',
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  icon: { fontSize: 12 },
  text: { flex: 1, fontFamily: WeRideFonts.body, fontSize: 11.5, fontWeight: '500' },
});