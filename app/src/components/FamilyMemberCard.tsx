/**
 * FamilyMemberCard — member card with status badge (spec §3.6).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WeRideColors, WeRideFonts } from '../theme/theme';
import StatusBadge from './StatusBadge';

interface Props {
  name: string;
  meta: string;
  status: 'safe' | 'watching';
  color?: string;
}

const STATUS_LABELS = { safe: 'Notified', watching: 'Watching' } as const;

function initials(name: string): string {
  return name.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() || '??';
}

export default function FamilyMemberCard({ name, meta, status, color }: Props) {
  return (
    <View style={styles.card}>
      <View style={[styles.avatar, color ? { backgroundColor: color } : null]}>
        <Text style={styles.avatarText}>{initials(name)}</Text>
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.meta}>{meta}</Text>
      </View>
      <StatusBadge label={STATUS_LABELS[status]} variant={status} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: 14,
    padding: 11,
    marginBottom: 9,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: WeRideColors.purple,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontFamily: WeRideFonts.mono, fontSize: 12, fontWeight: '700', color: WeRideColors.white },
  textWrap: { flex: 1 },
  name: { fontFamily: WeRideFonts.body, fontSize: 12.5, fontWeight: '700', color: WeRideColors.white },
  meta: { fontFamily: WeRideFonts.body, fontSize: 9.5, color: WeRideColors.textSub, marginTop: 1 },
});