/**
 * Button — the one button. Variants: primary (accent fill), secondary
 * (surface + border), ghost (text only), danger (red fill — SOS/leave/delete).
 * Built on PressableScale so every button has the same press feel + haptic.
 * `loading` swaps the label for a spinner WITHOUT changing the button's size
 * (no layout jump) and blocks presses.
 */
import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { WeRideColors, WeRideRadius, WeRideSpacing } from '../theme/theme';
import { type } from '../theme/typography';
import PressableScale, { PressableScaleProps } from './PressableScale';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends Omit<PressableScaleProps, 'style' | 'children'> {
  label: string;
  variant?: ButtonVariant;
  /** 'md' = 48pt, 'sm' = 44pt (the minimum touch target). */
  size?: 'md' | 'sm';
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

const LABEL_COLOR: Record<ButtonVariant, string> = {
  primary: WeRideColors.onPrimary,
  secondary: WeRideColors.text,
  ghost: WeRideColors.primary,
  danger: WeRideColors.white,
};

export default function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  style,
  haptic = variant === 'danger' ? 'warning' : 'select',
  accessibilityLabel,
  ...rest
}: ButtonProps) {
  const inactive = Boolean(disabled || loading);
  const labelStyle: TextStyle = {
    ...(size === 'md' ? type.button : type.buttonSm),
    color: LABEL_COLOR[variant],
  };
  return (
    <PressableScale
      {...rest}
      haptic={haptic}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[styles.base, size === 'md' ? styles.md : styles.sm, VARIANT_STYLE[variant], style]}
    >
      {/* Label stays in layout (hidden while loading) so the width never changes. */}
      <Text style={[labelStyle, loading && styles.hidden]} numberOfLines={1}>
        {label}
      </Text>
      {loading ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.spinner}>
            <ActivityIndicator size="small" color={LABEL_COLOR[variant]} />
          </View>
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: WeRideRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: WeRideSpacing.xl,
  },
  md: { height: 48 },
  sm: { height: 44, paddingHorizontal: WeRideSpacing.lg },
  hidden: { opacity: 0 },
  spinner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

const VARIANT_STYLE: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: WeRideColors.primary },
  secondary: { backgroundColor: WeRideColors.dark3, borderWidth: 1, borderColor: WeRideColors.border },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: WeRideColors.red },
};
