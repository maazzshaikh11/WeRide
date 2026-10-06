/**
 * RiderPlate — the live yellow "RIDER PLATE" (demo profile): label, the rider's name in plate caps, "Bike ∙ Style",
 * and the real logo on its tile. Fixed road-sign yellow in every theme.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { Plates } from '../../../theme/palettes';
import { useStyles } from '../../../theme/ThemeProvider';
import LogoTile from './LogoTile';

export default function RiderPlate({ name, bike, style }: { name: string; bike: string; style: string }) {
  const s = useStyles(({ type: t }) => ({
    plate: { borderRadius: 18, paddingVertical: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, backgroundColor: Plates.yellow.bg },
    rim: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderRadius: 14, borderWidth: 2, borderColor: Plates.yellow.rim, opacity: 0.92 },
    label: { ...t.label, color: Plates.yellow.fg, opacity: 0.6 },
    name: { ...t.plateTitle, fontSize: 25, lineHeight: 27, color: Plates.yellow.fg, marginTop: 6 },
    sub: { ...t.plateSub, color: Plates.yellow.fg, opacity: 0.85, marginTop: 4 },
  }));
  const shown = (name.trim() || 'Rider').toUpperCase();
  return (
    <View style={s.plate} accessible accessibilityLabel={`Rider plate. ${shown}. ${bike}, ${style}`} testID="rider-plate">
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.label}>RIDER PLATE</Text>
        <Text style={s.name} numberOfLines={1} testID="plate-name">{shown}</Text>
        <Text style={s.sub} numberOfLines={1} testID="plate-sub">{`${bike} ∙ ${style}`}</Text>
      </View>
      <LogoTile size={46} />
      <View pointerEvents="none" style={s.rim} />
    </View>
  );
}
