/**
 * Logo — the WeRide mark (WR + road + pin) cut out of the logo.jpeg artwork
 * into a transparent PNG, so it sits directly on any page background with no
 * tile or box behind it. logo.jpeg itself is untouched (launcher icons and
 * splash still use the full tile artwork).
 */
import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro asset require
export const LOGO_SOURCE = require('../../assets/images/logo-notile.png');

// Cutout dimensions (1046x723); height follows the width to keep the aspect.
const ASPECT = 1046 / 723;

export default function Logo({ size = 140, style }: { size?: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={LOGO_SOURCE}
      resizeMode="contain"
      accessible
      accessibilityRole="image"
      accessibilityLabel="WeRide"
      testID="weride-logo"
      style={[{ width: size, height: size / ASPECT }, style]}
    />
  );
}
