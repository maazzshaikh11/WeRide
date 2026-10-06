/**
 * AvatarStack — overlapping mini-avatars (demo `.avs`: 28 px `.av.sm`, -9 px
 * overlap, 2.5 px ring in the page background, initials on the rider colour).
 *
 * A rider that joins after the stack is on screen pops in (scale 0 -> 1 on a
 * spring, transform only so the layout never shifts). Avatars present at first
 * render are simply there.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { avatarColor } from '../theme/palettes';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import { Avatar, Motion, useReducedMotion } from '../ui';

interface Props {
  names: string[];      // rider identifiers — initials derived
  max?: number;        // max shown (default 4)
}

const SIZE = 28;
const OVERLAP = -9;

function initials(name: string): string {
  return name.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() || '??';
}

/** Avatar bubble; animates in only when mounted with `pop`. */
function PopAvatar({ pop, style, children }: { pop: boolean; style: object | null; children: React.ReactNode }) {
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

  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}

export default function AvatarStack({ names, max = 4 }: Props) {
  const { colors, type } = useTheme();
  const s = useStyles(({ colors: c }) => ({
    row: { flexDirection: 'row', alignItems: 'center' },
    overflow: {
      width: SIZE, height: SIZE, borderRadius: SIZE / 2, marginLeft: OVERLAP, alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.card2, borderWidth: 2.5, borderColor: c.bg,
    },
  }));
  const shown = names.slice(0, max);
  // null until the first render has been committed: nobody pops on first paint.
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    seen.current = new Set(shown);
  });

  if (shown.length === 0) return null;
  const known = seen.current;
  return (
    <View style={s.row}>
      {shown.map((name, i) => (
        <PopAvatar key={name} pop={known !== null && !known.has(name)} style={i === 0 ? null : { marginLeft: OVERLAP }}>
          <Avatar initials={initials(name)} color={avatarColor(i)} size={SIZE} covered={i < shown.length - 1 || names.length > max ? -OVERLAP : 0} />
        </PopAvatar>
      ))}
      {names.length > max ? (
        <View style={s.overflow}>
          <Text style={[type.pill, { color: colors.ink2, letterSpacing: 0 }]}>+{names.length - max}</Text>
        </View>
      ) : null}
    </View>
  );
}
