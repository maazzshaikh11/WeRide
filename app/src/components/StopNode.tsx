/**
 * StopNode — a waypoint on the ride's `.mp` rail (demo): dashed rail down the
 * left, a 13 px diamond marker per stop (ink ring), title + a small status line.
 * States: done (ok), current (accent), upcoming (ink).
 * The glyph is the one the rider picked for the stop (content). Only the
 * current stop is pressable (PressableScale); its row is at least 44pt tall.
 *
 * State changes animate on the native driver (opacity/transform only):
 * the marker pops and cross-fades to its new colour, and the stop that becomes
 * current eases in. Mounting in a state does not animate.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { Stop } from '../store/stopsStore';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import { Motion, PressableScale, useReducedMotion } from '../ui';

interface Props {
  stop: Stop;
  /** Secondary line, e.g. "12 km away". Omitted when empty. */
  info?: string;
  onPress?: () => void;
  isLast?: boolean;
  /** The rail starts a little lower on the first stop (demo `top: 6`). */
  isFirst?: boolean;
}

const TAG_LABELS = {
  done: 'Reached',
  current: 'Up next',
  upcoming: 'Upcoming',
} as const;

function useStopAnimation(status: Stop['status']) {
  const reduced = useReducedMotion();
  const done = useRef(new Animated.Value(status === 'done' ? 1 : 0)).current;
  const current = useRef(new Animated.Value(status === 'current' ? 1 : 0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const prev = useRef(status);

  useEffect(() => {
    if (prev.current === status) return;
    prev.current = status;
    const doneTo = status === 'done' ? 1 : 0;
    const currentTo = status === 'current' ? 1 : 0;
    if (reduced) {
      done.setValue(doneTo);
      current.setValue(currentTo);
      return;
    }
    const anims: Animated.CompositeAnimation[] = [
      Animated.timing(done, { toValue: doneTo, duration: 220, useNativeDriver: true }),
      Animated.timing(current, { toValue: currentTo, duration: 260, useNativeDriver: true }),
    ];
    if (status === 'done') {
      // Scale pop: overshoot, then settle.
      anims.push(
        Animated.sequence([
          Animated.timing(pop, { toValue: 1.25, duration: 110, useNativeDriver: true }),
          Animated.spring(pop, { toValue: 1, ...Motion.spring, useNativeDriver: true }),
        ]),
      );
    } else if (status === 'current') {
      // Soft entrance for the stop that just became the next one.
      pop.setValue(0.85);
      anims.push(Animated.spring(pop, { toValue: 1, ...Motion.spring, useNativeDriver: true }));
    }
    const all = Animated.parallel(anims);
    all.start();
    return () => all.stop();
  }, [status, reduced, done, current, pop]);

  return { done, current, pop };
}

export default function StopNode({ stop, info, onPress, isLast, isFirst }: Props) {
  const { colors, type } = useTheme();
  const s = useStyles(({ colors: c }) => ({
    row: { paddingLeft: 26 },
    rail: { position: 'absolute', left: 5, width: 3 },
    marker: { position: 'absolute', left: 0, top: 3, width: 13, height: 13 },
    fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    diamond: { borderRadius: 4, borderWidth: 2, borderColor: c.ink },
    glyphRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    glyph: { fontSize: 15, lineHeight: 20 },
    content: { minHeight: 44, justifyContent: 'center', paddingBottom: 16 },
    meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, marginTop: 4 },
  }));
  const tagLabel = TAG_LABELS[stop.status];
  const tagColor = stop.status === 'done' ? colors.ok : stop.status === 'current' ? colors.ink : colors.ink3;
  const { done, current, pop } = useStopAnimation(stop.status);
  const a11yLabel = `Stop ${stop.name}, ${stop.status}.${info ? ` ${info}` : ''}`;

  const text = (
    <>
      <View style={s.glyphRow}>
        <Text style={s.glyph}>{stop.icon}</Text>
        <Text style={[type.h3, { flex: 1 }]} numberOfLines={2}>
          {stop.name}
        </Text>
      </View>
      <View style={s.meta}>
        <Text style={[type.label, { color: tagColor }]}>
          {stop.status === 'done' ? '✓ ' : ''}
          {tagLabel.toUpperCase()}
        </Text>
        {info ? <Text style={type.sm}>{info}</Text> : null}
      </View>
    </>
  );

  return (
    <View style={s.row}>
      <View pointerEvents="none" style={[s.rail, { top: isFirst ? 6 : 0, bottom: isLast ? 6 : 0 }]}>
        <Svg width={3} height="100%">
          <Line x1={1.5} y1={0} x2={1.5} y2="100%" stroke={colors.line2} strokeWidth={3} strokeDasharray="6 5" strokeLinecap="butt" />
        </Svg>
      </View>
      <Animated.View pointerEvents="none" testID={`stop-marker-${stop.status}`} style={[s.marker, { transform: [{ rotate: '45deg' }, { scale: pop }] }]}>
        {/* ink (upcoming) base, accent and ok washes cross-fade on top. */}
        <View style={[s.fill, s.diamond, { backgroundColor: colors.ink }]} />
        <Animated.View style={[s.fill, s.diamond, { backgroundColor: colors.pri, opacity: current }]} />
        <Animated.View style={[s.fill, s.diamond, { backgroundColor: colors.ok, opacity: done }]} />
      </Animated.View>
      {onPress ? (
        <PressableScale
          style={s.content}
          onPress={onPress}
          haptic={false}
          scaleTo={Motion.scale.card}
          accessibilityLabel={a11yLabel}
          accessibilityHint="Double tap to mark this stop as reached"
          accessibilityRole="button"
        >
          {text}
        </PressableScale>
      ) : (
        <View style={s.content} accessible accessibilityLabel={a11yLabel} accessibilityRole="text">
          {text}
        </View>
      )}
    </View>
  );
}
