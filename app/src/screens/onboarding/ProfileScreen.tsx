/**
 * Profile — placeholder until implemented (docs/DEMO_PARITY_SPEC.md §3). Replace this file's body; keep the default export.
 */
import React from 'react';
import { Text } from 'react-native';
import { Screen } from '../../ui';
import { useTheme } from '../../theme/ThemeProvider';

export default function ProfileScreen(_props: any) {
  const { type } = useTheme();
  return (
    <Screen testID="screen-Profile">
      <Text style={type.h1}>Profile</Text>
    </Screen>
  );
}
