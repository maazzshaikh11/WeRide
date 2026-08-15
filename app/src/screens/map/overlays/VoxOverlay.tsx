/**
 * VOX indicator overlay — owned by Person D.
 * Avatar ring highlight on whoever's voice_active=true.
 * Mic icon toggle: auto (VOX-controlled) vs manual (push-to-talk).
 *
 * TODO: wire to VoxClient (WebRTC + /vox signaling)
 * TODO: implement VAD-driven voice_active broadcast
 * TODO: PTT fallback button in manual mode
 */
import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { WeRideColors } from '../../../theme/theme';

export default function VoxOverlay({ groupId }: { groupId: string }) {
  const [autoMode, setAutoMode] = useState(true);

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: autoMode ? WeRideColors.voxActive : '#FFD60A' }]}
      onPress={() => setAutoMode((v) => !v)}
    >
      <Text style={styles.icon}>{autoMode ? '🎙' : '👆'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { width: 56, height: 56, borderRadius: 28, position: 'absolute', bottom: 240, left: 16, justifyContent: 'center', alignItems: 'center' },
  icon: { fontSize: 20 },
});