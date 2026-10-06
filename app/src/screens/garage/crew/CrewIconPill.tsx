/** Pill with a leading icon (demo `.pill.g` "Verified GPS"). */
import React from 'react';
import { Text, View } from 'react-native';
import { withAlpha } from '../../../theme/palettes';
import { useTheme } from '../../../theme/ThemeProvider';
import { Icon } from '../../../ui';
import type { IconName } from '../../../ui';

export default function CrewIconPill({ icon, label }: { icon: IconName; label: string }) {
  const { colors, type } = useTheme();
  return (
    <View style={{ height: 26, paddingHorizontal: 10, borderRadius: 13, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: withAlpha(colors.ok, 0.16) }}>
      <Icon name={icon} size={12} color={colors.ok} />
      <Text style={[type.pill, { color: colors.ok }]}>{label.toUpperCase()}</Text>
    </View>
  );
}
