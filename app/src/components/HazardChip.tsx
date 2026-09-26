/**
 * HazardChip — report type chip (spec §3.7, §5.1 ChipButton).
 * chipPress animation: scale 1 → 0.94, 150ms.
 */
import React, { useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { WeRideColors, WeRideFonts } from '../theme/theme';

interface Props {
  emoji: string;
  label: string;
  onPress: () => void;
}

export default function HazardChip({ emoji, label, onPress }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const press = () => {
    Animated.timing(scale, { toValue: 0.94, duration: 150, useNativeDriver: true }).start(() => {
      Animated.timing(scale, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      onPress();
    });
  };

  return (
    <Pressable onPress={press} accessibilityLabel={`Report hazard: ${label}`} accessibilityRole="button">
      <Animated.View style={[styles.chip, { transform: [{ scale }] }]}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={styles.label}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 4,
  },
  emoji: { fontSize: 14 },
  label: { fontFamily: WeRideFonts.body, fontSize: 9.5, fontWeight: '600', color: WeRideColors.text },
});