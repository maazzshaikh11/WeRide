/**
 * HazardChip — one-tap hazard report button (spec §3.7).
 * Emoji here is a content glyph (the hazard type), not UI chrome.
 * `busy` swaps the glyph for a spinner; `disabled` blocks presses.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { WeRideColors, WeRideRadius, WeRideSpacing } from '../theme/theme';
import { type } from '../theme/typography';

interface Props {
  emoji: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}

export default function HazardChip({ emoji, label, onPress, disabled, busy }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={`Report hazard: ${label}`}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      style={({ pressed }) => [
        styles.chip,
        disabled && !busy && styles.chipDisabled,
        pressed && styles.chipPressed,
      ]}
    >
      <View style={styles.glyph}>
        {busy ? (
          <ActivityIndicator size="small" color={WeRideColors.primary} />
        ) : (
          <Text style={styles.emoji}>{emoji}</Text>
        )}
      </View>
      <Text style={[type.captionStrong, styles.label]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: WeRideSpacing.xs,
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: WeRideRadius.xl,
    paddingVertical: WeRideSpacing.sm,
    paddingHorizontal: WeRideSpacing.sm,
  },
  chipDisabled: { opacity: 0.5 },
  chipPressed: { backgroundColor: WeRideColors.dark2 },
  glyph: { height: 24, justifyContent: 'center', alignItems: 'center' },
  emoji: { fontSize: 20, lineHeight: 24 },
  label: { color: WeRideColors.text },
});
