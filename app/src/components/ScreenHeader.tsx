/**
 * ScreenHeader — title block shared by the tab screens (demo `.t-label` eyebrow
 * over `.t-h1`). The eyebrow is optional and only shown when given.
 * The screen owns the horizontal gutter (20) and the top inset (demo: 60 incl.
 * the status bar); the header adds neither.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { useStyles, useTheme } from '../theme/ThemeProvider';

interface Props {
  eyebrow?: string;
  title: string;
  right?: React.ReactNode;
}

export default function ScreenHeader({ eyebrow, title, right }: Props) {
  const { type } = useTheme();
  const s = useStyles(() => ({
    container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 },
    textWrap: { flex: 1 },
    title: { marginTop: 8 },
    right: { flexShrink: 0 },
  }));
  return (
    <View style={s.container}>
      <View style={s.textWrap}>
        {eyebrow ? <Text style={type.label}>{eyebrow.toUpperCase()}</Text> : null}
        <Text style={[type.h1, eyebrow ? s.title : null]} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {right ? <View style={s.right}>{right}</View> : null}
    </View>
  );
}
