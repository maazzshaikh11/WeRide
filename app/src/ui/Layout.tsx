/**
 * Screen scaffolding from demo.html: TopBar (back chip), Stepper / StepBar (progress), Screen
 * (the 60/20 scroller with an optional CTA pinned to the bottom and the content fading under it),
 * KV (value/key stat row), Ring (circular progress), Bars (the weekly bar chart), Rail (the dashed waypoint rail).
 */
import React from 'react';
import { ScrollView, StyleProp, Text, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import Icon from './Icon';
import PressableScale from './PressableScale';

/** Back chip on the left, anything on the right (demo `topbar`). */
export function TopBar({ onBack, right, back = true, style }: { onBack?: () => void; right?: React.ReactNode; back?: boolean; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const s = useStyles(({ colors: c }) => ({
    row: { flexDirection: 'row', alignItems: 'center', height: 44, marginBottom: 18 },
    btn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card, borderWidth: 1.5, borderColor: c.line },
  }));
  return (
    <View style={[s.row, style]}>
      {back ? (
        <PressableScale onPress={onBack} haptic="tap" accessibilityRole="button" accessibilityLabel="Back" style={s.btn} testID="topbar-back">
          <Icon name="back" size={22} color={colors.ink} />
        </PressableScale>
      ) : null}
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}

/** `n` of `of` equal bars, filled in `ink` up to n (demo `stepper` / `stepbar`). */
export function Stepper({ step, of = 5, style }: { step: number; of?: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', gap: 4, marginBottom: 18 }, style]} accessibilityLabel={`Step ${step} of ${of}`} testID="stepper">
      {Array.from({ length: of }, (_, i) => (
        <View key={i} testID={i < step ? 'step-on' : 'step-off'} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i < step ? colors.ink : colors.line2 }} />
      ))}
    </View>
  );
}

/**
 * The standard screen: scrolls under a status-bar-aware 60 px top pad with 20 px gutters. `cta` is pinned
 * to the bottom (44 px above the home bar, like the demo) and the scrolling content fades beneath it.
 */
