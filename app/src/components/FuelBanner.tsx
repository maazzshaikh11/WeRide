/**
 * FuelBanner — low-fuel warning banner (spec §3.3.4). Dismissible.
 * bannerSlide animation: translateY -120% → 0, 400ms.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { WeRideFonts } from '../theme/theme';

interface Props {
  message: string;      // e.g. "Nearest fuel 62 km ahead"
  onDismiss: () => void;
}

export default function FuelBanner({ message, onDismiss }: Props) {
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [slide]);

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          opacity: slide,
          transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-120, 0] }) }],
        },
      ]}
    >
      <Text style={styles.icon}>⛽</Text>
      <Text style={styles.text}>{message}</Text>
      <Pressable onPress={onDismiss} hitSlop={12} accessibilityLabel="Dismiss fuel warning">
        <Text style={styles.close}>✕</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1a1404f0',
    borderWidth: 1,
    borderColor: '#FBBF2444',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 12,
  },
  icon: { fontSize: 16 },
  text: { flex: 1, fontFamily: WeRideFonts.body, fontSize: 10.5, color: '#fde68a' },
  close: { color: '#fde68a', opacity: 0.6, fontSize: 13 },
});