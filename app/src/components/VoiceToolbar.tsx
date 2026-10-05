/**
 * VoiceToolbar — mute / leave controls (spec §3.5).
 * Text-first: the mute button names the action ("Mute" / "Unmute") and exposes
 * the current state to assistive tech. Toggling mute pops the label and
 * cross-fades the red muted tint (opacity overlay, native driver).
 * Both buttons are PressableScale (press feedback); mute gives a 'select' haptic.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { WeRideColors, WeRideRadius, WeRideSpacing } from '../theme/theme';
import { type } from '../theme/typography';
import { PressableScale, Motion, useReducedMotion } from '../ui';

interface Props {
  muted: boolean;
  disabled?: boolean;
  onMuteToggle: () => void;
  onLeave: () => void;
}

export default function VoiceToolbar({ muted, disabled, onMuteToggle, onLeave }: Props) {
  const reduced = useReducedMotion();
  const tint = useRef(new Animated.Value(muted ? 1 : 0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const prevMuted = useRef(muted);

  useEffect(() => {
    if (prevMuted.current === muted) return;
    prevMuted.current = muted;
    if (reduced) {
      tint.setValue(muted ? 1 : 0);
      return;
    }
    const anim = Animated.parallel([
      Animated.timing(tint, { toValue: muted ? 1 : 0, duration: Motion.focus.durationMs, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(pop, { toValue: 0.8, duration: 70, useNativeDriver: true }),
        Animated.spring(pop, { toValue: 1, ...Motion.spring, useNativeDriver: true }),
      ]),
    ]);
    anim.start();
    return () => anim.stop();
  }, [muted, reduced, tint, pop]);

  return (
    <View style={styles.row}>
      <PressableScale
        onPress={onMuteToggle}
        disabled={disabled}
        haptic="select"
        style={styles.btn}
        accessibilityLabel={muted ? 'Unmute microphone' : 'Mute microphone'}
        accessibilityRole="button"
        accessibilityState={{ selected: muted, disabled: !!disabled }}
      >
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.mutedWash, { opacity: tint }]} />
        <Animated.View style={{ transform: [{ scale: pop }] }}>
          <Text style={[type.buttonSm, { color: muted ? WeRideColors.red : WeRideColors.text }]}>
            {muted ? 'Unmute' : 'Mute'}
          </Text>
        </Animated.View>
      </PressableScale>
      <PressableScale
        onPress={onLeave}
        disabled={disabled}
        haptic="tap"
        style={styles.btn}
        accessibilityLabel="Leave voice channel"
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
      >
        <Text style={[type.buttonSm, { color: WeRideColors.textSub }]}>Leave</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: WeRideSpacing.md },
  btn: {
    flex: 1,
    minHeight: 48,
    borderRadius: WeRideRadius.lg,
    backgroundColor: WeRideColors.dark2,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  // Muted: red-tinted fill and border, faded in over the neutral button.
  mutedWash: {
    backgroundColor: WeRideColors.redDim,
    borderWidth: 1,
    borderColor: WeRideColors.red,
    borderRadius: WeRideRadius.lg,
  },
});
