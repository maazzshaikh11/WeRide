/**
 * VoiceAvatar — participant avatar with speaking ring pulse (spec §3.5).
 * ringPulse animation: scale 1→1.28, opacity 0.9→0, 1000ms infinite loop.
 * Initials are dark on the rider colour for contrast on every palette entry.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { WeRideColors, WeRideSpacing } from '../theme/theme';
import { type } from '../theme/typography';

interface Props {
  initials: string;
  color: string;
  name: string;
  isYou?: boolean;
  speaking?: boolean;
}

export default function VoiceAvatar({ initials, color, name, isYou, speaking }: Props) {
  const ring = useRef(new Animated.Value(0)).current;
  const label = isYou ? 'You' : name;

  useEffect(() => {
    if (speaking) {
      const loop = Animated.loop(
        Animated.timing(ring, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => loop.stop();
    }
    ring.setValue(0);
  }, [speaking, ring]);

  return (
    <View style={styles.wrap} accessible accessibilityLabel={speaking ? `${label}, speaking` : label}>
      <View style={styles.ringWrap}>
        {speaking && (
          <Animated.View
            style={[
              styles.ring,
              {
                opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
                transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] }) }],
              },
            ]}
          />
        )}
        <View style={[styles.avatar, { backgroundColor: color }, speaking && styles.avatarSpeaking]}>
          <Text style={styles.initials}>{initials}</Text>
        </View>
      </View>
      <Text style={[isYou ? type.bodyStrong : type.caption, styles.name]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', width: '100%' },
  ringWrap: { width: 68, height: 68, justifyContent: 'center', alignItems: 'center' },
  ring: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: WeRideColors.green,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: WeRideColors.dark2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarSpeaking: { borderColor: WeRideColors.green },
  initials: { ...type.labelStrong, fontSize: 15, lineHeight: 20, letterSpacing: 0, color: WeRideColors.dark },
  name: { marginTop: WeRideSpacing.xs, textAlign: 'center' },
});
