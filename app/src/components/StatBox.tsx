/**
 * StatBox — reusable stat value/label box (spec §3.3.8, §5.3).
 */
import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { WeRideColors, WeRideFonts } from '../theme/theme';

interface Props {
  value: string;
  label: string;
  /** false → use Inter 12px 700 (next-stop box), true → Bebas 19px (default) */
  display?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function StatBox({ value, label, display = true, style }: Props) {
  return (
    <View style={[styles.box, style]}>
      {display ? (
        <Text style={styles.displayValue} numberOfLines={1}>
          {value}
        </Text>
      ) : (
        <Text style={styles.bodyValue} numberOfLines={1}>
          {value}
        </Text>
      )}
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    backgroundColor: WeRideColors.dark3,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  displayValue: {
    fontFamily: WeRideFonts.heading,
    fontSize: 19,
    color: WeRideColors.primary,
  },
  bodyValue: {
    fontFamily: WeRideFonts.body,
    fontSize: 12,
    fontWeight: '700',
    color: WeRideColors.primary,
  },
  label: {
    fontFamily: WeRideFonts.body,
    fontSize: 8.5,
    color: WeRideColors.textSub,
    marginTop: 1,
  },
});