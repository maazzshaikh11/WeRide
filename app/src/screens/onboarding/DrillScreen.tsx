/**
 * Drill — the SOS practice (demo `drill`): dark, hazard-striped DRILL banner, the red SOS button inside a progress
 * ring. Hold time is the rider's own `prefs.hold_ms`. Releasing early shows "RELEASED ∙ NOTHING SENT"; a full hold
 * turns everything green with "SOS sent in X s" and what a real SOS would do (naming the rider's real first
 * contact). Nobody is ever alerted. Route param `fromSettings` (Me → Safety): Done goes back; otherwise Continue
 * → CrewStart.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Ring, Screen, TopBar, haptic, PressableScale } from '../../ui';
import { Plates } from '../../theme/palettes';
import { useTheme } from '../../theme/ThemeProvider';
import { useHoldMs, usePrefsStore } from '../../store/prefsStore';
import DarkScope from './parts/DarkScope';
import DrillBanner from './parts/DrillBanner';

const TICK_MS = 33;

export function holdHint(p: number): string {
  return p < 0.35 ? 'KEEP HOLDING' : p < 0.75 ? 'ALMOST' : 'HOLD…';
}

function DrillBody({ navigation, route }: { navigation: any; route?: { params?: { fromSettings?: boolean } } }) {
  const { colors, type } = useTheme();
  const holdMs = useHoldMs();
  const firstContact = usePrefsStore((s) => s.contacts[0]?.name);
  const fromSettings = Boolean(route?.params?.fromSettings);

  const [progress, setProgress] = useState(0);
  const [hint, setHint] = useState('HOLD');
  const [done, setDone] = useState(false);
  const doneRef = useRef(false);
  const holdingRef = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTick = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => () => {
    stopTick();
    if (hintTimer.current) clearTimeout(hintTimer.current);
  }, []);

  const complete = () => {
    stopTick();
    doneRef.current = true;
    holdingRef.current = false;
    setDone(true);
    setProgress(1);
    setHint('SENT');
    haptic('heavy');
  };

  const onPressIn = () => {
    if (doneRef.current || holdingRef.current) return;
    if (hintTimer.current) clearTimeout(hintTimer.current);
    holdingRef.current = true;
    setHint('KEEP HOLDING');
    const t0 = Date.now();
    timer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / holdMs);
      if (p >= 1) {
        complete();
        return;
      }
      setProgress(p);
      setHint(holdHint(p));
    }, TICK_MS);
  };

  const onPressOut = () => {
    if (doneRef.current || !holdingRef.current) return;
    holdingRef.current = false;
    stopTick();
    setProgress(0);
    setHint('RELEASED ∙ NOTHING SENT');
    hintTimer.current = setTimeout(() => {
      if (!doneRef.current) setHint('HOLD');
    }, 1400);
  };

  const secs = (holdMs / 1000).toFixed(1);
  const ringColor = done ? colors.ok : colors.ink;

  return (
    <Screen
      testID="screen-Drill"
      cta={
        <Button
          label={fromSettings ? 'Done' : 'Continue'}
          disabled={!done}
          onPress={() => (fromSettings ? navigation.goBack() : navigation.navigate('CrewStart'))}
          testID="drill-next"
        />
      }
    >
      <DrillBanner />
      <TopBar onBack={() => navigation.goBack()} style={{ marginTop: 12, marginBottom: 0 }} />
      <Text style={[type.h1, { marginTop: 16 }]} accessibilityRole="header">Practice your SOS.</Text>
      <Text style={[type.body, { marginTop: 8 }]}>Hold the button. Keep holding until it fills. That's the whole thing.</Text>

      <View style={{ alignSelf: 'center', marginTop: 38 }} testID="drill-stage">
        <Ring value={progress} size={236} color={ringColor} stroke={7}>
          <PressableScale
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            haptic={false}
            scaleTo={0.94}
            accessibilityRole="button"
            accessibilityLabel="SOS practice button"
            accessibilityHint={`Press and hold for ${secs} seconds. Nobody is alerted.`}
            accessibilityActions={[{ name: 'activate', label: 'Practise SOS' }]}
            onAccessibilityAction={() => !doneRef.current && complete()}
            testID="drill-button"
            style={{
              width: 184, height: 184, borderRadius: 92, alignItems: 'center', justifyContent: 'center',
              backgroundColor: done ? Plates.green.bg : Plates.red.bg,
            }}
          >
            <Text style={{ fontFamily: type.display.fontFamily, fontSize: 46, lineHeight: 50, letterSpacing: -1.4, color: '#FFFFFF' }}>SOS</Text>
            <Text style={[type.label, { color: '#FFFFFF', opacity: 0.85, marginTop: 4 }]} accessibilityLiveRegion="polite" testID="drill-hint">{hint}</Text>
          </PressableScale>
        </Ring>
      </View>

      <View style={{ marginTop: 34, minHeight: 150 }} testID="drill-result">
        {done ? (
          <View
            style={{ backgroundColor: Plates.green.bg, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 18 }}
            accessible
            accessibilityLiveRegion="polite"
            testID="drill-done-plate"
          >
            <Text style={[type.plateTitle, { color: Plates.green.fg }]}>{`SOS SENT IN ${secs} S`}</Text>
            <Text style={[type.plateSub, { color: Plates.green.fg, opacity: 0.85, marginTop: 4, lineHeight: 18 }]}>
              {`In a real SOS: your crew and ${firstContact || 'your contact'} get an alert with your live location. It queues and sends the moment you have signal.`}
            </Text>
            <View pointerEvents="none" style={{ position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderRadius: 14, borderWidth: 2, borderColor: Plates.green.rim, opacity: 0.92 }} />
          </View>
        ) : (
          <Text style={[type.sm, { textAlign: 'center' }]}>A tap does nothing. Gloves, vibration and a bumpy road can't set it off.</Text>
        )}
      </View>
    </Screen>
  );
}

export default function DrillScreen(props: any) {
  return (
    <DarkScope>
      <DrillBody navigation={props.navigation} route={props.route} />
    </DarkScope>
  );
}
