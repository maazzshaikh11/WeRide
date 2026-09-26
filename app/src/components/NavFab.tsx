/**
 * NavFab — Google Maps navigation FAB (spec §3.3.6).
 * Deep link handled by caller via @routing/client/deepLink or direct URL.
 */
import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { WeRideColors } from '../theme/theme';
import Fab from './Fab';

interface Props {
  onPress: () => void;
  disabled?: boolean;
}

export default function NavFab({ onPress, disabled }: Props) {
  return (
    <Fab
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel="Navigate in Google Maps"
      accessibilityRole="button"
    >
      <Text>🧭</Text>
    </Fab>
  );
}

// bg applied via Fab style prop in MapScreen FAB column; kept here for reuse.
export const navFabStyle = StyleSheet.create({
  fab: { backgroundColor: WeRideColors.blue },
});