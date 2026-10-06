/**
 * Privacy / FL status line — owned by Person D (spec §4.5).
 * One-line caption rendered INSIDE the map header (under the ride name), not a
 * floating pill over the map. Default: privacy message.
 * FL round completed: "FL round {N} done · {Y} clients" from FlRoundLogger.
 * Information-only, no interaction. A changed message cross-fades in (opacity
 * only, so the header never shifts).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { flStatusLine } from '../../../services/flService';
import { usePrefsStore } from '../../../store/prefsStore';
import { Motion, useReducedMotion } from '../../../ui';

interface FlBadgeState {
  message: string;
}

export default function FlStatusOverlay() {
  const { type } = useTheme();
  const learn = usePrefsStore((s) => s.prefs.learn);
  const [state, setState] = useState<FlBadgeState>({
    message: 'Ride data stays on-device',
  });

  useEffect(() => {
    // Opted out of "Improve ETAs for everyone": no round status, just the privacy line.
    const line = learn ? flStatusLine() : null;
    setState({ message: line ?? 'Ride data stays on-device' });
  }, [learn]);

  const reduced = useReducedMotion();
  const fade = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) return;
    fade.setValue(0);
    const anim = Animated.timing(fade, { toValue: 1, duration: Motion.enter.durationMs, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [state.message, fade, reduced]);

  return (
    <Animated.Text style={[type.listSub, { opacity: fade }]} numberOfLines={1}>
      {state.message}
    </Animated.Text>
  );
}
