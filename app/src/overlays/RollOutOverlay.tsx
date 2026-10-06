/**
 * RollOutOverlay — the demo's roll-out countdown ("<LEAD> ∙ LEAD", "Rolling out", 3 ∙ 2 ∙ 1 with the pop, "Phones lock
 * to Road mode"), then it hides itself and opens Live. Also starts the ride recorder (once per ride).
 *  - state.next === 'Live': the BREAK OVER variant from the Stop screen (2 ∙ 1, back to the Live screen underneath).
 *  - otherwise: the ride just turned live (roll call or someone else's Roll out): reset to Live.
 * Raised by RideLifecycleBridge / the Stop screen through overlayStore.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import { CAP } from '../theme/textPolicy';
import { withAlpha } from '../theme/palettes';
import { useReducedMotion } from '../ui';
import { useOverlayStore } from '../store/overlayStore';
import type { OverlayState } from '../store/overlayStore';
import { useRidesStore } from '../store/ridesStore';
import { navigateRoot, resetRoot } from '../navigation/navigationRef';
import { startRecorderOnce } from '../services/rideFlow';

type RollState = Extract<OverlayState, { kind: 'rollout' }>;

const STEP_MS = 900;
const END_MS = 850;

export default function RollOutOverlay({ state }: { state: OverlayState }) {
  const st = state as RollState;
  const breakOver = st.next === 'Live';
  const { road, roadType } = useTheme();
  const reduced = useReducedMotion();
  const hide = useOverlayStore((s) => s.hide);
  const [n, setN] = useState(breakOver ? 2 : 3);
  const pop = useRef(new Animated.Value(0)).current;
  const done = useRef(false);
  const s = useStyles(({ road: r }) => ({
    root: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: withAlpha(r.bg, 0.94), zIndex: 200 },
  }));

  // recorder: the ride starts being recorded the moment the countdown starts
  useEffect(() => {
    if (breakOver) return;
    const ride = useRidesStore.getState().rides.find((r) => r.id === st.groupId) ?? null;
    startRecorderOnce(ride);
  }, [breakOver, st.groupId]);

  // 3 ∙ 2 ∙ 1, then go
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const finish = () => {
      if (done.current) return;
      done.current = true;
      hide();
      if (breakOver) navigateRoot('Live', { groupId: st.groupId });
      else resetRoot('Live', { groupId: st.groupId });
    };
    const tick = (value: number) => {
      if (value > 1) t = setTimeout(() => { setN(value - 1); tick(value - 1); }, STEP_MS);
      else t = setTimeout(finish, END_MS);
    };
    tick(breakOver ? 2 : 3);
    return () => clearTimeout(t);
  }, [breakOver, st.groupId, hide]);

  // the demo's `cdp`: each number pops in from 1.5x and settles at .9x
  useEffect(() => {
    if (reduced) {
      pop.setValue(1);
      return;
    }
    pop.setValue(0);
    Animated.timing(pop, { toValue: 1, duration: STEP_MS, useNativeDriver: true }).start();
  }, [n, reduced, pop]);

  const scale = reduced ? 1 : pop.interpolate({ inputRange: [0, 1], outputRange: [1.5, 0.9] });
  const opacity = reduced ? 1 : pop.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 0.9] });
  const label = breakOver ? 'BREAK OVER' : `${st.leadName ? `${st.leadName.toUpperCase()} ∙ ` : ''}LEAD`;

  return (
    <View style={s.root} testID="overlay-RollOut" accessible accessibilityLiveRegion="polite" accessibilityLabel={`${breakOver ? 'Break over' : 'Rolling out'}. ${n}`}>
      <Text style={[roadType.label, { color: road.pri, letterSpacing: 3.3, fontSize: 11 }]} maxFontSizeMultiplier={CAP.hud}>{label}</Text>
      {breakOver ? null : <Text style={[roadType.h1, { color: road.ink }]} maxFontSizeMultiplier={CAP.hud}>Rolling out</Text>}
      <Animated.Text testID="rollout-count" maxFontSizeMultiplier={CAP.fixed} style={[roadType.num, { fontSize: 190, lineHeight: 190, letterSpacing: -11.4, color: road.pri, transform: [{ scale }], opacity }]}>
        {n}
      </Animated.Text>
      {breakOver ? null : <Text style={[roadType.sm, { color: road.ink2 }]}>Phones lock to Road mode</Text>}
    </View>
  );
}
