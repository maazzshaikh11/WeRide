/**
 * HistoryCard — ride summary card (spec §3.8).
 * Shows only real figures passed in via `stats`; the share action sends the
 * same figures as plain text through the system share sheet.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, Share } from 'react-native';
import { WeRideColors, WeRideRadius, WeRideSpacing } from '../theme/theme';
import { type } from '../theme/typography';
import StatBox from './StatBox';

interface Stat {
  label: string;
  value: string;
}

interface Props {
  name: string;
  meta: string;           // "In progress" or "12 Aug · 6 riders"
  active?: boolean;
  stats: Stat[];
}

export function rideShareMessage(name: string, stats: Stat[]): string {
  const figures = stats.map((s) => `${s.value} ${s.label}`).join(', ');
  return figures ? `WeRide ride: ${name} (${figures})` : `WeRide ride: ${name}`;
}

export default function HistoryCard({ name, meta, active, stats }: Props) {
  const share = () => {
    Share.share({ message: rideShareMessage(name, stats) }).catch(() => {
      // User dismissed or the share sheet is unavailable — nothing to recover.
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={[type.heading, styles.name]} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.metaWrap}>
          {active ? <View style={styles.activeDot} /> : null}
          <Text style={[type.caption, active && styles.metaActive]}>{meta}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        {stats.map((s) => (
          <StatBox key={s.label} value={s.value} label={s.label} style={styles.stat} />
        ))}
      </View>

      <Pressable
        style={({ pressed }) => [styles.shareBtn, pressed && styles.pressed]}
        onPress={share}
        accessibilityLabel={`Share ride card for ${name}`}
        accessibilityRole="button"
      >
        <Text style={[type.buttonSm, { color: WeRideColors.primary }]}>Share ride</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: WeRideRadius.xl,
    padding: WeRideSpacing.lg,
    gap: WeRideSpacing.md,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: WeRideSpacing.md },
  name: { flex: 1 },
  metaWrap: { flexDirection: 'row', alignItems: 'center', gap: WeRideSpacing.xs },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: WeRideColors.green },
  metaActive: { color: WeRideColors.green },
  statsRow: { flexDirection: 'row', gap: WeRideSpacing.sm },
  stat: { backgroundColor: WeRideColors.dark2 },
  shareBtn: {
    minHeight: 44,
    borderRadius: WeRideRadius.lg,
    borderWidth: 1,
    borderColor: WeRideColors.primary,
    backgroundColor: WeRideColors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
});
