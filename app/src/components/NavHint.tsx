/**
 * NavHint — "Tap 🧭 to navigate" hint bar (spec §3.3.9).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WeRideColors, WeRideFonts } from '../theme/theme';

export default function NavHint() {
  return (
    <View style={styles.bar}>
      <Text style={styles.text}>Tap 🧭 to navigate turn-by-turn in Google Maps</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: WeRideColors.dark2,
    borderTopWidth: 1,
    borderTopColor: WeRideColors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  text: { fontFamily: WeRideFonts.mono, fontSize: 9.5, color: WeRideColors.textSub, textAlign: 'center' },
});