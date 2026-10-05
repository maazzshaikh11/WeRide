/**
 * StatusBadge — pill-shaped status badges (spec §5.4).
 * Variants: safe (green), watching (blue), offline/spoofed (red), stale (grey).
 * Status is never conveyed by color alone — label text always present (spec §11).
 */
import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { WeRideColors, WeRideRadius, WeRideSpacing } from '../theme/theme';
import { type } from '../theme/typography';

export type BadgeVariant = 'safe' | 'watching' | 'error' | 'muted';

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; border: string; text: string }> = {
  safe:    { bg: WeRideColors.greenDim, border: '#22C55E44', text: WeRideColors.green },
  watching:{ bg: '#3B82F61F',           border: '#3B82F644', text: WeRideColors.blue },
  error:   { bg: WeRideColors.redDim,   border: '#FF3B3B55', text: WeRideColors.red },
  muted:   { bg: WeRideColors.dark3,    border: WeRideColors.border, text: WeRideColors.textSub },
};

interface Props {
  label: string;
  variant: BadgeVariant;
  style?: StyleProp<ViewStyle>;
}

export default function StatusBadge({ label, variant, style }: Props) {
  const v = VARIANT_STYLES[variant];
  return (
    <View style={[styles.badge, { backgroundColor: v.bg, borderColor: v.border }, style]}>
      <Text style={[type.labelStrong, { color: v.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: WeRideRadius.pill,
    paddingHorizontal: WeRideSpacing.sm,
    paddingVertical: WeRideSpacing.xs,
    alignSelf: 'flex-start',
  },
});
