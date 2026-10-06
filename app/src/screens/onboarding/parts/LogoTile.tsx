/**
 * LogoTile — the real WeRide mark (components/Logo) on a road-sign tile: road-yellow rim, asphalt inside
 * (the demo's app-icon tile). Fixed plate colours, identical in every theme.
 */
import React from 'react';
import { View } from 'react-native';
import Logo from '../../../components/Logo';
import { Plates } from '../../../theme/palettes';

export default function LogoTile({ size = 116 }: { size?: number }) {
  const rim = Math.max(2, Math.round(size * 0.055));
  const outer = Math.round(size * 0.27);
  return (
    <View
      testID="logo-tile"
      style={{ width: size, height: size, borderRadius: outer, backgroundColor: Plates.yellow.bg, padding: rim }}
    >
      <View
        style={{
          flex: 1, borderRadius: outer - rim, backgroundColor: Plates.black.bg, alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Logo size={Math.round(size * 0.7)} />
      </View>
    </View>
  );
}
