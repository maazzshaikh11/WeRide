/**
 * VoiceAvatar — participant avatar with speaking ring pulse (spec §3.5).
 * ringPulse animation: scale 1→1.28, opacity 0.9→0, 1000ms infinite loop.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { WeRideColors, WeRideFonts } from '../theme/theme';

interface Props {
  initials: string;
  color: string;
  name: string;
  isYou?: boolean;
  speaking?: boolean;
  isLeader?: boolean;
}

export default function VoiceAvatar({ initials, color, name, isYou, speaking, isLeader }: Props) {
  const ring = useRef(new Animated.Value(0)).current;

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
    <View style={styles.wrap}>
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
        {isLeader && (
          <View style={styles.leaderBadge}>
            <Text style={styles.leaderIcon}>👑</Text>
          </View>
        )}
      </View>
      <Text style={[styles.name, isYou && styles.nameYou]}>{isYou ? 'You' : name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', width: 100 },
  ringWrap: { width: 66, height: 66, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  ring: {
    position: 'absolute',
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2,
    borderColor: WeRideColors.green,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: '#111111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarSpeaking: { backgroundColor: WeRideColors.greenDim },
  initials: { fontFamily: WeRideFonts.mono, fontSize: 15, fontWeight: '700', color: WeRideColors.white },
  leaderBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: WeRideColors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaderIcon: { fontSize: 8 },
  name: { fontFamily: WeRideFonts.body, fontSize: 9.5, color: WeRideColors.textSub, marginTop: 4, textAlign: 'center' },
  nameYou: { fontWeight: '700', color: WeRideColors.text },
});