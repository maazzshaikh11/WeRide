/**
 * Fab — shared FAB press behavior (spec §3.3.6, §5.1).
 * 48 px circle on the dark2 surface with a hairline border. Built on
 * PressableScale (scale + dim on press, spring release, haptic).
 *
 * `active` does not hard-swap: an accent ring cross-fades over the hairline
 * border, and when `activeChildren` is given the glyph cross-fades to it. Both
 * run on the native driver (opacity only).
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { WeRideColors } from '../theme/theme';
import { HapticKind, PressableScale, PressableScaleProps, useReducedMotion } from '../ui';

export const FAB_SIZE = 48;
const ACTIVE_FADE_MS = 180;

interface Props extends Omit<PressableScaleProps, 'children' | 'haptic'> {
  size?: number;
  /** Highlights the border with the accent (e.g. follow mode on). */
  active?: boolean;
  /** Accent for the active ring (default the brand primary). */
  activeColor?: string;
  /** Press haptic; 'select' by default, `false` for none. */
  haptic?: HapticKind | false;
  children: React.ReactNode;
  /** Glyph shown (cross-faded) while `active`; falls back to `children`. */
  activeChildren?: React.ReactNode;
}

export default function Fab({
  size = FAB_SIZE,
  active = false,
  activeColor = WeRideColors.primary,
  haptic = 'select',
  children,
  activeChildren,
  style,
  ...rest
}: Props) {
  const reduced = useReducedMotion();
  const on = useRef(new Animated.Value(active ? 1 : 0)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) {
      on.setValue(active ? 1 : 0);
      return;
    }
    const anim = Animated.timing(on, { toValue: active ? 1 : 0, duration: ACTIVE_FADE_MS, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [active, on, reduced]);

  const off = on.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <PressableScale
      {...rest}
      haptic={haptic}
      style={[{ width: size, height: size, borderRadius: size / 2 }, styles.surface, style]}
    >
      {activeChildren ? (
        <>
          <Animated.View style={[styles.layer, { opacity: off }]} pointerEvents="none">
            {children}
          </Animated.View>
          <Animated.View style={[styles.layer, { opacity: on }]} pointerEvents="none">
            {activeChildren}
          </Animated.View>
        </>
      ) : (
        <View pointerEvents="none">{children}</View>
      )}
      {/* Accent ring over the hairline border (inset -1 so it replaces it exactly). */}
      <Animated.View
        pointerEvents="none"
        style={[styles.ring, { borderRadius: size / 2, borderColor: activeColor, opacity: on }]}
      />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  surface: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: WeRideColors.dark2,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  layer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  ring: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderWidth: 1,
  },
});
