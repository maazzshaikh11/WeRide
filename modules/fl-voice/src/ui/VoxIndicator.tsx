/**
 * VOX indicator overlay — avatar ring highlight + mic toggle.
 * Auto (VOX-controlled) vs manual (push-to-talk) mode.
 * Ported from vox_indicator.dart.
 *
 * TODO: wire to VoxClient + Vad.
 */

import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { WeRideColors } from '@app/theme/theme';

export default function VoxIndicator() {
  const [autoMode, setAutoMode] = useState(true);
  const [speaking, setSpeaking] = useState(false);

  return (
    <View style={styles.container}>
      {speaking && (
        <View style={styles.ring}>
          <Text style={styles.icon}>👤</Text>
        </View>
      )}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: autoMode ? WeRideColors.voxActive : '#FFD60A' }]}
        onPress={() => setAutoMode((v) => !v)}
      >
        <Text style={styles.label}>{autoMode ? '🎙' : '👆'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  ring: { padding: 4, borderWidth: 3, borderColor: WeRideColors.voxActive, borderRadius: 999, marginBottom: 8 },
  icon: { fontSize: 32 },
  button: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 20 },
});