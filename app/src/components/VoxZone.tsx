/**
 * VoxZone — voice channel status block on VoiceScreen (spec §3.5).
 * States: idle, speaking, muted, connecting, disconnected. Each has a label
 * (never colour alone) and a plain one-line explanation, overridable via `detail`.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WeRideColors, WeRideSpacing } from '../theme/theme';
import { type } from '../theme/typography';

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

export default function VoxZone({ state, detail }: Props) {
  const c = COPY[state];
  return (
    <View style={styles.zone} accessible accessibilityLabel={`Voice status: ${c.label}. ${detail ?? c.detail}`}>
      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: c.color }]} />
        <Text style={type.heading}>{c.label}</Text>
      </View>
      <Text style={type.caption}>{detail ?? c.detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { gap: WeRideSpacing.xs },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: WeRideSpacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
