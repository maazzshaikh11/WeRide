/**
 * AvatarStack — overlapping mini-avatars (spec §3.3.8, §5.5).
 * 24×24 circles, -8px overlap, 2px sheet-coloured border, 11px mono initials.
 *
 * A rider that joins after the stack is on screen pops in (scale 0 -> 1 on a
 * spring, transform only so the layout never shifts). Avatars present at first
 * render are simply there.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { WeRideColors, riderColor } from '../theme/theme';
import { type } from '../theme/typography';
import { Motion, useReducedMotion } from '../ui';

interface Props {
  names: string[];      // rider identifiers — initials derived
  max?: number;        // max shown (default 4)
}

function initials(name: string): string {
  return name.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() || '??';
}

/** Avatar bubble; animates in only when mounted with `pop`. */
function PopAvatar({ pop, style, children }: { pop: boolean; style: object; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(pop ? 0 : 1)).current;

  useEffect(() => {
    if (!pop) return;
    if (reduced) {
      scale.setValue(1);
      return;
    }
    const anim = Animated.spring(scale, { toValue: 1, ...Motion.spring, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
    // Mount-only: `pop` is read once when the avatar first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Animated.View style={[styles.avatar, style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}

export default function AvatarStack({ names, max = 4 }: Props) {
  const shown = names.slice(0, max);
  // null until the first render has been committed: nobody pops on first paint.
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    seen.current = new Set(shown);
  });

  if (shown.length === 0) return null;
  const known = seen.current;
  return (
    <View style={styles.row}>
      {shown.map((name, i) => (
        <PopAvatar
          key={name}
          pop={known !== null && !known.has(name)}
          style={{ backgroundColor: riderColor(i), marginLeft: i === 0 ? 0 : -8 }}
        >
          <Text style={styles.initials}>{initials(name)}</Text>
        </PopAvatar>
      ))}
      {names.length > max ? (
        <View style={[styles.avatar, styles.overflow, { marginLeft: -8 }]}>
          <Text style={[styles.initials, { color: WeRideColors.textSub }]}>+{names.length - max}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: WeRideColors.dark2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overflow: { backgroundColor: WeRideColors.dark3 },
  initials: { ...type.labelStrong, letterSpacing: 0, color: WeRideColors.white },
});
