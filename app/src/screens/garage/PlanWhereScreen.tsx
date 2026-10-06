/**
 * PlanWhere — placeholder until implemented (docs/DEMO_PARITY_SPEC.md §3). Replace this file's body; keep the default export.
 */
import React from 'react';
import { Text } from 'react-native';
import { Screen } from '../../ui';
import { useTheme } from '../../theme/ThemeProvider';

export default function PlanWhereScreen(_props: any) {
  const { type } = useTheme();
  return (
    <Screen testID="screen-PlanWhere">
      <Text style={type.h1}>PlanWhere</Text>
    </Screen>
  );
}
