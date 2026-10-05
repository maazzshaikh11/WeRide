/**
 * VoiceToolbar — mute / leave controls (spec §3.5), demo `btn soft sm` pair.
 * Text-first: the mute button names the action ("Mute" / "Unmute") and exposes
 * the current state to assistive tech. Toggling mute pops the label and
 * cross-fades the `bad` muted tint (opacity overlay, native driver).
 * Both buttons are PressableScale (press feedback); mute gives a 'select' haptic.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { withAlpha } from '../theme/palettes';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import { PressableScale, Motion, useReducedMotion } from '../ui';

interface Props {
  muted: boolean;
  disabled?: boolean;
  onMuteToggle: () => void;
  onLeave: () => void;
}

export default function VoiceToolbar({ muted, disabled, onMuteToggle, onLeave }: Props) {
  const { colors, type } = useTheme();
  const s = useStyles(({ colors: c }) => ({
    row: { flexDirection: 'row', gap: 8 },
    btn: { flex: 1, height: 44, borderRadius: 14, backgroundColor: c.card2, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    // Muted: bad-tinted fill with a bad rim, faded in over the neutral button.
    mutedWash: { backgroundColor: withAlpha(c.bad, 0.14), borderWidth: 2, borderColor: c.bad, borderRadius: 14 },
  }));
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
    <View style={s.row}>
      <PressableScale
        onPress={onMuteToggle}
        disabled={disabled}
        haptic="select"
        style={s.btn}
        accessibilityLabel={muted ? 'Unmute microphone' : 'Mute microphone'}
        accessibilityRole="button"
        accessibilityState={{ selected: muted, disabled: !!disabled }}
      >
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.mutedWash, { opacity: tint }]} />
        <Animated.View style={{ transform: [{ scale: pop }] }}>
          <Text style={[type.buttonSm, { color: muted ? colors.bad : colors.ink }]}>{muted ? 'Unmute' : 'Mute'}</Text>
        </Animated.View>
      </PressableScale>
      <PressableScale
        onPress={onLeave}
        disabled={disabled}
        haptic="tap"
        style={s.btn}
        accessibilityLabel="Leave voice channel"
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
      >
        <Text style={[type.buttonSm, { color: colors.ink2 }]}>Leave</Text>
      </PressableScale>
    </View>
  );
}
