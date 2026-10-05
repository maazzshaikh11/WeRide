/**
 * HistoryCard — ride summary card (spec §3.8).
 * Shows only real figures passed in via `stats`; the share action sends the
 * same figures as plain text through the system share sheet. With `onPress`
 * the card itself is a PressableCard; Share is a separate Button that does not
 * trigger it.
 */
import React from 'react';
import { View, Text, StyleSheet, Share } from 'react-native';
import { WeRideColors, WeRideRadius, WeRideSpacing } from '../theme/theme';
import { type } from '../theme/typography';
import StatBox from './StatBox';
import { Button, PressableCard } from '../ui';

interface Stat {
  label: string;
  value: string;
}

interface Props {
  name: string;
  meta: string;           // "In progress" or "12 Aug · 6 riders"
  active?: boolean;
  stats: Stat[];
  /** Makes the card tappable (sink + warm tint + lit border). Omit for a static card. */
  onPress?: () => void;
  /** Screen-reader hint for the card press, e.g. "Opens the live map". */
  pressHint?: string;
}

export function rideShareMessage(name: string, stats: Stat[]): string {
  const figures = stats.map((s) => `${s.value} ${s.label}`).join(', ');
  return figures ? `WeRide ride: ${name} (${figures})` : `WeRide ride: ${name}`;
}

export default function HistoryCard({ name, meta, active, stats, onPress, pressHint }: Props) {
  const share = () => {
    Share.share({ message: rideShareMessage(name, stats) }).catch(() => {
      // User dismissed or the share sheet is unavailable — nothing to recover.
    });
  };

  const summary = `${name}, ${meta}. ${stats.map((st) => `${st.value} ${st.label}`).join(', ')}`;

  // Summary is one accessible group; the Share action sits outside it so
  // screen readers can reach it as its own button.
  const summaryBlock = (
    <View
      accessible
      accessibilityRole={onPress ? 'button' : 'summary'}
      accessibilityLabel={summary}
      accessibilityHint={onPress ? pressHint : undefined}
      accessibilityActions={onPress ? [{ name: 'activate' }] : undefined}
      onAccessibilityAction={onPress}
      style={styles.summary}
    >
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
    </View>
  );

  const shareButton = (
    <Button
      label="Share ride"
      variant="secondary"
      size="sm"
      onPress={share}
      accessibilityLabel={`Share ride card for ${name}`}
    />
  );

  if (!onPress) {
    return (
      <View style={[styles.card, styles.staticCard]}>
        {summaryBlock}
        {shareButton}
      </View>
    );
  }

  return (
    <PressableCard
      radius={WeRideRadius.xl}
      active={active}
      onPress={onPress}
      haptic="tap"
      accessible={false}
      accessibilityLabel={summary}
      accessibilityHint={pressHint}
      style={styles.card}
    >
      {summaryBlock}
      {shareButton}
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: WeRideSpacing.lg,
    gap: WeRideSpacing.md,
  },
  staticCard: {
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: WeRideRadius.xl,
  },
  summary: { gap: WeRideSpacing.md },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: WeRideSpacing.md },
  name: { flex: 1 },
  metaWrap: { flexDirection: 'row', alignItems: 'center', gap: WeRideSpacing.xs },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: WeRideColors.green },
  metaActive: { color: WeRideColors.green },
  statsRow: { flexDirection: 'row', gap: WeRideSpacing.sm },
  stat: { backgroundColor: WeRideColors.dark2 },
});
