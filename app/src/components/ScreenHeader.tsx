/**
 * ScreenHeader — title block shared by the tab screens.
 * Optional eyebrow (only when it carries information, e.g. the ride name),
 * then the screen title, with an optional status element on the right.
 * Horizontal gutter is the screen's job (16), not the header's.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { type } from '../theme/typography';
import { WeRideSpacing } from '../theme/theme';

interface Props {
  eyebrow?: string;
  title: string;
  right?: React.ReactNode;
}

export default function ScreenHeader({ eyebrow, title, right }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.textWrap}>
        {eyebrow ? <Text style={type.eyebrow}>{eyebrow.toUpperCase()}</Text> : null}
        <Text style={type.title} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: WeRideSpacing.md,
    paddingTop: WeRideSpacing.lg,
    paddingBottom: WeRideSpacing.lg,
    minHeight: 44,
  },
  textWrap: { flex: 1 },
  right: { flexShrink: 0 },
});
