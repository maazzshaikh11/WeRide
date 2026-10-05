/**
 * SignalMenu — quick signal options menu (spec §3.3.7).
 * 4 options: Wait for me, Pull over, All good, Need fuel.
 * On tap: emits 'signal:send' via Socket.io, shows toast, speech bubble on sender marker.
 * Motion: opens with a spring scale/translate out of the signal FAB, options
 * stagger in (FadeIn), each option is a PressableScale; closing animates out
 * before unmounting. 'select' haptic only when a signal really goes out.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, Animated } from 'react-native';
import { WeRideColors, WeRideRadius } from '../theme/theme';
import { type } from '../theme/typography';
import { getLocationSocket } from '../services/socketService';
import { useToastStore } from '../store/toastStore';
import { FadeIn, haptic, Motion, PressableScale, useReducedMotion } from '../ui';

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

const CLOSE_MS = 140;

export default function SignalMenu({ visible, groupId, riderId, onSend, right = 76, bottom = 72 }: Props) {
  const anim = useRef(new Animated.Value(0)).current;
  // Stays mounted while the close animation plays, then unmounts.
  const [mounted, setMounted] = useState(visible);
  const alive = useRef(true);
  const reduced = useReducedMotion();
  const push = useToastStore((s) => s.push);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      // Opens from the FAB: spring scale + translate (native driver).
      const animation = reduced
        ? Animated.timing(anim, { toValue: 1, duration: 120, useNativeDriver: true })
        : Animated.spring(anim, { toValue: 1, ...Motion.spring, useNativeDriver: true });
      animation.start();
      // Stop on unmount / change so no timer outlives the component.
      return () => animation.stop();
    }
    const out = Animated.timing(anim, { toValue: 0, duration: CLOSE_MS, useNativeDriver: true });
    out.start(({ finished }) => {
      if (finished && alive.current) setMounted(false);
    });
    return () => out.stop();
  }, [visible, anim, reduced]);

  if (!visible && !mounted) return null;

  const send = (label: string) => {
    if (!visible) return;
    const socket = getLocationSocket();
    // Never claim a signal went out when it could not: nothing is queued offline.
    if (!socket.connected) {
      push('Offline — signal not sent', 'warn');
      return;
    }
    socket.emit('signal:send', { group_id: groupId, rider_id: riderId, label });
    haptic('select');
    push(`Signal sent: ${label}`);
    onSend(label);
  };

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.menu,
        {
          right,
          bottom,
          opacity: anim.interpolate({ inputRange: [0, 0.7], outputRange: [0, 1], extrapolate: 'clamp' }),
          transform: [
            // Grows out of the signal FAB (the menu's bottom-right corner).
            { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
            { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
          ],
        },
      ]}
    >
      {SIGNAL_OPTIONS.map((opt, i) => (
        <FadeIn key={opt.label} index={i}>
          <PressableScale
            style={styles.option}
            haptic={false}
            onPress={() => send(opt.label)}
            accessibilityLabel={`Send signal: ${opt.label}`}
            accessibilityRole="button"
          >
            <Text style={styles.optionEmoji}>{opt.emoji}</Text>
            <Text style={styles.optionLabel}>{opt.label}</Text>
          </PressableScale>
        </FadeIn>
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
  optionEmoji: { fontSize: 18, lineHeight: 24 },
  optionLabel: { ...type.bodyStrong },
});
