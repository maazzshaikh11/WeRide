/**
 * VoxZone — bottom microphone zone on VoiceScreen (spec §3.5).
 * States: idle ("CHANNEL OPEN · AUTO-VOICE"), speaking ("YOU ARE SPEAKING…"),
 * muted ("YOUR MIC MUTED"), connecting, disconnected.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WeRideColors, WeRideFonts } from '../theme/theme';

export type VoxState = 'idle' | 'speaking' | 'muted' | 'connecting' | 'disconnected';

interface Props {
  state: VoxState;
}

const LABELS: Record<VoxState, { label: string; color: string }> = {
  idle:         { label: 'CHANNEL OPEN · AUTO-VOICE', color: WeRideColors.green },
  speaking:     { label: 'YOU ARE SPEAKING…', color: WeRideColors.green },
  muted:        { label: 'YOUR MIC MUTED', color: WeRideColors.textSub },
  connecting:    { label: 'CONNECTING…', color: WeRideColors.gold },
  disconnected: { label: 'VOICE UNAVAILABLE', color: WeRideColors.red },
};

export default function VoxZone({ state }: Props) {
  const l = LABELS[state];
  const ringColor =
    state === 'disconnected' ? WeRideColors.red :
    state === 'connecting' ? WeRideColors.gold :
    state === 'muted' ? '#333333' :
    WeRideColors.green;

  return (
    <View style={styles.zone}>
      <View style={styles.ringWrap}>
        <View style={[styles.ring, { borderColor: ringColor, opacity: state === 'idle' ? 0 : 1 }]} />
        <View
          style={[
            styles.core,
            { borderColor: ringColor },
            state === 'speaking' && styles.coreSpeaking,
            state === 'muted' && styles.coreMuted,
          ]}
          accessibilityLabel={`Microphone status: ${l.label}`}
        >
          <Text style={styles.mic}>🎙️</Text>
        </View>
      </View>
      <Text style={[styles.label, { color: l.color }]}>{l.label}</Text>
      <Text style={styles.sub}>
        Mic activates automatically when you speak — no buttons, hands stay on the bars.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { alignItems: 'center', paddingBottom: 24 },
  ringWrap: { width: 66, height: 66, position: 'relative', justifyContent: 'center', alignItems: 'center' },
  ring: {
    position: 'absolute',
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2,
  },
  core: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    backgroundColor: WeRideColors.dark3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coreSpeaking: { backgroundColor: WeRideColors.greenDim },
  coreMuted: { opacity: 0.5 },
  mic: { fontSize: 22 },
  label: {
    fontFamily: WeRideFonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    marginTop: 8,
  },
  sub: {
    fontFamily: WeRideFonts.body,
    fontSize: 9.5,
    color: WeRideColors.textSub,
    textAlign: 'center',
    maxWidth: 220,
    marginTop: 6,
    lineHeight: 14,
  },
});