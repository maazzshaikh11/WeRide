/**
 * The yellow RIDER PLATE on Me (demo: label, name 27, "bike · style", logo 52). Always road-sign yellow.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { Plates } from '../../../theme/palettes';
import { useStyles, useTheme } from '../../../theme/ThemeProvider';
import Logo from '../../../components/Logo';

export default function RiderPlate({ name, detail }: { name: string; detail?: string }) {
  const { type } = useTheme();
  const p = Plates.yellow;
  const s = useStyles(() => ({
    plate: { borderRadius: 18, paddingVertical: 18, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, backgroundColor: p.bg },
    rim: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderRadius: 14, borderWidth: 2, borderColor: p.rim, opacity: 0.92 },
    text: { flex: 1, minWidth: 0 },
  }));
  return (
    <View style={s.plate} accessible accessibilityLabel={detail ? `Rider plate. ${name}. ${detail}` : `Rider plate. ${name}`} testID="rider-plate">
      <View style={s.text}>
        <Text style={[type.label, { color: p.fg, opacity: 0.6 }]}>RIDER PLATE</Text>
        <Text style={[type.plateTitle, { color: p.fg, fontSize: 27, lineHeight: 27, marginTop: 8 }]} numberOfLines={1}>{name.toUpperCase()}</Text>
        {detail ? <Text style={[type.plateSub, { color: p.fg, opacity: 0.85, marginTop: 4 }]} numberOfLines={1}>{detail}</Text> : null}
      </View>
      <Logo size={56} />
      <View pointerEvents="none" style={s.rim} />
    </View>
  );
}
