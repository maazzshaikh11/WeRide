/**
 * ScreenHeader — eyebrow + title pattern used across screens (spec §3.3.1).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WeRideColors, WeRideFonts } from '../theme/theme';

interface Props {
  eyebrow: string;
  title: string;
  right?: React.ReactNode;
}

export default function ScreenHeader({ eyebrow, title, right }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.textWrap}>
        <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      {right ? <View>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  textWrap: { flex: 1 },
  eyebrow: {
    fontFamily: WeRideFonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: WeRideColors.primary,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: WeRideFonts.heading,
    fontSize: 24,
    color: WeRideColors.text,
    marginTop: 2,
  },
});