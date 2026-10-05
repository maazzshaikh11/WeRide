/**
 * StatBox — reusable stat value/label box (spec §3.3.8, §5.3).
 * `display` true → large stat number; false → compact text value (e.g. next stop name).
 */
import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { WeRideColors, WeRideRadius, WeRideSpacing } from '../theme/theme';
import { type } from '../theme/typography';

interface Props {
  value: string;
  label: string;
  display?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function StatBox({ value, label, display = true, style }: Props) {
  return (
    <View style={[styles.box, style]}>
      <Text
        style={display ? type.statSm : [type.bodyStrong, styles.compactValue]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={type.caption} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    backgroundColor: WeRideColors.dark3,
    borderRadius: WeRideRadius.lg,
    paddingHorizontal: WeRideSpacing.md,
    paddingVertical: WeRideSpacing.sm,
  },
  // statSm is 24pt line-height; keep the compact value on the same baseline rhythm.
  compactValue: { color: WeRideColors.primary, lineHeight: 24 },
});