export function Screen({ children, cta, tabs, style, contentStyle, testID, onScroll }: {
  children: React.ReactNode; cta?: React.ReactNode; tabs?: boolean; style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle>; testID?: string;
  onScroll?: (y: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useStyles(({ colors: c }) => ({
    root: { flex: 1, backgroundColor: c.bg },
    cta: { position: 'absolute', left: 20, right: 20, paddingBottom: 0 },
    fade: { position: 'absolute', left: 0, right: 0 },
  }));
  const top = Math.max(insets.top, 24) + 16;
  const bottomGap = cta ? 120 + insets.bottom : tabs ? 24 : 40 + insets.bottom;
  return (
    <View style={[s.root, style]} testID={testID}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[{ paddingTop: top, paddingHorizontal: 20, paddingBottom: bottomGap }, contentStyle]}
        onScroll={onScroll ? (e) => onScroll(e.nativeEvent.contentOffset.y) : undefined}
        scrollEventThrottle={onScroll ? 32 : undefined}
      >
        {children}
      </ScrollView>
      {cta ? (
        <>
          {/* content fades out underneath the pinned button (demo `.has-cta`) */}
          <View pointerEvents="none" style={[s.fade, { bottom: 0, height: 150 + insets.bottom }]}>
            <Svg width="100%" height="100%" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id="ctafade" x1="0" y1="1" x2="0" y2="0">
                  <Stop offset="0.55" stopColor={colors.bg} stopOpacity={1} />
                  <Stop offset="1" stopColor={colors.bg} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#ctafade)" />
            </Svg>
          </View>
          <View style={[s.cta, { bottom: Math.max(insets.bottom, 12) + 20 }]}>{cta}</View>
        </>
      ) : null}
    </View>
  );
}

/** Row of value/key stats (demo `.kv`): big mono numerals over an uppercase key. */
export function KV({ items, style, size = 25, keyLines = 1 }: { items: { value: string; unit?: string; label: string; color?: string }[]; style?: StyleProp<ViewStyle>; size?: number; keyLines?: number }) {
  const { type } = useTheme();
  return (
    <View style={[{ flexDirection: 'row' }, style]}>
      {items.map((it) => (
        <View key={it.label} style={{ flex: 1, minWidth: 0 }}>
          <Text style={[type.statValue, { fontSize: size, lineHeight: size }, it.color ? { color: it.color } : null]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {it.value}
            {it.unit ? <Text style={{ fontSize: 14 }}> {it.unit}</Text> : null}
          </Text>
          <Text style={[type.statKey, { marginTop: 6 }]} numberOfLines={keyLines}>{it.label.toUpperCase()}</Text>
        </View>
      ))}
    </View>
  );
}

/** Circular progress (demo `ringsvg`, r=44). `value` 0..1. Children are centred inside. */
export function Ring({ value, size = 104, color, track, stroke = 7, children }: {
  value: number; size?: number; color?: string; track?: string; stroke?: number; children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const C = 2 * Math.PI * 44;
  const v = Math.max(0, Math.min(1, value));
  const c = color ?? colors.ink;
  return (
    <View style={{ width: size, height: size }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx={50} cy={50} r={44} fill="none" stroke={track ?? c} strokeOpacity={track ? 1 : 0.25} strokeWidth={stroke} />
        <Circle cx={50} cy={50} r={44} fill="none" stroke={c} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${C}`} strokeDashoffset={C * (1 - v)} transform="rotate(-90 50 50)" />
      </Svg>
      <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>{children}</View>
    </View>
  );
}

/** Weekly bar chart (demo `.bars`): the last bar is the accent. */
export function Bars({ values, labels, height = 74 }: { values: number[]; labels?: string[]; height?: number }) {
  const { colors, type } = useTheme();
  const max = Math.max(1, ...values);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height, marginBottom: 22 }} accessibilityLabel="Distance per week" testID="bars">
      {values.map((v, i) => (
        <View key={i} style={{ flex: 1, height: Math.max(6, (v / max) * height), borderRadius: 6, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: i === values.length - 1 ? colors.pri : colors.line2 }}>
          {labels?.[i] ? (
            <Text style={[type.statKey, { position: 'absolute', bottom: -18, left: 0, right: 0, textAlign: 'center', fontSize: 10, letterSpacing: 0.6 }]} numberOfLines={1}>{labels[i]}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export type RailTone = 'pri' | 'ok' | 'bad' | 'ink';
/** Vertical dashed rail with diamond markers (demo `.mp`): a timeline / waypoint list. */
export function Rail({ items, inverse }: { items: { title: string; sub?: string; tone?: RailTone }[]; inverse?: boolean }) {
  const { colors, type } = useTheme();
  const fill = (t?: RailTone) => (t === 'ok' ? colors.ok : t === 'bad' ? colors.bad : t === 'ink' ? colors.ink : colors.pri);
  return (
    <View style={{ paddingLeft: 26 }} testID="rail">
      <View style={{ position: 'absolute', left: 5, top: 6, bottom: 6, width: 3, borderRadius: 1.5, borderLeftWidth: 3, borderStyle: 'dashed', borderColor: inverse ? '#555' : colors.line2 }} />
      {items.map((it, i) => (
        <View key={i} style={{ paddingBottom: i === items.length - 1 ? 0 : 16 }}>
          <View style={{ position: 'absolute', left: -26, top: 3, width: 13, height: 13, borderRadius: 4, transform: [{ rotate: '45deg' }], backgroundColor: fill(it.tone), borderWidth: 2, borderColor: inverse ? '#FFFFFF' : colors.ink }} />
          <Text style={[type.h3, inverse ? { color: colors.bg } : null]}>{it.title}</Text>
          {it.sub ? <Text style={[type.sm, inverse ? { color: '#B7B8AB' } : null]}>{it.sub}</Text> : null}
        </View>
      ))}
    </View>
  );
}
