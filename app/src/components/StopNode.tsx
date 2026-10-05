/**
 * StopNode — timeline node for a planned stop (spec §3.4).
 * States: done (green), current (accent), upcoming (neutral).
 * The icon is the glyph the rider picked for the stop (content). Only the
 * current stop is pressable (PressableScale); its row is at least 44pt tall.
 *
 * State changes animate on the native driver (opacity/transform only):
 * the circle pops and cross-fades to its done look, the connecting line fills
 * downward, and the stop that becomes current eases in. Mounting in a state
 * does not animate.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { WeRideColors, WeRideSpacing } from '../theme/theme';
import { type } from '../theme/typography';
import { Stop } from '../store/stopsStore';
import { Motion, PressableScale, useReducedMotion } from '../ui';

interface Props {
  stop: Stop;
  /** Secondary line, e.g. "12 km away". Omitted when empty. */
  info?: string;
  onPress?: () => void;
  isLast?: boolean;
}

const TAG_LABELS = {
  done: 'Reached',
  current: 'Up next',
  upcoming: 'Upcoming',
} as const;

const TAG_COLORS = {
  done: WeRideColors.green,
  current: WeRideColors.primary,
  upcoming: WeRideColors.textSub,
} as const;

function useStopAnimation(status: Stop['status']) {
  const reduced = useReducedMotion();
  const done = useRef(new Animated.Value(status === 'done' ? 1 : 0)).current;
  const current = useRef(new Animated.Value(status === 'current' ? 1 : 0)).current;
  const line = useRef(new Animated.Value(status === 'done' ? 1 : 0)).current;
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
      line.setValue(doneTo);
      return;
    }
    const anims: Animated.CompositeAnimation[] = [
      Animated.timing(done, { toValue: doneTo, duration: 220, useNativeDriver: true }),
      Animated.timing(current, { toValue: currentTo, duration: 260, useNativeDriver: true }),
      Animated.timing(line, { toValue: doneTo, duration: 380, delay: doneTo ? 140 : 0, useNativeDriver: true }),
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
  }, [status, reduced, done, current, line, pop]);

  return { done, current, line, pop };
}

export default function StopNode({ stop, info, onPress, isLast }: Props) {
  const tagLabel = TAG_LABELS[stop.status];
  const { done, current, line, pop } = useStopAnimation(stop.status);
  const [lineHeight, setLineHeight] = useState(0);
  const a11yLabel = `Stop ${stop.name}, ${stop.status}.${info ? ` ${info}` : ''}`;

  const text = (
    <>
      <Text style={type.heading} numberOfLines={2}>
        {stop.name}
      </Text>
      <View style={styles.metaRow}>
        <Text style={[type.label, { color: TAG_COLORS[stop.status] }]}>{tagLabel}</Text>
        {info ? <Text style={type.caption}>{info}</Text> : null}
      </View>
    </>
  );

  return (
    <View style={styles.row}>
      <View style={styles.timeline}>
        <Animated.View style={[styles.circleWrap, { transform: [{ scale: pop }] }]}>
          <View style={[StyleSheet.absoluteFill, styles.circle]} />
          <Animated.View style={[StyleSheet.absoluteFill, styles.circle, styles.circleCurrent, { opacity: current }]} />
          <Animated.View style={[StyleSheet.absoluteFill, styles.circle, styles.circleDone, { opacity: done }]} />
          <View style={styles.glyphWrap} pointerEvents="none">
            <Animated.Text
              style={[styles.circleIcon, { opacity: done.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
            >
              {stop.icon}
            </Animated.Text>
            <Animated.Text style={[styles.circleIcon, styles.checkIcon, { opacity: done }]}>✓</Animated.Text>
          </View>
        </Animated.View>
        {!isLast && (
          <View style={styles.line} onLayout={(e) => setLineHeight(e.nativeEvent.layout.height)}>
            {/* Fill slides down from the top as the stop is reached. */}
            <Animated.View
              style={[
                styles.lineFill,
                {
                  opacity: lineHeight > 0 ? 1 : 0,
                  transform: [{ translateY: line.interpolate({ inputRange: [0, 1], outputRange: [-lineHeight, 0] }) }],
                },
              ]}
            />
          </View>
        )}
      </View>
      <View style={[styles.contentWrap, !isLast && styles.contentGap]}>
        {onPress ? (
          <PressableScale
            style={styles.content}
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
          <View style={styles.content} accessible accessibilityLabel={a11yLabel} accessibilityRole="text">
            {text}
          </View>
        )}
      </View>
    </View>
  );
}

const CIRCLE = 32;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: WeRideSpacing.md },
  timeline: { alignItems: 'center', width: CIRCLE },
  circleWrap: { width: CIRCLE, height: CIRCLE, alignItems: 'center', justifyContent: 'center' },
  circle: {
    borderRadius: CIRCLE / 2,
    borderWidth: 2,
    borderColor: WeRideColors.border,
    backgroundColor: WeRideColors.dark2,
  },
  circleDone: { borderColor: WeRideColors.green, backgroundColor: WeRideColors.greenDim },
  circleCurrent: { borderColor: WeRideColors.primary, backgroundColor: WeRideColors.primaryDim },
  glyphWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  circleIcon: { position: 'absolute', fontSize: 14, lineHeight: 18, textAlign: 'center' },
  checkIcon: { color: WeRideColors.green },
  line: { width: 2, minHeight: 20, flex: 1, backgroundColor: WeRideColors.border, overflow: 'hidden' },
  lineFill: { ...StyleSheet.absoluteFillObject, backgroundColor: WeRideColors.green },
  contentWrap: { flex: 1 },
  contentGap: { paddingBottom: WeRideSpacing.lg },
  content: { minHeight: 44, justifyContent: 'center' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: WeRideSpacing.sm },
});
