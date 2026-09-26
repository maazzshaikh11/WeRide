/**
 * AvatarStack — overlapping mini-avatars (spec §3.3.8, §5.5).
 * 22×22 circles, -7px overlap, 2px #0d0d0d border, Space Mono 8px initials.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WeRideColors, WeRideFonts, riderColor } from '../theme/theme';

interface Props {
  names: string[];      // rider identifiers — initials derived
  max?: number;        // max shown (default 4)
}

function initials(name: string): string {
  return name.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() || '??';
}

export default function AvatarStack({ names, max = 4 }: Props) {
  const shown = names.slice(0, max);
  if (shown.length === 0) return null;
  return (
    <View style={styles.row}>
      {shown.map((name, i) => (
        <View
          key={name}
          style={[styles.avatar, { backgroundColor: riderColor(i), marginLeft: i === 0 ? 0 : -7 }]}
        >
          <Text style={styles.initials}>{initials(name)}</Text>
        </View>
      ))}
      {names.length > max ? (
        <View style={[styles.avatar, styles.overflow, { marginLeft: -7 }]}>
          <Text style={[styles.initials, { color: WeRideColors.textSub }]}>+{names.length - max}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#0d0d0d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overflow: { backgroundColor: WeRideColors.dark3 },
  initials: { fontFamily: WeRideFonts.mono, fontSize: 8, fontWeight: '700', color: WeRideColors.white },
});