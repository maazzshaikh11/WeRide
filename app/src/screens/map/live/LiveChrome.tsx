/**
 * Chrome of the live ride screen (demo.html "Road mode"): edge vignettes, side
 * buttons, the speed / ETA cluster and the control keys. All colours come from
 * the theme's `road` palette (the high-contrast variant); layout numbers are the
 * demo's. Pure presentation — MapScreen feeds it real values.
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useInsetsOrZero } from '../../../theme/responsive';
import { CAP } from '../../../theme/textPolicy';
import { useStyles, useTheme } from '../../../theme/ThemeProvider';
import { Icon, IconName, PressableScale } from '../../../ui';
import type { Units } from '../../../models/domain';
import { distanceUnit, formatDistance, formatSpeed, speedUnit } from '../../../utils/units';
import { CONTROL_GAP, LiveLayout, liveLayout } from './liveLayout';

export { CONTROL_GAP };

/** The Live chrome's geometry for this window, safe area and glove setting (see liveLayout.ts). */
export function useLiveLayout(glove?: boolean): LiveLayout {
  const { width, height } = useWindowDimensions();
  const { top, bottom } = useInsetsOrZero();
  return useMemo(() => liveLayout({ width, height, insets: { top, bottom }, glove }), [width, height, top, bottom, glove]);
}

/** Heights the map camera must keep clear (see MapScreen padding). */
export const SIDE_BTN = 62;
export const CONTROL_H = 88;
/** Glove mode (demo `.glove .ctl`): bigger keys and a bigger speed. */
export const GLOVE_CONTROL_H = 104;
export const GLOVE_SPEED_SIZE = 132;
export const controlHeight = (glove?: boolean): number => (glove ? GLOVE_CONTROL_H : CONTROL_H);

export function Vignettes() {
  const { road } = useTheme();
  const { width } = useWindowDimensions();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={200} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Defs>
          <LinearGradient id="vt" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.08" stopColor={road.bg} stopOpacity={0.92} />
            <Stop offset="1" stopColor={road.bg} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={200} fill="url(#vt)" />
      </Svg>
      <Svg width={width} height={380} style={{ position: 'absolute', bottom: 0, left: 0 }}>
        <Defs>
          <LinearGradient id="vb" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0.52" stopColor={road.bg} stopOpacity={1} />
            <Stop offset="1" stopColor={road.bg} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={380} fill="url(#vb)" />
      </Svg>
    </View>
  );
}

export function SideButton({ icon, label, onPress, active, accessibilityLabel, testID }: {
  icon: IconName; label: string; onPress: () => void; active?: boolean; accessibilityLabel: string; testID?: string;
}) {
  const { road, roadType } = useTheme();
  const { sideBtn } = useLiveLayout();
  const s = useStyles(({ road: r }) => ({
    btn: { borderRadius: 18, backgroundColor: r.card, borderWidth: 2, borderColor: r.line2, alignItems: 'center', justifyContent: 'center', gap: 4 },
  }));
  return (
    <PressableScale
      onPress={onPress}
      haptic="select"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: Boolean(active) }}
      testID={testID}
      style={[s.btn, { width: sideBtn, height: sideBtn }, active && { borderColor: road.pri }]}
    >
      <Icon name={icon} size={24} color={active ? road.pri : road.ink} />
      <Text style={[roadType.tab, { color: road.ink, fontSize: 10, lineHeight: 11 }]} numberOfLines={1} maxFontSizeMultiplier={CAP.fixed}>{label}</Text>
    </PressableScale>
  );
}

/**
 * Big speed, plus ETA and distance left. `null` means "no data yet" and shows dashes — never a made-up number.
 * Speed and distance are shown in the rider's units (km or mi); `speedKmh` / `remainingKm` are always metric inputs.
 */
