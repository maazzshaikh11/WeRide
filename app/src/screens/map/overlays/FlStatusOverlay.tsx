/**
 * Privacy / FL status line — owned by Person D (spec §4.5).
 * One-line caption rendered INSIDE the map header (under the ride name), not a
 * floating pill over the map. Default: privacy message.
 * FL round completed: "FL round {N} done · {Y} clients" from FlRoundLogger.
 * Information-only, no interaction. A changed message cross-fades in (opacity
 * only, so the header never shifts).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { type } from '../../../theme/typography';
import { getFlData } from '../../../services/localStorage';
import { FlRoundLogger } from '@flvoice/fl/flRoundLogger';
import { Motion, useReducedMotion } from '../../../ui';

interface FlBadgeState {
  message: string;
}

export default function FlStatusOverlay() {
  const [state, setState] = useState<FlBadgeState>({
    message: 'Ride data stays on-device',
  });

  useEffect(() => {
    try {
      const logger = new FlRoundLogger(getFlData());
      const latest = logger.latestRound();
      if (latest) {
        setState({
          message: `FL round ${latest.roundId} done · ${latest.participants} clients`,
        });
      }
    } catch {
      // FL state unavailable — keep default privacy message
    }
  }, []);

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
    <Animated.Text style={[styles.text, { opacity: fade }]} numberOfLines={1}>
      {state.message}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  text: { ...type.caption },
});
