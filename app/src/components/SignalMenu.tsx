/**
 * SignalMenu — quick signal options menu (spec §3.3.7).
 * 4 options: Wait for me, Pull over, All good, Need fuel.
 * On tap: emits 'signal:send' via Socket.io, shows toast, speech bubble on sender marker.
 * signalMenuOpen animation: opacity + translateY + scale, 180ms.
 */
import React, { useEffect, useRef } from 'react';
import { Text, StyleSheet, Animated, Pressable } from 'react-native';
import { WeRideColors, WeRideRadius } from '../theme/theme';
import { type } from '../theme/typography';
import { getLocationSocket } from '../services/socketService';
import { useToastStore } from '../store/toastStore';

export const SIGNAL_OPTIONS = [
  { emoji: '⏳', label: 'Wait for me' },
  { emoji: '🛑', label: 'Pull over' },
  { emoji: '✅', label: 'All good' },
  { emoji: '⛽', label: 'Need fuel' },
] as const;

interface Props {
  visible: boolean;
  groupId: string;
  riderId: string;
  onSend: (label: string) => void;
  /** Distance from the screen's right / bottom edge (sits beside the FAB column). */
  right?: number;
  bottom?: number;
}

export default function SignalMenu({ visible, groupId, riderId, onSend, right = 76, bottom = 72 }: Props) {
  const anim = useRef(new Animated.Value(0)).current;
  const push = useToastStore((s) => s.push);

  useEffect(() => {
    const animation = Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    });
    animation.start();
    // Stop on unmount / change so no timer outlives the component.
    return () => animation.stop();
  }, [visible, anim]);

  if (!visible) return null;

  const send = (label: string) => {
    const socket = getLocationSocket();
    // Never claim a signal went out when it could not: nothing is queued offline.
    if (!socket.connected) {
      push('Offline — signal not sent', 'warn');
      return;
    }
    socket.emit('signal:send', { group_id: groupId, rider_id: riderId, label });
    push(`Signal sent: ${label}`);
    onSend(label);
  };

  return (
    <Animated.View
      style={[
        styles.menu,
        {
          right,
          bottom,
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
            { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
          ],
        },
      ]}
    >
      {SIGNAL_OPTIONS.map((opt) => (
        <Pressable
          key={opt.label}
          style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
          onPress={() => send(opt.label)}
          accessibilityLabel={`Send signal: ${opt.label}`}
          accessibilityRole="button"
        >
          <Text style={styles.optionEmoji}>{opt.emoji}</Text>
          <Text style={styles.optionLabel}>{opt.label}</Text>
        </Pressable>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    backgroundColor: WeRideColors.dark2,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: WeRideRadius.xxl,
    padding: 4,
    minWidth: 184,
    zIndex: 40,
  },
  option: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    borderRadius: WeRideRadius.xl,
  },
  optionPressed: { backgroundColor: WeRideColors.primaryDim },
  optionEmoji: { fontSize: 18, lineHeight: 24 },
  optionLabel: { ...type.bodyStrong },
});