export function SpeedCluster({ speedKmh, etaClock, remainingKm, toLabel, onPress, units = 'km', glove }: {
  speedKmh: number | null; etaClock: string | null; remainingKm: number | null; toLabel: string | null; onPress?: () => void; units?: Units; glove?: boolean;
}) {
  const { road, roadType } = useTheme();
  const { speedSize } = useLiveLayout(glove);
  const s = useStyles(({ road: r, roadType: t }) => ({
    row: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: 18 },
    unit: { ...t.label, fontSize: 15, lineHeight: 17, letterSpacing: 2.1, color: r.ink2, marginTop: 8 },
    kv: { alignItems: 'flex-end', gap: 8, marginLeft: 'auto', paddingBottom: 6, flexShrink: 1, minWidth: 0 },
    a: { ...t.num, fontSize: 34, lineHeight: 34, letterSpacing: 0, color: r.ink },
    b: { ...t.label, fontSize: 11, lineHeight: 12, letterSpacing: 1.5, color: r.ink2, marginTop: -4 },
  }));
  const shown = speedKmh == null ? '--' : formatSpeed(speedKmh, units);
  const remaining = remainingKm == null ? null : formatDistance(remainingKm, units, false);
  return (
    <PressableScale
      onPress={onPress}
      haptic={false}
      scaleTo={0.99}
      accessibilityRole="button"
      accessibilityLabel="Route details"
      testID="speed-cluster"
      style={s.row}
    >
      <View>
        <Text
          testID="speed-value"
          style={[roadType.num, { fontSize: speedSize, lineHeight: speedSize * 0.8, letterSpacing: -speedSize * 0.07, color: road.ink }]}
          accessibilityLabel={speedKmh == null ? 'Speed unknown' : `${shown} ${units === 'mi' ? 'miles' : 'kilometres'} per hour`}
          maxFontSizeMultiplier={CAP.fixed}
          numberOfLines={1}
        >
          {shown}
        </Text>
        <Text style={s.unit} testID="speed-unit" maxFontSizeMultiplier={CAP.fixed}>{speedUnit(units)}</Text>
      </View>
      <View style={s.kv}>
        <View style={{ alignItems: 'flex-end', maxWidth: '100%' }}>
          <Text style={s.a} testID="eta-value" maxFontSizeMultiplier={CAP.fixed} numberOfLines={1}>{etaClock ?? '--:--'}</Text>
          <Text style={s.b} maxFontSizeMultiplier={CAP.fixed}>ETA</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.a} testID="remaining-value" maxFontSizeMultiplier={CAP.fixed} numberOfLines={1}>
            {remaining ?? '--'}
            <Text style={{ fontSize: 16 }}> {distanceUnit(units)}</Text>
          </Text>
          <Text style={s.b} numberOfLines={1} maxFontSizeMultiplier={CAP.fixed}>{toLabel ? `TO ${toLabel.toUpperCase()}` : 'TO DESTINATION'}</Text>
        </View>
      </View>
    </PressableScale>
  );
}

export function ControlKey({ icon, label, onPress, onPressIn, onPressOut, active, glove, accessibilityLabel, accessibilityHint, testID }: {
  icon: IconName; label: string; onPress?: () => void; onPressIn?: () => void; onPressOut?: () => void;
  /** Pressed-and-talking state (demo `.ctl.talk`): solid `ok` fill. */
  active?: boolean; glove?: boolean; accessibilityLabel?: string; accessibilityHint?: string; testID?: string;
}) {
  const { road, roadType } = useTheme();
  const { controlH, keyLabelSize } = useLiveLayout(glove);
  const s = useStyles(({ road: r }) => ({
    key: { flex: 1, borderRadius: 24, backgroundColor: r.card, borderWidth: 2, borderColor: r.line2, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 2 },
  }));
  const fg = active ? '#FFFFFF' : road.ink;
  return (
    <PressableScale
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      haptic="select"
      scaleTo={0.95}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={active === undefined ? undefined : { selected: active }}
      testID={testID}
      style={[s.key, { height: controlH }, active && { backgroundColor: road.ok, borderColor: road.ok }]}
    >
      <Icon name={icon} size={30} color={fg} />
      <Text style={[roadType.tab, { color: fg, fontSize: keyLabelSize, lineHeight: 13, letterSpacing: keyLabelSize < 11 ? 0.6 : 1.15 }]} numberOfLines={1} maxFontSizeMultiplier={CAP.fixed}>{label.toUpperCase()}</Text>
    </PressableScale>
  );
}

/** "H:MM" `minutes` from `now` (local time, 24 h, no leading zero on the hour like the demo's "8:01"). */
export function clockAfter(minutes: number, now: Date = new Date()): string {
  const t = new Date(now.getTime() + Math.max(0, minutes) * 60000);
  return `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`;
}
