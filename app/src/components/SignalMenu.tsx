/**
 * SignalMenu — quick signal options menu (spec §3.3.7).
 * 4 options: Wait for me, Pull over, All good, Need fuel.
 * On tap: emits 'signal:send' via Socket.io, shows toast, speech bubble on sender marker.
 * signalMenuOpen animation: opacity + translateY + scale, 180ms.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { WeRideColors, WeRideFonts } from '../theme/theme';
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
}

export default function SignalMenu({ visible, groupId, riderId, onSend }: Props) {
  const anim = useRef(new Animated.Value(0)).current;
  const push = useToastStore((s) => s.push);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [visible, anim]);

  if (!visible) return null;

  const send = (label: string) => {
    try {
      const socket = getLocationSocket();
      socket.emit('signal:send', { group_id: groupId, rider_id: riderId, label });
    } catch {
      // offline — signal still shown locally
    }
    push(`📡 Signal sent: ${label}`);
    onSend(label);
  };

  return (
    <Animated.View
      style={[
        styles.menu,
        {
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
    right: 12,
    bottom: 72,
    backgroundColor: '#161616f5',
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: 12,
    padding: 6,
    minWidth: 160,
    zIndex: 40,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  optionPressed: { backgroundColor: WeRideColors.primaryDim },
  optionEmoji: { fontSize: 14 },
  optionLabel: { fontFamily: WeRideFonts.body, fontSize: 13, color: WeRideColors.text },
});