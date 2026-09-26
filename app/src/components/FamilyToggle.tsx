/**
 * FamilyToggle — sharing toggle card switch (spec §3.6).
 * toggleSwitch animation: bg color, knob translateX 18px, 200ms.
 */
import React, { useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { WeRideColors, WeRideFonts } from '../theme/theme';

interface Props {
  enabled: boolean;
  onToggle: (next: boolean) => void;
}

export default function FamilyToggle({ enabled, onToggle }: Props) {
  const knob = useRef(new Animated.Value(enabled ? 1 : 0)).current;

  const toggle = () => {
    const next = !enabled;
    Animated.timing(knob, { toValue: next ? 1 : 0, duration: 200, useNativeDriver: true }).start();
    onToggle(next);
  };

  return (
    <View style={styles.card}>
      <View style={styles.textWrap}>
        <Text style={styles.title}>Share my live ride status</Text>
        <Text style={styles.subtitle}>
          {enabled
            ? 'Mom, Dad and Hritika can see your live location, speed and stop history until the ride ends.'
            : 'Location sharing is paused — no one can see your live position right now.'}
        </Text>
      </View>
      <Pressable
        onPress={toggle}
        accessibilityLabel={enabled ? 'Family sharing on. Tap to pause' : 'Family sharing paused. Tap to turn on'}
        accessibilityRole="switch"
        accessibilityState={{ checked: enabled }}
      >
        <Animated.View style={[styles.track, { backgroundColor: enabled ? WeRideColors.green : '#333333' }]}>
          <Animated.View
            style={[
              styles.knob,
              { transform: [{ translateX: knob.interpolate({ inputRange: [0, 1], outputRange: [0, 18] }) }] },
            ]}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: 14,
    padding: 13,
    marginBottom: 12,
  },
  textWrap: { flex: 1 },
  title: { fontFamily: WeRideFonts.body, fontSize: 13, fontWeight: '700', color: WeRideColors.white },
  subtitle: { fontFamily: WeRideFonts.body, fontSize: 10, color: WeRideColors.textSub, marginTop: 3, lineHeight: 14 },
  track: {
    width: 42,
    height: 24,
    borderRadius: 99,
    padding: 2,
  },
  knob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: WeRideColors.white,
  },
});