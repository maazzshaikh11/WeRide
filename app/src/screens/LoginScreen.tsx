/**
 * Login / Create-account screen.
 *  - Restores an existing Firebase session (onAuthStateChanged) and skips the form.
 *  - Sign in or create account with email + password, validated client-side.
 *  - Firebase errors are shown as short sentences (never raw "[auth/...]").
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, TextInput, Text, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, LayoutAnimation, UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { firebaseAuth, saveFcmToken } from '../services/firebaseService';
import { useAppStore } from '../store/appStore';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import Logo from '../components/Logo';
import { authErrorMessage } from '../utils/authErrors';
import { Button, FadeIn, PressableScale, TextField, haptic, useReducedMotion } from '../ui';

// Android needs layout animations switched on once (no-op elsewhere / in jest).
if (Platform.OS === 'android' && typeof UIManager?.setLayoutAnimationEnabledExperimental === 'function') {
  try {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  } catch {
    // Optional nicety.
  }
}

/**
 * Smooth the NEXT layout change (fields appearing/disappearing, content below
 * sliding). Entering views are animated by FadeIn, so only update + delete
 * (fade) are configured here.
 */
function animateLayout(): void {
  try {
    LayoutAnimation.configureNext({
      duration: 220,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
  } catch {
    // Layout animation is a nicety; never block the state change.
  }
}

type Mode = 'signIn' | 'create';
type Field = 'email' | 'password' | 'confirm';
type FieldErrors = Partial<Record<Field, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6;

export function validateAuthForm(mode: Mode, email: string, password: string, confirm: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) errors.email = 'Enter your email.';
  else if (!EMAIL_RE.test(email.trim())) errors.email = 'Enter a valid email address.';
  if (!password) errors.password = 'Enter your password.';
  else if (mode === 'create' && password.length < MIN_PASSWORD) {
    errors.password = `Use at least ${MIN_PASSWORD} characters.`;
  }
  if (mode === 'create') {
    if (!confirm) errors.confirm = 'Confirm your password.';
    else if (confirm !== password) errors.confirm = 'Passwords do not match.';
  }
  return errors;
}

/** The real logo (logo.jpeg), as the page's heading. */
function Wordmark({ width = 96 }: { width?: number }) {
  return <Logo size={width} />;
}

export default function LoginScreen({ navigation }: any) {
  const { colors, type } = useTheme();
  const styles = useStyles(({ colors: c, type: t }) => ({
    safe: { flex: 1, backgroundColor: c.bg },
    flex: { flex: 1 },
    scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 32 },
    splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    splashSpinner: { marginTop: 24 },
    logoWrap: { alignItems: 'center', marginBottom: 32 },
    modeTitle: { ...t.h1, marginTop: 12 },
    fieldLabel: { ...t.fieldLabel, marginTop: 24, marginBottom: 8, marginLeft: 2 },
    hint: { ...t.sm, color: c.ink3, marginTop: 8, marginLeft: 2 },
    formError: { ...t.body, color: c.bad, marginTop: 16 },
    submit: { marginTop: 32 },
    toggle: { minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
    toggleLink: {
      ...t.bodyStrong,
      textDecorationLine: 'underline',
      textDecorationColor: c.pri,
      textDecorationStyle: 'solid',
    },
  }));
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // false until Firebase reports the first auth state (restored session or none).
  const [authKnown, setAuthKnown] = useState(false);
  const setUserId = useAppStore((s) => s.setUserId);
  const reduced = useReducedMotion();

  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const navigated = useRef(false);
  const mounted = useRef(true);

  const enterApp = useCallback(
    (uid: string) => {
      if (navigated.current) return;
      navigated.current = true;
      setUserId(uid);
      // Register this device for SOS push (best-effort; must not block login).
      Promise.resolve()
        .then(() => saveFcmToken(uid))
        .catch(() => undefined);
      navigation.replace('Groups');
    },
    [navigation, setUserId]
  );

  useEffect(() => {
    mounted.current = true;
    const unsubscribe = firebaseAuth.onAuthStateChanged((user: { uid: string } | null) => {
      if (!mounted.current) return;
      if (user) enterApp(user.uid);
      else setAuthKnown(true);
    });
    return () => {
      mounted.current = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [enterApp]);

  const clearField = (f: Field) => {
    setFormError(null);
    setFieldErrors((prev) => (prev[f] ? { ...prev, [f]: undefined } : prev));
  };

  const switchMode = () => {
    if (!reduced) animateLayout();
    setMode((m) => (m === 'signIn' ? 'create' : 'signIn'));
    setFieldErrors({});
    setFormError(null);
    setConfirm('');
  };

  const submit = async () => {
    if (loading) return;
    const errors = validateAuthForm(mode, email, password, confirm);
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) {
      haptic('error');
      return;
    }

    setLoading(true);
    try {
      const addr = email.trim();
      const cred =
        mode === 'create'
          ? await firebaseAuth.createUserWithEmailAndPassword(addr, password)
          : await firebaseAuth.signInWithEmailAndPassword(addr, password);
      haptic('success');
      enterApp(cred.user.uid);
    } catch (e: any) {
      if (!mounted.current) return;
      haptic('error');
      const code = e?.code;
      const message = authErrorMessage(e);
      if (code === 'auth/invalid-email') setFieldErrors({ email: message });
      else if (code === 'auth/email-already-in-use') setFieldErrors({ email: message });
      else if (code === 'auth/weak-password') setFieldErrors({ password: message });
      else setFormError(message);
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  if (!authKnown) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.splash} accessibilityLabel="Checking sign-in" accessibilityLiveRegion="polite">
          <FadeIn>
            <Wordmark width={168} />
          </FadeIn>
          <ActivityIndicator color={colors.pri} style={styles.splashSpinner} />
        </View>
      </SafeAreaView>
    );
  }

  const isCreate = mode === 'create';
  const submitLabel = isCreate ? 'Create account' : 'Sign in';

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <FadeIn index={0} style={styles.logoWrap}>
            <Wordmark width={96} />
          </FadeIn>

          <FadeIn index={1}>
            {/* Re-keyed so the heading gives a small fade/rise when the mode flips. */}
            <FadeIn key={mode}>
              <Text style={type.label}>{isCreate ? 'NEW RIDER' : 'WELCOME BACK'}</Text>
              <Text style={styles.modeTitle} accessibilityRole="header">{submitLabel}</Text>
            </FadeIn>

            <Text style={styles.fieldLabel}>EMAIL</Text>

            <TextField
              error={fieldErrors.email}
              placeholder="Email"
              value={email}
              onChangeText={(v) => { setEmail(v); clearField('email'); }}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              keyboardType="email-address"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!loading}
              accessibilityLabel="Email input"
            />

            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <TextField
              ref={passwordRef}
              error={fieldErrors.password}
              placeholder="Password"
              value={password}
              onChangeText={(v) => { setPassword(v); clearField('password'); }}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={isCreate ? 'password-new' : 'password'}
              textContentType={isCreate ? 'newPassword' : 'password'}
              returnKeyType={isCreate ? 'next' : 'go'}
              blurOnSubmit={!isCreate}
              onSubmitEditing={() => (isCreate ? confirmRef.current?.focus() : submit())}
              editable={!loading}
              accessibilityLabel="Password input"
            />
            {!fieldErrors.password && isCreate ? (
              <Text style={styles.hint}>At least {MIN_PASSWORD} characters.</Text>
            ) : null}

            {isCreate ? (
              <FadeIn>
                <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
                <TextField
                  ref={confirmRef}
                      error={fieldErrors.confirm}
                  placeholder="Confirm password"
                  value={confirm}
                  onChangeText={(v) => { setConfirm(v); clearField('confirm'); }}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password-new"
                  textContentType="newPassword"
                  returnKeyType="go"
                  onSubmitEditing={submit}
                  editable={!loading}
                  accessibilityLabel="Confirm password input"
                />
              </FadeIn>
            ) : null}

            {formError ? (
              <FadeIn>
                <Text style={styles.formError} accessibilityLiveRegion="polite" accessibilityRole="alert">
                  {formError}
                </Text>
              </FadeIn>
            ) : null}
          </FadeIn>

          <FadeIn index={2}>
            <Button
              label={submitLabel}
              onPress={submit}
              loading={loading}
              disabled={loading}
              style={styles.submit}
              haptic="select"
            />

            <PressableScale
              style={styles.toggle}
              onPress={switchMode}
              disabled={loading}
              haptic="tap"
              accessibilityRole="button"
              accessibilityLabel={isCreate ? 'Switch to sign in' : 'Switch to create account'}
            >
              <Text style={type.body}>
                {isCreate ? 'Have an account? ' : 'New to WeRide? '}
                <Text style={styles.toggleLink}>
                  {isCreate ? 'Sign in' : 'Create account'}
                </Text>
              </Text>
            </PressableScale>
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
