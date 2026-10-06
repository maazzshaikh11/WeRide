/**
 * Small controls from demo.html: Pill, Segmented, Chip, Toggle, Avatar.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, Text, View, ViewStyle } from 'react-native';
import { withAlpha } from '../theme/palettes';
import { WeRideFonts } from '../theme/theme';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import { Motion, useReducedMotion } from './motion';
import PressableScale from './PressableScale';

export type PillTone = 'default' | 'accent' | 'ok' | 'bad' | 'ink';

export function Pill({ label, tone = 'default', style }: { label: string; tone?: PillTone; style?: StyleProp<ViewStyle> }) {
  const { colors, type } = useTheme();
  const s = useStyles(({ colors: c }) => ({
    pill: { height: 26, paddingHorizontal: 10, borderRadius: 13, alignSelf: 'flex-start', justifyContent: 'center', backgroundColor: c.card2, borderWidth: 1.5, borderColor: c.line },
  }));
  const look = {
    default: { backgroundColor: colors.card2, color: colors.ink2, border: true },
    accent: { backgroundColor: colors.pri, color: colors.priInk, border: false },
    ok: { backgroundColor: withAlpha(colors.ok, 0.16), color: colors.ok, border: false },
    bad: { backgroundColor: colors.bad, color: '#FFFFFF', border: false },
    ink: { backgroundColor: colors.ink, color: colors.bg, border: false },
  }[tone];
  return (
    <View style={[s.pill, { backgroundColor: look.backgroundColor }, !look.border && { borderWidth: 0 }, style]}>
      <Text style={[type.pill, { color: look.color }]} numberOfLines={1}>{label.toUpperCase()}</Text>
    </View>
  );
}

export interface SegmentedProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  testID?: string;
}

/** Segmented control (demo `.seg`): the selected segment is an `ink` pill. */
export function Segmented<T extends string>({ options, value, onChange, testID }: SegmentedProps<T>) {
  const { colors, type } = useTheme();
  const s = useStyles(({ colors: c }) => ({
    track: { flexDirection: 'row', padding: 4, gap: 2, borderRadius: 16, backgroundColor: c.card2, borderWidth: 1.5, borderColor: c.line },
    seg: { flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  }));
  return (
    <View style={s.track} accessibilityRole="radiogroup" testID={testID}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <PressableScale
            key={o.value}
            haptic="select"
            scaleTo={0.97}
            onPress={() => !on && onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            style={[s.seg, on && { backgroundColor: colors.ink }]}
          >
            <Text style={[type.seg, { color: on ? colors.bg : colors.ink2 }]} numberOfLines={1}>{o.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

export function Chip({ label, on, onPress, icon, style, testID }: {
  label: string; on?: boolean; onPress?: () => void; icon?: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string;
}) {
  const { colors, type } = useTheme();
  const s = useStyles(() => ({
    chip: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, paddingHorizontal: 16, borderRadius: 21, borderWidth: 1.5 },
  }));
  return (
    <PressableScale
      onPress={onPress}
      haptic="select"
      scaleTo={0.96}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(on) }}
      accessibilityLabel={label}
      testID={testID}
      style={[s.chip, on ? { backgroundColor: colors.ink, borderColor: colors.ink } : { backgroundColor: colors.card, borderColor: colors.line2 }, style]}
    >
      {icon}
      <Text style={[type.chip, { color: on ? colors.bg : colors.ink }]}>{label}</Text>
    </PressableScale>
  );
}

/** Switch (demo `.tg`): 54×32 track, 26 knob, springs across. */
export function Toggle({ value, onChange, accessibilityLabel, testID }: {
  value: boolean; onChange: (v: boolean) => void; accessibilityLabel: string; testID?: string;
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const x = useRef(new Animated.Value(value ? 22 : 0)).current;
  useEffect(() => {
    if (reduced) x.setValue(value ? 22 : 0);
    else Animated.spring(x, { toValue: value ? 22 : 0, ...Motion.spring, useNativeDriver: true }).start();
  }, [value, reduced, x]);
  return (
    <PressableScale
      onPress={() => onChange(!value)}
      haptic="select"
      scaleTo={0.97}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
      testID={testID}
      style={{ width: 54, height: 32, borderRadius: 16, backgroundColor: value ? colors.ok : colors.line2, justifyContent: 'center' }}
    >
      <Animated.View
        style={{ position: 'absolute', top: 3, left: 3, width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF', transform: [{ translateX: x }] }}
      />
    </PressableScale>
  );
}

/** Rider avatar (demo `.av`): initials on a colour, ringed in the page background. */
export function Avatar({ initials, color, size = 36, me, ring = true, covered = 0, style }: {
  initials: string; color?: string; size?: number; me?: boolean; ring?: boolean;
  /** Px of this avatar hidden by the next one in an overlapping stack: the initials shift left by half of it (demo `.avs .av:not(:last-child){padding-right:9px}`). */
  covered?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const fontSize = Math.round(size * 0.35 * 2) / 2;
  return (
    <View
      accessible
      accessibilityLabel={me ? 'You' : initials}
      style={[
        { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: me ? colors.pri : color ?? colors.card2 },
        ring && { borderWidth: 2.5, borderColor: colors.bg },
        covered > 0 && { paddingRight: covered },
        style,
      ]}
    >
      <Text style={{ fontFamily: WeRideFonts.extraBold, fontSize, lineHeight: fontSize + 2, letterSpacing: fontSize * 0.02, color: me ? colors.priInk : '#10110E' }}>
        {initials.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}
