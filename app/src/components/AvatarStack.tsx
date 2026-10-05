/**
 * AvatarStack — overlapping mini-avatars (spec §3.3.8, §5.5).
 * 24×24 circles, -8px overlap, 2px sheet-coloured border, 11px mono initials.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WeRideColors, riderColor } from '../theme/theme';
import { type } from '../theme/typography';

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
          style={[styles.avatar, { backgroundColor: riderColor(i), marginLeft: i === 0 ? 0 : -8 }]}
        >
          <Text style={styles.initials}>{initials(name)}</Text>
        </View>
      ))}
      {names.length > max ? (
        <View style={[styles.avatar, styles.overflow, { marginLeft: -8 }]}>
          <Text style={[styles.initials, { color: WeRideColors.textSub }]}>+{names.length - max}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: WeRideColors.dark2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overflow: { backgroundColor: WeRideColors.dark3 },
  initials: { ...type.labelStrong, letterSpacing: 0, color: WeRideColors.white },
});
