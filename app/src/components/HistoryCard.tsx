/**
 * HistoryCard — ride summary card (spec §3.8).
 * Shows only real figures passed in via `stats`; the share action sends the
 * same figures as plain text through the system share sheet. With `onPress`
 * the card itself is a PressableCard; Share is a separate Button that does not
 * trigger it.
 */
import React from 'react';
import { View, Text, Share } from 'react-native';
import { useStyles } from '../theme/ThemeProvider';
import { Button, CenterLine, Pill, PressableCard } from '../ui';

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
  const styles = useStyles(({ colors: c, type: t }) => ({
    card: { padding: 18, gap: 16 },
    staticCard: { backgroundColor: c.card, borderWidth: 1.5, borderColor: c.line, borderRadius: 22 },
    summary: { gap: 16 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
    name: { ...t.h3, flex: 1 },
    meta: { ...t.sm },
    statsRow: { flexDirection: 'row' },
    stat: { flex: 1, minWidth: 0 },
    statValue: { ...t.statValue },
    statKey: { ...t.statKey, marginTop: 6 },
  }));
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
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {active ? <Pill label={meta} tone="ok" /> : <Text style={styles.meta}>{meta}</Text>}
      </View>

      <CenterLine dim />

      <View style={styles.statsRow}>
        {stats.map((s) => (
          <View key={s.label} style={styles.stat}>
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {s.value}
            </Text>
            <Text style={styles.statKey} numberOfLines={1}>{s.label.toUpperCase()}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const shareButton = (
    <Button
      label="Share ride"
      variant="soft"
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
      radius={22}
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
