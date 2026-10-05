/**
 * NavFab — Google Maps navigation FAB (spec §3.3.6).
 * Deep link handled by caller via @routing/client/deepLink or direct URL.
 * Glyph is a plain-View arrow (triangle drawn with borders, rotated 45°), so
 * it needs no icon font or emoji. Press feedback + 'tap' haptic come from Fab.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
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
      haptic="tap"
      accessibilityLabel="Navigate in Google Maps"
      accessibilityRole="button"
    >
      <View style={styles.arrow} />
    </Fab>
  );
}

const styles = StyleSheet.create({
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: WeRideColors.text,
    transform: [{ rotate: '45deg' }],
  },
});
