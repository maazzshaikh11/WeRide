/**
 * VoxZone — voice channel status block on VoiceScreen (spec §3.5).
 * States: idle, speaking, muted, connecting, disconnected. Each has a label
 * (never colour alone) and a plain one-line explanation, overridable via `detail`.
 * Connecting shows a pulsing dot (native driver); a state change re-enters the
 * text with a short fade instead of snapping.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { WeRideColors, WeRideSpacing } from '../theme/theme';
import { type } from '../theme/typography';
import { FadeIn, useReducedMotion } from '../ui';

export type VoxState = 'idle' | 'speaking' | 'muted' | 'connecting' | 'disconnected';

interface Props {
  state: VoxState;
  /** Replaces the default explanation line. */
  detail?: string;
}

// VoxClient (modules/fl-voice) only joins the signalling room today: peer
// connections / audio relay are TODO there, so connected states say so.
const AUDIO_NOTE = 'Connected to the group channel. Rider-to-rider audio is not live yet.';

const COPY: Record<VoxState, { label: string; color: string; detail: string }> = {
  idle:         { label: 'Channel open', color: WeRideColors.green, detail: AUDIO_NOTE },
  speaking:     { label: 'You are speaking', color: WeRideColors.green, detail: AUDIO_NOTE },
  muted:        { label: 'Your mic is muted', color: WeRideColors.textSub, detail: AUDIO_NOTE },
  connecting:   { label: 'Connecting', color: WeRideColors.gold, detail: 'Setting up your microphone and the group channel.' },
  disconnected: { label: 'Not connected', color: WeRideColors.red, detail: 'You are not in the voice channel.' },
};

/** Status dot; pulses (scale + opacity) while connecting. */
function StatusDot({ color, pulsing }: { color: string; pulsing: boolean }) {
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!pulsing || reduced) {
      t.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulsing, reduced, t]);

  return (
    <Animated.View
      testID={pulsing ? 'vox-connecting-pulse' : undefined}
      style={[
        styles.dot,
        {
          backgroundColor: color,
          opacity: t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }),
          transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
        },
      ]}
    />
  );
}

export default function VoxZone({ state, detail }: Props) {
  const c = COPY[state];
  return (
    <View style={styles.zone} accessible accessibilityLabel={`Voice status: ${c.label}. ${detail ?? c.detail}`}>
      <FadeIn key={state} style={styles.zone}>
        <View style={styles.statusRow}>
          <StatusDot color={c.color} pulsing={state === 'connecting'} />
          <Text style={type.heading}>{c.label}</Text>
        </View>
        <Text style={type.caption}>{detail ?? c.detail}</Text>
      </FadeIn>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { gap: WeRideSpacing.xs },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: WeRideSpacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
