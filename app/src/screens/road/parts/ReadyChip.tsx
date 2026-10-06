/** Ready-check chip (demo `.chk`): a ✓ in a green disc, or a ⚠ in the yellow (accent) disc for something to fix. */
import React from 'react';
import { Text, View } from 'react-native';
import { useStyles, useTheme } from '../../../theme/ThemeProvider';
import { Icon } from '../../../ui';

export default function ReadyChip({ label, ok, testID }: { label: string; ok: boolean; testID?: string }) {
  const { colors, type } = useTheme();
  const s = useStyles(({ colors: c }) => ({
    chip: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 34, paddingLeft: 8, paddingRight: 12, borderRadius: 17, backgroundColor: c.card2, borderWidth: 1.5, borderColor: c.line },
    disc: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  }));
  return (
    <View style={s.chip} testID={testID} accessible accessibilityLabel={`${label}${ok ? '' : ', needs attention'}`}>
      <View style={[s.disc, { backgroundColor: ok ? colors.ok : colors.pri }]}>
        <Icon name={ok ? 'check' : 'warn'} size={12} color={ok ? '#FFFFFF' : colors.priInk} />
      </View>
      <Text style={[type.smStrong, { fontSize: 13 }]}>{label}</Text>
    </View>
  );
}
