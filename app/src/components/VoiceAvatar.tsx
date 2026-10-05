/**
 * VoiceAvatar — participant avatar with speaking ring pulse (spec §3.5).
 * ringPulse animation: scale 1→1.28, opacity 0.9→0, 1000ms infinite loop
 * (native driver); the green border fades in with it. Reduced motion: static ring.
 * Initials are dark on the rider colour for contrast on every palette entry.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { WeRideColors, WeRideSpacing } from '../theme/theme';
import { type } from '../theme/typography';
import { useReducedMotion } from '../ui';

interface Props {
  initials: string;
  color: string;
  name: string;
  isYou?: boolean;
  speaking?: boolean;
}

export default function VoiceAvatar({ initials, color, name, isYou, speaking }: Props) {
  const reduced = useReducedMotion();
  const ring = useRef(new Animated.Value(0)).current;
  const lit = useRef(new Animated.Value(speaking ? 1 : 0)).current;
  const label = isYou ? 'You' : name;

  // Green border fades in/out with speaking (opacity overlay, native driver).
  useEffect(() => {
    if (reduced) {
      lit.setValue(speaking ? 1 : 0);
      return;
    }
    const anim = Animated.timing(lit, { toValue: speaking ? 1 : 0, duration: 160, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [speaking, reduced, lit]);

  // Pulsing ring: scale 1 → 1.28, fading out, looping while speaking.
  useEffect(() => {
    if (speaking && !reduced) {
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
  }, [speaking, reduced, ring]);

  return (
    <View style={styles.wrap} accessible accessibilityLabel={speaking ? `${label}, speaking` : label}>
      <View style={styles.ringWrap}>
        {speaking && (
          <Animated.View
            style={[
              styles.ring,
              reduced
                ? { opacity: 0.6 }
                : {
                    opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
                    transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] }) }],
                  },
            ]}
          />
        )}
        <View style={[styles.avatar, { backgroundColor: color }]}>
          <Text style={styles.initials}>{initials}</Text>
          <Animated.View pointerEvents="none" style={[styles.avatarSpeaking, { opacity: lit }]} />
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
  avatarSpeaking: {
    ...StyleSheet.absoluteFillObject,
    // Negative inset covers the avatar's own 2px border.
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: WeRideColors.green,
  },
  initials: { ...type.labelStrong, fontSize: 15, lineHeight: 20, letterSpacing: 0, color: WeRideColors.dark },
  name: { marginTop: WeRideSpacing.xs, textAlign: 'center' },
});
