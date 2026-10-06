/**
 * ToastContainer — global toast stack (spec §3.3.3, §5.7).
 * Rendered once on MapScreen; reads useToastStore.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useToastStore } from '../store/toastStore';
import Toast from './Toast';

interface Props {
  /** Offset from the top of the screen; callers pass the bottom edge of the header (+ banner). */
  top?: number;
}

export default function ToastContainer({ top = 14 }: Props) {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={[styles.container, { marginTop: top }]} testID="toast-container">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 60,
    gap: 8,
    alignItems: 'center',
  },
});