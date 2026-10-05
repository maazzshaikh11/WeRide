/**
 * StopNode — timeline node for a planned stop (spec §3.4).
 * States: done (green), current (accent), upcoming (neutral).
 * The icon is the glyph the rider picked for the stop (content). Only the
 * current stop is pressable; its row is at least 44pt tall.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { WeRideColors, WeRideSpacing } from '../theme/theme';
import { type } from '../theme/typography';
import { Stop } from '../store/stopsStore';

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

export default function StopNode({ stop, info, onPress, isLast }: Props) {
  const circleStyle =
    stop.status === 'done'
      ? [styles.circle, styles.circleDone]
      : stop.status === 'current'
        ? [styles.circle, styles.circleCurrent]
        : styles.circle;
  const tagLabel = TAG_LABELS[stop.status];

  return (
    <View style={styles.row}>
      <View style={styles.timeline}>
        <View style={circleStyle}>
          <Text style={styles.circleIcon}>{stop.status === 'done' ? '✓' : stop.icon}</Text>
        </View>
        {!isLast && <View style={[styles.line, stop.status === 'done' && styles.lineDone]} />}
      </View>
      <View style={[styles.contentWrap, !isLast && styles.contentGap]}>
        <Pressable
          style={styles.content}
          onPress={onPress}
          disabled={!onPress}
          accessibilityLabel={`Stop ${stop.name}, ${stop.status}.${info ? ` ${info}` : ''}`}
          accessibilityHint={onPress ? 'Double tap to mark this stop as reached' : undefined}
          accessibilityRole={onPress ? 'button' : 'text'}
        >
          <Text style={type.heading} numberOfLines={2}>
            {stop.name}
          </Text>
          <View style={styles.metaRow}>
            <Text style={[type.label, { color: TAG_COLORS[stop.status] }]}>{tagLabel}</Text>
            {info ? <Text style={type.caption}>{info}</Text> : null}
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const CIRCLE = 32;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: WeRideSpacing.md },
  timeline: { alignItems: 'center', width: CIRCLE },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    borderWidth: 2,
    borderColor: WeRideColors.border,
    backgroundColor: WeRideColors.dark2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleDone: { borderColor: WeRideColors.green, backgroundColor: WeRideColors.greenDim },
  circleCurrent: { borderColor: WeRideColors.primary, backgroundColor: WeRideColors.primaryDim },
  circleIcon: { fontSize: 14, lineHeight: 18, color: WeRideColors.green },
  line: { width: 2, minHeight: 20, flex: 1, backgroundColor: WeRideColors.border },
  lineDone: { backgroundColor: WeRideColors.green },
  contentWrap: { flex: 1 },
  contentGap: { paddingBottom: WeRideSpacing.lg },
  content: { minHeight: 44, justifyContent: 'center' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: WeRideSpacing.sm },
});
