/**
 * AuthOtp — step 2 of 5 (demo `auth-otp`): six code boxes + the digit keypad. The 6th digit confirms the code with
 * Firebase; success resets to `Boot` (which sends new riders to Profile and onboarded riders to the Garage).
 * Resend has a real 60 s countdown; a wrong code shakes the boxes, an expired one asks for a new text.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { CodeBoxes, Keypad, Motion, PressableScale, Screen, Stepper, TopBar, haptic, useReducedMotion } from '../../ui';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import { AuthFlowError, confirmPhoneCode, pendingPhoneNumber, startPhoneSignIn } from '../../services/authService';
import { useSessionStore } from '../../store/sessionStore';

export const RESEND_SECONDS = 60;
export const CODE_LENGTH = 6;

/** "+919876543210" → "+91 98765 43210"; anything else is shown as given. */
export function formatPhone(e164: string | null): string {
  if (!e164) return 'your phone';
  const m = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}

/** "Resend in 0:24" */
export function resendLabel(seconds: number): string {
  return `Resend in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function useCountdown(start: number): [number, () => void] {
  const [left, setLeft] = useState(start);
  const [run, setRun] = useState(0);
  useEffect(() => {
    setLeft(start);
    const id = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(id);
  }, [run, start]);
  return [left, () => setRun((r) => r + 1)];
}

export default function AuthOtpScreen({ navigation }: any) {
  const { type } = useTheme();
  const s = useStyles(({ colors: c, type: t }) => ({
    metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, minHeight: 44 },
    err: { ...t.sm, color: c.bad, marginTop: 4 },
    resend: { minHeight: 44, justifyContent: 'center' },
  }));
  const reduced = useReducedMotion();
  const phone = useRef(pendingPhoneNumber()).current;
  const uid = useSessionStore((s2) => s2.uid);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [left, restart] = useCountdown(RESEND_SECONDS);
  const shake = useRef(new Animated.Value(0)).current;
  const done = useRef(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    navigation.reset({ index: 0, routes: [{ name: 'Boot' }] });
  }, [navigation]);

  // Android can verify the SMS by itself: the session appears without a code being typed.
  useEffect(() => {
    if (uid) finish();
  }, [uid, finish]);

  const shakeBoxes = () => {
    haptic('error');
    if (reduced) return;
    const d = Motion.shake.distance * 1.5;
    const step = (to: number) => Animated.timing(shake, { toValue: to, duration: Motion.shake.stepMs, useNativeDriver: true });
    Animated.sequence([step(-d), step(d), step(-d), step(d / 2), step(0)]).start();
  };

  const verify = async (value: string) => {
    setBusy(true);
    setError(null);
    try {
      await confirmPhoneCode(value);
      haptic('success');
      finish();
    } catch (e) {
      if (!alive.current) return;
      shakeBoxes();
      setError(e instanceof AuthFlowError ? e.message : 'Something went wrong. Please try again.');
      setCode('');
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const onKey = (d: string) => {
    if (busy || code.length >= CODE_LENGTH) return;
    const next = code + d;
    setCode(next);
    if (error) setError(null);
    if (next.length === CODE_LENGTH) verify(next);
  };
  const onBackspace = () => {
    if (busy) return;
    setCode((c) => c.slice(0, -1));
    if (error) setError(null);
  };

  const resend = async () => {
    if (left > 0 || resending || busy) return;
    if (!phone) {
      navigation.goBack();
      return;
    }
    setResending(true);
    setError(null);
    try {
      await startPhoneSignIn(phone);
      if (!alive.current) return;
      setCode('');
      restart();
    } catch (e) {
      if (alive.current) setError(e instanceof AuthFlowError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      if (alive.current) setResending(false);
    }
  };

  return (
    <Screen
      testID="screen-AuthOtp"
      cta={
        <View style={{ marginHorizontal: -6 }}>
          <Keypad onKey={onKey} onBackspace={onBackspace} />
        </View>
      }
    >
      <TopBar onBack={() => navigation.goBack()} />
      <Stepper step={2} />
      <Text style={type.label}>STEP 2 OF 5</Text>
      <Text style={[type.h1, { marginTop: 12 }]} accessibilityRole="header">Enter the{'\n'}6-digit code.</Text>
      <Text style={[type.body, { marginTop: 12 }]} testID="sent-to">
        Sent to <Text style={type.bodyStrong}>{formatPhone(phone)}</Text>
      </Text>
      <Animated.View style={{ marginTop: 24, transform: [{ translateX: shake }] }}>
        <CodeBoxes value={code} length={CODE_LENGTH} error={Boolean(error)} testID="code-boxes" />
      </Animated.View>
      {error ? (
        <Text style={s.err} accessibilityRole="alert" accessibilityLiveRegion="polite" testID="otp-error">{error}</Text>
      ) : null}
      <View style={s.metaRow}>
        <Text style={type.sm} accessibilityLiveRegion="polite">{busy ? 'Checking…' : ''}</Text>
        {left > 0 ? (
          <Text style={type.sm} testID="resend-countdown">{resendLabel(left)}</Text>
        ) : (
          <PressableScale
            style={s.resend}
            onPress={resend}
            disabled={resending}
            accessibilityRole="button"
            accessibilityLabel="Resend code"
            testID="resend-code"
          >
            <Text style={[type.bodyStrong, { textDecorationLine: 'underline' }]}>Resend code</Text>
          </PressableScale>
        )}
      </View>
    </Screen>
  );
}
