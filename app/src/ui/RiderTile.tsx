/**
 * RiderTile (demo `.rtile`): avatar, name and a status line in a card; `ready` rims it in `ok`.
 * An optional role pill ("Lead" / "Sweep") sits top-right.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { CAP } from '../theme/textPolicy';
import { Avatar, Pill } from './Controls';

export function RiderTile({ name, initials, color, status, ready, me, role, testID }: {
  name: string; initials: string; color?: string; status: string; ready?: boolean; me?: boolean; role?: string; testID?: string;
}) {
  const { colors, type } = useTheme();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${name}, ${status}`}
      style={{
        flex: 1, minWidth: 0, borderRadius: 22, backgroundColor: colors.card, padding: 14, alignItems: 'center', gap: 8,
        borderWidth: ready ? 3 : 2, borderColor: ready ? colors.ok : colors.line,
      }}
    >
      <Avatar initials={initials} color={color} size={56} me={me} />
      <Text style={[type.h3, { fontSize: 16 }]} numberOfLines={1} maxFontSizeMultiplier={CAP.hud}>{name}</Text>
      <Text style={[type.label, { fontSize: 11, letterSpacing: 1.1, color: ready ? colors.ok : colors.ink3, textAlign: 'center' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={CAP.hud}>{status.toUpperCase()}</Text>
      {role ? <Pill label={role} tone="ink" style={{ position: 'absolute', top: 8, right: 8, height: 20 }} /> : null}
    </View>
  );
}
