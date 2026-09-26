/**
 * StopNode — timeline node for a planned stop (spec §3.4).
 * States: done (green), current (orange), upcoming (default).
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { WeRideColors, WeRideFonts } from '../theme/theme';
import { Stop } from '../store/stopsStore';

interface Props {
  stop: Stop;
  info: string;
  onPress?: () => void;
  isLast?: boolean;
}

const TAG_LABELS = {
  done: '✓ Reached',
  current: 'Up next',
  upcoming: 'Upcoming',
} as const;

const TAG_STYLES = {
  done:     { bg: '#22C55E18', border: '#22C55E44', text: WeRideColors.green },
  current:  { bg: '#FF5C0022', border: '#FF5C0044', text: WeRideColors.primary },
  upcoming: { bg: WeRideColors.dark3, border: WeRideColors.border, text: WeRideColors.textSub },
} as const;

export default function StopNode({ stop, info, onPress, isLast }: Props) {
  const tag = TAG_STYLES[stop.status];
  const circleStyle =
    stop.status === 'done'
      ? [styles.circle, { borderColor: WeRideColors.green, backgroundColor: '#22C55E18' }]
      : stop.status === 'current'
        ? [styles.circle, styles.circleCurrent]
        : styles.circle;

  return (
    <View style={styles.row}>
      <View style={styles.timeline}>
        <View style={circleStyle}>
          <Text style={styles.circleIcon}>{stop.status === 'done' ? '✓' : stop.icon}</Text>
        </View>
        {!isLast && <View style={[styles.line, stop.status === 'done' && styles.lineDone]} />}
      </View>
      <Pressable
        style={styles.content}
        onPress={onPress}
        disabled={!onPress}
        accessibilityLabel={`Stop ${stop.name}, ${stop.status}. ${info}`}
        accessibilityRole={onPress ? 'button' : 'text'}
      >
        <Text style={styles.name}>{stop.name}</Text>
        <Text style={styles.info}>{info}</Text>
        <View style={[styles.tag, { backgroundColor: tag.bg, borderColor: tag.border }]}>
          <Text style={[styles.tagText, { color: tag.text }]}>{TAG_LABELS[stop.status]}</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  timeline: { alignItems: 'center' },
  circle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: WeRideColors.border,
    backgroundColor: '#111111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleCurrent: {
    borderColor: WeRideColors.primary,
    shadowColor: WeRideColors.primary,
    shadowOpacity: 0.4,
    shadowOffset: { width: 4, height: 0 },
    shadowRadius: 4,
    elevation: 4,
  },
  circleIcon: { fontSize: 13 },
  line: { width: 2, minHeight: 26, flex: 1, backgroundColor: WeRideColors.border },
  lineDone: { backgroundColor: WeRideColors.green },
  content: { flex: 1, paddingBottom: 20 },
  name: { fontFamily: WeRideFonts.body, fontSize: 13.5, fontWeight: '600', color: WeRideColors.white },
  info: { fontFamily: WeRideFonts.body, fontSize: 10.5, color: WeRideColors.textSub, marginTop: 2 },
  tag: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginTop: 6,
  },
  tagText: { fontFamily: WeRideFonts.mono, fontSize: 8.5, textTransform: 'capitalize' },
});