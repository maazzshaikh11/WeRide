/**
 * VoiceAvatar — rider tile (demo `.rtile`): 22-radius card, 56 px avatar, name,
 * and a small status line. Speaking: the tile gets a 3 px `ok` rim (fades in)
 * and the avatar a pulsing `ok` ring (scale 1→1.28, 1000ms loop, native
 * driver). Reduced motion: static ring.
 * The status line only appears while speaking: there is no real per-rider
 * state to show otherwise, so nothing is invented.
 * Initials are dark on the rider colour for contrast on every palette entry;
 * "You" uses the accent (demo `.av.me`).
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { WeRideFonts } from '../theme/theme';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from '../ui';

interface Props {
  initials: string;
  color: string;
  name: string;
  isYou?: boolean;
  speaking?: boolean;
}

const AV = 56;

export default function VoiceAvatar({ initials, color, name, isYou, speaking }: Props) {
  const { colors, type } = useTheme();
  const s = useStyles(({ colors: c }) => ({
    tile: {
      width: '100%', borderRadius: 22, backgroundColor: c.card, padding: 14, alignItems: 'center', gap: 8,
      borderWidth: 2, borderColor: c.line,
    },
    rim: { position: 'absolute', top: -2, left: -2, right: -2, bottom: -2, borderRadius: 22, borderWidth: 3, borderColor: c.ok },
    avWrap: { width: AV, height: AV, alignItems: 'center', justifyContent: 'center' },
    ring: { position: 'absolute', width: AV + 12, height: AV + 12, borderRadius: (AV + 12) / 2, borderWidth: 2, borderColor: c.ok },
    avatar: { width: AV, height: AV, borderRadius: AV / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: c.bg },
    nm: { fontFamily: WeRideFonts.extraBold, fontSize: 16, lineHeight: 19, textAlign: 'center', color: c.ink },
  }));
  const reduced = useReducedMotion();
  const ring = useRef(new Animated.Value(0)).current;
  const lit = useRef(new Animated.Value(speaking ? 1 : 0)).current;
  const label = isYou ? 'You' : name;

  // Tile rim fades in/out with speaking (opacity overlay, native driver).
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
      const loop = Animated.loop(Animated.timing(ring, { toValue: 1, duration: 1000, useNativeDriver: true }));
      loop.start();
      return () => loop.stop();
    }
    ring.setValue(0);
  }, [speaking, reduced, ring]);

  return (
    <View style={s.tile} accessible accessibilityLabel={speaking ? `${label}, speaking` : label}>
      <Animated.View pointerEvents="none" style={[s.rim, { opacity: lit }]} />
      <View style={s.avWrap}>
        {speaking && (
          <Animated.View
            style={[
              s.ring,
              reduced
                ? { opacity: 0.6 }
                : {
                    opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
                    transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] }) }],
                  },
            ]}
          />
        )}
        <View style={[s.avatar, { backgroundColor: isYou ? colors.pri : color }]}>
          <Text
            style={{
              fontFamily: WeRideFonts.extraBold, fontSize: 18, lineHeight: 20, letterSpacing: 0.36,
              color: isYou ? colors.priInk : '#10110E',
            }}
          >
            {initials}
          </Text>
        </View>
      </View>
      <Text style={s.nm} numberOfLines={1}>
        {label}
      </Text>
      {speaking ? <Text style={[type.pill, { color: colors.ok, letterSpacing: 1.1 }]}>SPEAKING</Text> : null}
    </View>
  );
}
