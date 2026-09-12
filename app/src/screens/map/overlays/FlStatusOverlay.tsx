/**
 * Privacy / FL status indicator — owned by Person D.
 * Simple line of text/icon: "Your ride data stays on your device — only
 * anonymized model updates are shared."
 * Optional "FL round N complete" toast.
 * No server call needed — reads local FL client state.
 *
 * TODO: wire to local FL round logger state
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WeRideColors } from '../../../theme/theme';

export default function FlStatusOverlay() {
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>Your ride data stays on your device</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', top: 80, left: 16, backgroundColor: '#00000099', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  text: { color: WeRideColors.onPrimary, fontSize: 12 },
});