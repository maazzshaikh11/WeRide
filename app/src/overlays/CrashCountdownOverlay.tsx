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
import { useResponsive } from '../theme/responsive';
import { CAP } from '../theme/textPolicy';
import HazardStripes from './HazardStripes';
import OverlayFrame from './OverlayFrame';

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
  const { isShortHeight, isCompactWidth, usableHeight } = useResponsive();
  // short screens: a smaller ring and headline; the two answers stay big, pinned at the bottom
  const ring = usableHeight < 600 ? 120 : isShortHeight ? 150 : 200;
  const headline = usableHeight < 600 ? 38 : isShortHeight || isCompactWidth ? 44 : 54;
  const okH = isShortHeight ? 76 : 92;
  const sosH = isShortHeight ? 56 : 64;
  return (
    <View style={st.root} testID="overlay-CrashCountdown" accessibilityViewIsModal>
      <HazardStripes style={[StyleSheet.absoluteFill, { opacity: 0.12 }]} />
      <OverlayFrame
        bg={YELLOW}
        paddingTop={top + (isShortHeight ? 8 : 23)}
        centerContent
        dock={
          <>
            <PressableScale onPress={imOk} disabled={sending} accessibilityRole="button" accessibilityLabel="I’m OK, cancel the countdown" style={[st.ok, { height: okH }]} testID="crash-ok">
              <Text style={[type.button, { color: YELLOW, fontSize: 30, lineHeight: 34 }]} maxFontSizeMultiplier={CAP.hud}>I’m OK</Text>
            </PressableScale>
            <PressableScale onPress={() => send(false)} disabled={sending} accessibilityRole="button" accessibilityLabel="Send SOS now" style={[st.sos, { height: sosH }]} testID="crash-sos">
              <Text style={[type.button, { color: Plates.red.fg, fontSize: 18, lineHeight: 22 }]} maxFontSizeMultiplier={CAP.hud}>Send SOS now</Text>
            </PressableScale>
          </>
        }
      >
        <View style={{ alignItems: 'center' }}>
          <Text style={[type.label, { color: INK, letterSpacing: 2.75, textAlign: 'center' }]}>HARD IMPACT DETECTED</Text>
          <Text style={[type.display, { color: INK, fontSize: headline, lineHeight: headline, letterSpacing: -headline * 0.035, textAlign: 'center', marginTop: isShortHeight ? 8 : 16 }]} accessibilityRole="header" maxFontSizeMultiplier={CAP.fixed}>
            {'Are you\nOK?'}
          </Text>
          <View style={{ marginTop: isShortHeight ? 14 : 26 }} accessible accessibilityLabel={`${left} seconds until your SOS is sent automatically`} accessibilityLiveRegion="polite">
            <Ring size={ring} value={(CRASH_COUNTDOWN_S - left) / CRASH_COUNTDOWN_S} color={INK} stroke={7}>
              <Text style={[type.num, { color: INK, fontSize: Math.round(ring * 0.42), lineHeight: Math.round(ring * 0.45), letterSpacing: -2.5 }]} testID="crash-seconds" maxFontSizeMultiplier={CAP.fixed}>{left}</Text>
            </Ring>
          </View>
          <Text style={[type.bodyStrong, { color: INK, marginTop: isShortHeight ? 10 : 16, textAlign: 'center' }]}>
            {sending ? 'Sending your SOS…' : 'SOS sends itself when this hits zero.'}
          </Text>
        </View>
      </OverlayFrame>
    </View>
  );
}

const st = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: YELLOW, overflow: 'hidden' },
  ok: { borderRadius: 26, backgroundColor: INK, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  sos: { borderRadius: 20, backgroundColor: Plates.red.bg, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
});
