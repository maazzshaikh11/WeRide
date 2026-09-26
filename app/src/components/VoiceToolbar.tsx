/**
 * VoiceToolbar — mute/leave buttons (spec §3.5).
 * Muted state: red-tinted. Leave always muted-grey.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { WeRideColors, WeRideFonts } from '../theme/theme';

interface Props {
  muted: boolean;
  disabled?: boolean;
  onMuteToggle: () => void;
  onLeave: () => void;
}

export default function VoiceToolbar({ muted, disabled, onMuteToggle, onLeave }: Props) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onMuteToggle}
        disabled={disabled}
        style={[styles.btn, muted && styles.btnMuted, disabled && styles.btnDisabled]}
        accessibilityLabel={muted ? 'Unmute microphone' : 'Mute microphone'}
        accessibilityRole="button"
      >
        <Text style={styles.icon}>{muted ? '🔇' : '🔊'}</Text>
      </Pressable>
      <Pressable
        onPress={onLeave}
        disabled={disabled}
        style={[styles.btn, disabled && styles.btnDisabled]}
        accessibilityLabel="Leave voice channel"
        accessibilityRole="button"
      >
        <Text style={styles.iconLeave}>📵</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  btn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnMuted: {
    backgroundColor: '#FF3B3B1F',
    borderColor: '#FF3B3B55',
  },
  btnDisabled: { opacity: 0.5 },
  icon: { fontSize: 15, color: WeRideColors.text },
  iconLeave: { fontSize: 15, color: WeRideColors.textSub },
});