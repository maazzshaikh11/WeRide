/**
 * SOS button overlay — owned by Person B.
 * Big red button, always visible on the map.
 * ANTI-ACCIDENTAL TRIGGER (mandatory per spec §4.2):
 *   requires 2-second hold OR double-tap to trigger.
 *   Single tap MUST NOT fire SOS.
 * On trigger → writes sos_event to local CRDT queue immediately → attempts sync.
 * Cancel/resolve button appears after trigger (sender only).
 *
 * TODO: implement hold/double-tap gesture (use react-native-gesture-handler)
 * TODO: wire to SosService (local CRDT queue + Firestore sync + FCM)
 */
import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { WeRideColors } from '../../../theme/theme';

export default function SosOverlay({ groupId }: { groupId: string }) {
  const [triggered, setTriggered] = useState(false);

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: triggered ? '#9AA0A6' : WeRideColors.error }]}
      // TODO: replace with hold/double-tap gesture — single tap must NOT trigger
      onPress={() => {}}
    >
      <Text style={styles.icon}>{triggered ? '✓' : 'SOS'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { width: 72, height: 72, borderRadius: 36, position: 'absolute', top: 40, right: 16, justifyContent: 'center', alignItems: 'center' },
  icon: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});