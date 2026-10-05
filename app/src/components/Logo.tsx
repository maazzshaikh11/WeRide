/**
 * Logo — the real WeRide logo (assets/images/logo.jpeg, a copy of the repo's
 * logo.jpeg). The artwork is a dark rounded tile on pure black; this crops to the
 * tile and rounds the corners to match, so it sits cleanly on light and dark
 * pages alike.
 */
import React from 'react';
import { Image, StyleProp, View, ViewStyle } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro asset require
export const LOGO_SOURCE = require('../../assets/images/logo.jpeg');

// The tile inside the 1254 px artwork (same box scripts/generate-brand-assets.py cuts).
const ART = 1254;
const TILE = { x: 62, y: 52, size: 1128 };
const TILE_RADIUS = 0.224;

export default function Logo({ size = 96, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const k = size / TILE.size;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="WeRide"
      testID="weride-logo"
      style={[{ width: size, height: size, borderRadius: size * TILE_RADIUS, overflow: 'hidden', backgroundColor: '#000' }, style]}
    >
      <Image
        source={LOGO_SOURCE}
        resizeMode="stretch"
        style={{ position: 'absolute', width: ART * k, height: ART * k, left: -TILE.x * k, top: -TILE.y * k }}
      />
    </View>
  );
}
