/**
 * Hazard Report FAB — Floating Action Button to open HazardReportSheet.
 * Positioned bottom-right of map.
 */
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { WeRideColors } from '@app/theme/theme';

interface Props {
  onPress: () => void;
  style?: object;
}

export default function HazardReportButton({ onPress, style }: Props) {
  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={onPress}
      accessibilityLabel="Report Hazard"
      accessibilityRole="button"
    >
      <Text style={styles.icon}>⚠️</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: WeRideColors.hazardPothole,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
  icon: {
    fontSize: 24,
  },
});
