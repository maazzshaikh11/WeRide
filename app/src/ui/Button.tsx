/**
 * Button — the one button, as in demo.html (.btn). Variants: primary (accent),
 * dark (ink fill), ghost (outlined), soft (card2), danger (SOS/leave/delete),
 * ok (confirm). `secondary` is an alias of `soft`.
 * Built on PressableScale so every button has the same press feel + haptic.
 * `loading` swaps the label for a spinner WITHOUT changing the button's size
 * (no layout jump) and blocks presses.
 */
import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { CAP } from '../theme/textPolicy';
import PressableScale, { PressableScaleProps } from './PressableScale';

export type ButtonVariant = 'primary' | 'dark' | 'ghost' | 'soft' | 'secondary' | 'danger' | 'ok';

export interface ButtonProps extends Omit<PressableScaleProps, 'style' | 'children'> {
  label: string;
  variant?: ButtonVariant;
  /** 'md' = 58pt (demo .btn), 'sm' = 44pt (minimum touch target), 'xs' = 36pt (+4 pt hit slop = 44). */
  size?: 'md' | 'sm' | 'xs';
  loading?: boolean;
  /** Content before the label (an Icon). */
  leading?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const SIZE: Record<NonNullable<ButtonProps['size']>, ViewStyle> = {
  md: { height: 58, borderRadius: 18, paddingHorizontal: 22 },
  sm: { height: 44, borderRadius: 14, paddingHorizontal: 16 },
  xs: { height: 36, borderRadius: 12, paddingHorizontal: 13 },
};

export default function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  leading,
  style,
  hitSlop,
  haptic = variant === 'danger' ? 'warning' : 'select',
  accessibilityLabel,
  ...rest
}: ButtonProps) {
  const { colors, type } = useTheme();
  const inactive = Boolean(disabled || loading);

  const look: Record<ButtonVariant, { bg: string; fg: string; border?: ViewStyle }> = {
    primary: { bg: colors.pri, fg: colors.priInk, border: { borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.14)' } },
    dark: { bg: colors.ink, fg: colors.bg },
    ghost: { bg: 'transparent', fg: colors.ink, border: { borderWidth: 2, borderColor: colors.line2 } },
    soft: { bg: colors.card2, fg: colors.ink },
    secondary: { bg: colors.card2, fg: colors.ink },
    danger: { bg: colors.bad, fg: '#FFFFFF' },
    ok: { bg: colors.ok, fg: '#FFFFFF' },
  };
  const v = look[variant];
  const textBase = size === 'md' ? type.button : size === 'sm' ? type.buttonSm : type.buttonXs;
  const labelStyle: TextStyle = { ...textBase, color: v.fg };

  return (
    <PressableScale
      {...rest}
      haptic={haptic}
      hitSlop={hitSlop ?? (size === 'xs' ? { top: 4, bottom: 4, left: 4, right: 4 } : undefined)}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[styles.base, SIZE[size], { backgroundColor: v.bg }, v.border, style]}
    >
      {/* Label stays in layout (hidden while loading) so the width never changes. */}
      <View style={[styles.content, loading && styles.hidden]}>
        {leading}
        <Text style={labelStyle} numberOfLines={1} maxFontSizeMultiplier={CAP.hud}>{label}</Text>
      </View>
      {loading ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.spinner}>
            <ActivityIndicator size="small" color={v.fg} />
          </View>
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  hidden: { opacity: 0 },
  spinner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
