/**
 * Ticket (demo `.ticket`): a card with a map header, a dashed perforation with two notches, and a body.
 * `dark` renders the live variant (night palette). The notches are cut in the page colour.
 */
import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export function Ticket({ header, children, dark, perforated = true, style, testID }: {
  header?: React.ReactNode; children?: React.ReactNode; dark?: boolean; perforated?: boolean; style?: StyleProp<ViewStyle>; testID?: string;
}) {
  const { colors, road } = useTheme();
  const c = dark ? road : colors;
  return (
    <View
      testID={testID}
      style={[{ borderRadius: 26, backgroundColor: dark ? '#10110E' : c.card, overflow: 'hidden', borderWidth: 1.5, borderColor: c.line }, style]}
    >
      {header}
      {header && perforated ? (
        <View style={{ height: 0, marginHorizontal: 18, borderTopWidth: 2, borderStyle: 'dashed', borderColor: c.line2 }}>
          <View style={{ position: 'absolute', top: -13, left: -30, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.bg, borderWidth: 1.5, borderColor: c.line }} />
          <View style={{ position: 'absolute', top: -13, right: -30, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.bg, borderWidth: 1.5, borderColor: c.line }} />
        </View>
      ) : null}
      <View style={{ padding: 18, paddingTop: 16 }}>{children}</View>
    </View>
  );
}
