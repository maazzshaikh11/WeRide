/**
 * CrashCountdownOverlay — the yellow "Are you OK?" screen (demo crashFlow). A 15 s ring counts down with a haptic tick
 * each second. "I'm OK" closes it (the crew was never alerted); "Send SOS now" or reaching zero sends the real SOS
 * (zero = automatic, so the SOS screen says "sent automatically").
 */
/* eslint-disable no-console -- failures here are logged for diagnostics; the rider is told through the UI */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plates } from '../theme/palettes';
import { useTheme } from '../theme/ThemeProvider';
import { PressableScale, Ring, haptic } from '../ui';
import { useAppStore } from '../store/appStore';
import { OverlayState, useOverlayStore } from '../store/overlayStore';
import { useToastStore } from '../store/toastStore';
import { triggerSosFlow } from '../services/sosFlowService';
import HazardStripes from './HazardStripes';

export const CRASH_COUNTDOWN_S = 15;
const INK = Plates.yellow.fg;
const YELLOW = Plates.yellow.bg;

export default function CrashCountdownOverlay({ state }: { state: OverlayState }) {
  if (state.kind !== 'crash') return null;
  return <Body />;
}

function Body() {
  const { type } = useTheme();
  const insets = useSafeAreaInsets();
  const [left, setLeft] = useState(CRASH_COUNTDOWN_S);
  const [sending, setSending] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const done = useRef(false);
  const count = useRef(CRASH_COUNTDOWN_S);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const send = useCallback((auto: boolean) => {
    if (done.current) return;
    done.current = true;
    stop();
    setSending(true);
    const groupId = useAppStore.getState().groupId;
    if (!groupId) {
      useOverlayStore.getState().hide();
      useToastStore.getState().push('Join a ride first, then SOS can reach your crew. Call 112 if you need help.', 'warn');
      return;
    }
    triggerSosFlow(groupId, { auto }).catch((e) => console.warn('[CrashCountdown] SOS failed:', e));
  }, []);

  useEffect(() => {
    haptic('warning');
    timer.current = setInterval(() => {
      count.current -= 1;
      setLeft(count.current);
      if (count.current > 0) haptic('select');
    }, 1000);
    return stop;
  }, []);

  useEffect(() => {
    if (left === 0) {
      haptic('heavy');
      send(true);
    }
  }, [left, send]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const imOk = () => {
    if (done.current) return;
    done.current = true;
    stop();
    useOverlayStore.getState().hide();
    useToastStore.getState().push('Glad you’re OK ∙ Crew was never alerted', 'success');
  };

  const top = Math.max(insets.top, 24);
  return (
    <View style={st.root} testID="overlay-CrashCountdown" accessibilityViewIsModal>
      <HazardStripes style={[StyleSheet.absoluteFill, { opacity: 0.12 }]} />
      <View style={[st.col, { paddingTop: top + 23, paddingBottom: 34 }]}>
        <Text style={[type.label, { color: INK, letterSpacing: 2.75 }]}>HARD IMPACT DETECTED</Text>
        <Text style={[type.display, { color: INK, fontSize: 54, lineHeight: 54, letterSpacing: -1.9, textAlign: 'center', marginTop: 16 }]} accessibilityRole="header">
          {'Are you\nOK?'}
        </Text>
        <View style={{ marginTop: 26 }} accessible accessibilityLabel={`${left} seconds until your SOS is sent automatically`} accessibilityLiveRegion="polite">
          <Ring size={200} value={(CRASH_COUNTDOWN_S - left) / CRASH_COUNTDOWN_S} color={INK} stroke={7}>
            <Text style={[type.num, { color: INK, fontSize: 84, lineHeight: 90, letterSpacing: -2.5 }]} testID="crash-seconds">{left}</Text>
          </Ring>
        </View>
        <Text style={[type.bodyStrong, { color: INK, marginTop: 16, textAlign: 'center' }]}>
          {sending ? 'Sending your SOS…' : 'SOS sends itself when this hits zero.'}
        </Text>
        <View style={{ flex: 1 }} />
        <PressableScale onPress={imOk} disabled={sending} accessibilityRole="button" accessibilityLabel="I’m OK, cancel the countdown" style={st.ok} testID="crash-ok">
          <Text style={[type.button, { color: YELLOW, fontSize: 30, lineHeight: 34 }]}>I’m OK</Text>
        </PressableScale>
        <PressableScale onPress={() => send(false)} disabled={sending} accessibilityRole="button" accessibilityLabel="Send SOS now" style={st.sos} testID="crash-sos">
          <Text style={[type.button, { color: Plates.red.fg, fontSize: 18, lineHeight: 22 }]}>Send SOS now</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: YELLOW, overflow: 'hidden' },
  col: { flex: 1, paddingHorizontal: 20, alignItems: 'center' },
  ok: { height: 92, borderRadius: 26, backgroundColor: INK, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  sos: { height: 64, borderRadius: 20, backgroundColor: Plates.red.bg, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
});
