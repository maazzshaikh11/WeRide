/**
 * SOS Button — anti-accidental trigger guard (MANDATORY per spec §4.2).
 * Requires 2-second hold OR double-tap to trigger. Single tap must NOT fire.
 * Ported from sos_button.dart.
 *
 * States: idle → big red button; sent → greyed, resolve button appears (sender only).
 *
 * TODO: use react-native-gesture-handler for proper hold detection.
 */
import React, { useState, useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { WeRideColors } from '@app/theme/theme';

interface Props {
  onTrigger: () => void;
  onResolve?: () => void;
  showResolve?: boolean; // sender only
  style?: ViewStyle;
}

const HOLD_MS = 2000;
const DOUBLE_TAP_MS = 400;

export default function SosButton({ onTrigger, onResolve, showResolve = false, style }: Props) {
  const [triggered, setTriggered] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const lastTapRef = useRef<number>(0);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fire = () => {
    if (triggered) return;
    setTriggered(true);
    onTrigger();
  };

  const onTap = () => {
    // Single tap must NOT trigger. Track for double-tap.
    const now = Date.now();
    if (lastTapRef.current && now - lastTapRef.current < DOUBLE_TAP_MS) {
      setTapCount((c: number) => {
        if (c + 1 >= 2) fire();
        return c + 1;
      });
    } else {
      setTapCount(1);
    }
    lastTapRef.current = now;
  };

  const onHoldStart = () => {
    holdTimerRef.current = setTimeout(fire, HOLD_MS);
  };

  const onHoldEnd = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
  };

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: triggered ? '#9AA0A6' : WeRideColors.error }, style]}
      onPressIn={onHoldStart}
      onPressOut={onHoldEnd}
      onPress={onTap}
    >
      <Text style={styles.icon}>{triggered ? '✓' : 'SOS'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  icon: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});