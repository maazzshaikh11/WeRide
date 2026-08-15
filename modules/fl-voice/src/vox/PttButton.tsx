/**
 * Manual push-to-talk button (PTT fallback).
 * Mandatory per spec §4.2 — VOX-only is a UX risk in loud environments.
 * Hold to talk, release to mute.
 * Ported from ptt_button.dart.
 */

import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { WeRideColors } from '@app/theme/theme';

interface Props {
  onChanged: (transmitting: boolean) => void;
  style?: ViewStyle;
}

export default function PttButton({ onChanged, style }: Props) {
  const [transmitting, setTransmitting] = useState(false);

  const set = (v: boolean) => {
    if (transmitting === v) return;
    setTransmitting(v);
    onChanged(v);
  };

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: transmitting ? WeRideColors.voxActive : '#9AA0A6' }, style]}
      onPressIn={() => set(true)}
      onPressOut={() => set(false)}
    >
      <Text style={styles.text}>{transmitting ? '🎙 Talking' : 'Hold to talk'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24, flexDirection: 'row', alignItems: 'center' },
  text: { color: '#fff', fontWeight: '600' },
});