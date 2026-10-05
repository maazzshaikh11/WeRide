/**
 * VoiceToolbar — mute / leave controls (spec §3.5).
 * Text-first: the mute button names the action ("Mute" / "Unmute") and exposes
 * the current state to assistive tech; muted is also red-tinted.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { WeRideColors, WeRideRadius, WeRideSpacing } from '../theme/theme';
import { type } from '../theme/typography';

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
        style={({ pressed }) => [
          styles.btn,
          muted && styles.btnMuted,
          disabled && styles.btnDisabled,
          pressed && styles.pressed,
        ]}
        accessibilityLabel={muted ? 'Unmute microphone' : 'Mute microphone'}
        accessibilityRole="button"
        accessibilityState={{ selected: muted, disabled: !!disabled }}
      >
        <Text style={[type.buttonSm, { color: muted ? WeRideColors.red : WeRideColors.text }]}>
          {muted ? 'Unmute' : 'Mute'}
        </Text>
      </Pressable>
      <Pressable
        onPress={onLeave}
        disabled={disabled}
        style={({ pressed }) => [styles.btn, disabled && styles.btnDisabled, pressed && styles.pressed]}
        accessibilityLabel="Leave voice channel"
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
      >
        <Text style={[type.buttonSm, { color: WeRideColors.textSub }]}>Leave</Text>
      </Pressable>
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
  },
  btnMuted: { backgroundColor: WeRideColors.redDim, borderColor: WeRideColors.red },
  btnDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});
