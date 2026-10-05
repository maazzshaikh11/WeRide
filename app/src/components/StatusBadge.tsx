/**
 * StatusBadge — status pill (demo `.pill`, spec §5.4).
 * Variants: safe (ok), watching (blue), error (bad), muted (neutral).
 * Status is never conveyed by color alone — label text always present (spec §11).
 */
import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { Pill, PillTone } from '../ui';
import { withAlpha } from '../theme/palettes';
import { useTheme } from '../theme/ThemeProvider';

export type BadgeVariant = 'safe' | 'watching' | 'error' | 'muted';

const TONE: Record<Exclude<BadgeVariant, 'watching'>, PillTone> = { safe: 'ok', error: 'bad', muted: 'default' };

interface Props {
  label: string;
  variant: BadgeVariant;
  style?: StyleProp<ViewStyle>;
}

export default function StatusBadge({ label, variant, style }: Props) {
  const { colors, type } = useTheme();
  if (variant !== 'watching') return <Pill label={label} tone={TONE[variant]} style={style} />;
  // The demo has no blue pill; same geometry as Pill with a blue tint.
  return (
    <View
      style={[
        { height: 26, paddingHorizontal: 10, borderRadius: 13, alignSelf: 'flex-start', justifyContent: 'center', backgroundColor: withAlpha(colors.blue, 0.16) },
        style,
      ]}
    >
      <Text style={[type.pill, { color: colors.blue }]} numberOfLines={1}>{label.toUpperCase()}</Text>
    </View>
  );
}
