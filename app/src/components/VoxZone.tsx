/**
 * VoxZone — voice channel status plate on VoiceScreen (spec §3.5), the demo's
 * "Talking to crew" road-sign plate. States: idle, speaking, muted, connecting,
 * disconnected. Each has a label (never colour alone) and a plain one-line
 * explanation, overridable via `detail`.
 *   idle / speaking → green plate · muted → black · connecting → yellow ·
 *   disconnected → white.  (Red stays reserved for SOS.)
 * Speaking shows the demo's 5-bar `.wave`; connecting a pulsing dot (native
 * driver); a state change re-enters the plate with a short fade.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { PlateTone, Plates } from '../theme/palettes';
import { useStyles, useTheme } from '../theme/ThemeProvider';
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

const COPY: Record<VoxState, { label: string; tone: PlateTone; detail: string }> = {
  idle:         { label: 'Channel open', tone: 'green', detail: AUDIO_NOTE },
  speaking:     { label: 'You are speaking', tone: 'green', detail: AUDIO_NOTE },
  muted:        { label: 'Your mic is muted', tone: 'black', detail: AUDIO_NOTE },
  connecting:   { label: 'Connecting', tone: 'yellow', detail: 'Setting up your microphone and the group channel.' },
  disconnected: { label: 'Not connected', tone: 'white', detail: 'You are not in the voice channel.' },
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
      style={{
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: color,
        opacity: t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }),
        transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
      }}
    />
  );
}

/** Demo `.wave`: five 5 px bars bouncing 6 → 28 px, 0.1 s apart (scaleY, native driver). */
function Wave({ color }: { color: string }) {
  const reduced = useReducedMotion();
  const vals = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (reduced) {
      vals.forEach((v) => v.setValue(0.6));
      return;
    }
    const loops = vals.map((v, i) =>
      Animated.sequence([
        Animated.delay(i * 100),
        Animated.loop(
          Animated.sequence([
            Animated.timing(v, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(v, { toValue: 0, duration: 400, useNativeDriver: true }),
          ]),
        ),
      ]),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [reduced, vals]);

  return (
    <View testID="vox-wave" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 30 }}>
      {vals.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            width: 5,
            height: 28,
            borderRadius: 3,
            backgroundColor: color,
            transform: [{ scaleY: v.interpolate({ inputRange: [0, 1], outputRange: [6 / 28, 1] }) }],
          }}
        />
      ))}
    </View>
  );
}

export default function VoxZone({ state, detail }: Props) {
  const { type } = useTheme();
  const s = useStyles(() => ({
    plate: { borderRadius: 18, paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
    rim: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderRadius: 14, borderWidth: 2, opacity: 0.92 },
    text: { flex: 1, minWidth: 0 },
  }));
  const c = COPY[state];
  const p = Plates[c.tone];
  return (
    <View accessible accessibilityLabel={`Voice status: ${c.label}. ${detail ?? c.detail}`}>
      <FadeIn key={state}>
        <View style={[s.plate, { backgroundColor: p.bg }]}>
          {state === 'speaking' ? <Wave color={p.fg} /> : null}
          {state === 'connecting' ? <StatusDot color={p.fg} pulsing /> : null}
          <View style={s.text}>
            <Text style={[type.plateTitle, { color: p.fg, fontSize: 23, lineHeight: 24 }]} numberOfLines={1}>
              {c.label.toUpperCase()}
            </Text>
            <Text style={[type.plateSub, { color: p.fg, opacity: 0.85, marginTop: 4 }]} numberOfLines={3}>
              {detail ?? c.detail}
            </Text>
          </View>
          <View pointerEvents="none" style={[s.rim, { borderColor: p.rim }]} />
        </View>
      </FadeIn>
    </View>
  );
}
