/**
 * MusicPlayer — mini-player (spec §3.3.10). Placeholder: no real Spotify
 * integration; UI/state architecture only. Duck state: border #FF5C0022,
 * subtitle "🔉 Volume lowered — {reason}".
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { WeRideColors, WeRideFonts } from '../theme/theme';

interface Props {
  track?: string;
  artist?: string;
  duckReason?: string | null;
}

export default function MusicPlayer({
  track = 'Kesariya — Arijit Singh',
  artist = 'Spotify · connected',
  duckReason,
}: Props) {
  const [playing, setPlaying] = useState(true);

  return (
    <View style={[styles.player, duckReason ? styles.duck : null]}>
      <View style={styles.art}>
        <Text style={styles.artIcon}>🎵</Text>
      </View>
      <View style={styles.meta}>
        <Text style={styles.track} numberOfLines={1}>{track}</Text>
        <Text style={styles.artist} numberOfLines={1}>
          {duckReason ? `🔉 Volume lowered — ${duckReason}` : artist}
        </Text>
      </View>
      <View style={styles.controls}>
        <Pressable hitSlop={6} accessibilityLabel="Previous track" accessibilityRole="button">
          <Text style={styles.control}>⏮</Text>
        </Pressable>
        <Pressable
          hitSlop={6}
          accessibilityLabel={playing ? 'Pause' : 'Play'}
          accessibilityRole="button"
          onPress={() => setPlaying((p) => !p)}
        >
          <Text style={styles.control}>{playing ? '⏸' : '▶'}</Text>
        </Pressable>
        <Pressable hitSlop={6} accessibilityLabel="Next track" accessibilityRole="button">
          <Text style={styles.control}>⏭</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: 12,
    padding: 8,
    marginTop: 8,
  },
  duck: { borderColor: '#FF5C0022' },
  art: {
    width: 30,
    height: 30,
    borderRadius: 7,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  artIcon: { fontSize: 14 },
  meta: { flex: 1 },
  track: { fontFamily: WeRideFonts.body, fontSize: 11.5, fontWeight: '600', color: WeRideColors.white },
  artist: { fontFamily: WeRideFonts.body, fontSize: 9, color: WeRideColors.textSub, marginTop: 1 },
  controls: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingRight: 4 },
  control: { fontSize: 16, color: WeRideColors.text },
});
