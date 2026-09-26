/**
 * HistoryCard — ride history summary card (spec §3.8).
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Share } from 'react-native';
import { WeRideColors, WeRideFonts } from '../theme/theme';

interface Stat {
  label: string;
  value: string;
}

interface Props {
  name: string;
  meta: string;           // "In progress · today" or "12 Aug · 6 riders"
  active?: boolean;
  stats: Stat[];
}

export default function HistoryCard({ name, meta, active, stats }: Props) {
  const [copied, setCopied] = useState(false);

  const share = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    Share.share({ message: `WeRide ride: ${name}` }).catch(() => {
      // Share unavailable (e.g. test env) — still show "Card ready ✓" per spec.
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.name}>{name}</Text>
        <Text style={[styles.meta, active && styles.metaActive]}>
          {active ? '🟢 ' : ''}{meta}
        </Text>
      </View>

      {/* SVG route line placeholder (spec: horizontal line placeholder) */}
      <View style={styles.routeLineWrap}>
        <View style={styles.routeLine} />
        <View style={[styles.routeDot, styles.routeDotLeft]} />
        <View style={[styles.routeDot, styles.routeDotRight, active && styles.routeDotActive]} />
      </View>

      <View style={styles.statsRow}>
        {stats.map((s) => (
          <Text key={s.label} style={styles.stat}>
            <Text style={styles.statValue}>{s.value}</Text> {s.label}
          </Text>
        ))}
      </View>

      <Pressable
        style={styles.shareBtn}
        onPress={share}
        accessibilityLabel={`Share ride card for ${name}`}
        accessibilityRole="button"
      >
        <Text style={styles.shareText}>{copied ? 'Card ready ✓' : 'Share ride card 📤'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontFamily: WeRideFonts.body, fontSize: 13, fontWeight: '700', color: WeRideColors.white },
  meta: { fontFamily: WeRideFonts.body, fontSize: 9.5, color: WeRideColors.textSub },
  metaActive: { color: WeRideColors.green },
  routeLineWrap: { position: 'relative', height: 28, marginVertical: 8, justifyContent: 'center' },
  routeLine: { height: 2, backgroundColor: WeRideColors.border },
  routeDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: WeRideColors.textSub,
    top: 13,
  },
  routeDotLeft: { left: 0 },
  routeDotRight: { right: 0 },
  routeDotActive: { backgroundColor: WeRideColors.primary },
  statsRow: { flexDirection: 'row', gap: 14, marginBottom: 12 },
  stat: { fontFamily: WeRideFonts.body, fontSize: 10.5, color: WeRideColors.textSub },
  statValue: { fontWeight: '700', color: WeRideColors.white },
  shareBtn: {
    backgroundColor: '#FF5C0022',
    borderWidth: 1,
    borderColor: '#FF5C0044',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  shareText: { fontFamily: WeRideFonts.body, fontSize: 11, fontWeight: '700', color: WeRideColors.primary },
});