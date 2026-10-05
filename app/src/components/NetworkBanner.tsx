/**
 * NetworkBanner — connection status banner (spec §3.3.5).
 * States: lost (gold) / recovered (green). Auto-dismiss recovered after 2.5s.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { WeRideColors, WeRideRadius } from '../theme/theme';
import { type } from '../theme/typography';

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
        { borderColor: isLost ? '#FBBF2466' : '#22C55E66' },
        {
          opacity: slide,
          transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }],
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: isLost ? WeRideColors.gold : WeRideColors.green }]} />
      <Text style={styles.text}>
        {isLost
          ? `${riderName} lost connection. Showing last known location.`
          : `${riderName} is active again. Position resynced.`}
      </Text>
      {!isLost && (
        <Pressable
          style={styles.close}
          onPress={onDismiss}
          hitSlop={8}
          accessibilityLabel="Dismiss notification"
          accessibilityRole="button"
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#111111F5',
    borderWidth: 1,
    borderRadius: WeRideRadius.xl,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    marginHorizontal: 16,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { ...type.caption, color: WeRideColors.text, flex: 1 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { ...type.body, color: WeRideColors.textSub },
});
