/**
 * NetworkBanner — connection status banner (spec §3.3.5).
 * States: lost (gold) / recovered (green). Auto-dismiss recovered after 2.5s.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { WeRideColors, WeRideFonts } from '../theme/theme';

interface Props {
  state: 'lost' | 'recovered';
  riderName: string;
  onDismiss?: () => void;
}

export default function NetworkBanner({ state, riderName, onDismiss }: Props) {
  const slide = useRef(new Animated.Value(0)).current;
  const isLost = state === 'lost';

  useEffect(() => {
    Animated.timing(slide, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    if (!isLost) {
      const t = setTimeout(() => onDismiss?.(), 2500);
      return () => clearTimeout(t);
    }
  }, [slide, isLost, onDismiss]);

  return (
    <Animated.View
      style={[
        styles.banner,
        { borderColor: isLost ? '#FBBF2455' : '#22C55E55' },
        {
          opacity: slide,
          transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }],
        },
      ]}
    >
      <Text style={styles.icon}>{isLost ? '📡' : '✅'}</Text>
      <Text style={[styles.text, { color: isLost ? '#fde68a' : '#bbf7d0' }]}>
        {isLost
          ? `${riderName} lost connection. Showing last known location.`
          : `${riderName} is active again. Position resynced.`}
      </Text>
      {!isLost && <Pressable onPress={onDismiss} hitSlop={12} accessibilityLabel="Dismiss notification"><Text style={styles.close}>✕</Text></Pressable>}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#14140bf5',
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginHorizontal: 12,
  },
  icon: { fontSize: 14 },
  text: { flex: 1, fontFamily: WeRideFonts.body, fontSize: 10.5, fontWeight: '600' },
  close: { color: '#888888', fontSize: 13 },
});