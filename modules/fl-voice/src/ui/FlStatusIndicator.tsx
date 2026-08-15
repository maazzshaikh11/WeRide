/**
 * Privacy / FL status indicator.
 * "Your ride data stays on your device — only anonymized model updates are shared."
 * Optional FL round toast. No server call — reads local FL client state.
 * Ported from fl_status.dart.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  latestRound?: number;
  latestLoss?: number;
  participants?: number;
}

export default function FlStatusIndicator({ latestRound, latestLoss, participants }: Props) {
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>
        {latestRound != null
          ? `FL round ${latestRound} done · ${participants} clients`
          : 'Your ride data stays on your device'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { backgroundColor: '#00000088', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  text: { color: '#fff', fontSize: 12 },
});