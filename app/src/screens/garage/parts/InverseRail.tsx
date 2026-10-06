/**
 * The demo's dashed waypoint rail drawn on the inverted (ink) card of "How SOS works".
 * `Rail` in ui/Layout has fixed greys for its inverse mode; here every colour comes from the palette so the
 * card reads in all four theme/scheme combinations (ink card, `bg` text).
 */
import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { withAlpha } from '../../../theme/palettes';

export type InverseTone = 'pri' | 'ok' | 'bad';

export default function InverseRail({ items }: { items: { title: string; sub: string; tone: InverseTone }[] }) {
  const { colors, type } = useTheme();
  return (
    <View style={{ paddingLeft: 26 }} testID="inverse-rail">
      <View style={{ position: 'absolute', left: 5, top: 6, bottom: 6, width: 3, borderLeftWidth: 3, borderStyle: 'dashed', borderColor: withAlpha(colors.bg, 0.4) }} />
      {items.map((it, i) => (
        <View key={it.title} style={{ paddingBottom: i === items.length - 1 ? 0 : 16 }}>
          <View style={{ position: 'absolute', left: -26, top: 3, width: 13, height: 13, borderRadius: 4, transform: [{ rotate: '45deg' }], backgroundColor: colors[it.tone], borderWidth: 2, borderColor: colors.bg }} />
          <Text style={[type.h3, { color: colors.bg }]}>{it.title}</Text>
          <Text style={[type.sm, { color: withAlpha(colors.bg, 0.72) }]}>{it.sub}</Text>
        </View>
      ))}
    </View>
  );
}
