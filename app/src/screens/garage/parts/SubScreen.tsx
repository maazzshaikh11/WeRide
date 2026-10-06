/**
 * Scaffold shared by Safety / Display / Privacy (demo: topbar mb 14, 'Me' eyebrow, two-line H1).
 */
import React from 'react';
import { Text } from 'react-native';
import { Screen, TopBar } from '../../../ui';
import { useTheme } from '../../../theme/ThemeProvider';

export interface NavLike {
  goBack?: () => void;
  navigate?: (...args: any[]) => void;
  reset?: (...args: any[]) => void;
}

export default function SubScreen({ title, navigation, testID, children }: {
  title: string; navigation?: NavLike; testID: string; children: React.ReactNode;
}) {
  const { type } = useTheme();
  return (
    <Screen testID={testID}>
      <TopBar onBack={() => navigation?.goBack?.()} style={{ marginBottom: 14 }} />
      <Text style={type.label}>ME</Text>
      <Text style={[type.h1, { marginTop: 8 }]} accessibilityRole="header">{title}</Text>
      {children}
    </Screen>
  );
}

/** Small uppercase label above a control (demo `.t-label` with mb 8). */
export function FieldLabel({ children, top = 24 }: { children: string; top?: number }) {
  const { type } = useTheme();
  return <Text style={[type.label, { marginTop: top, marginBottom: 8 }]}>{children.toUpperCase()}</Text>;
}
