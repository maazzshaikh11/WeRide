/**
 * Login / Create-account screen.
 *  - Restores an existing Firebase session (onAuthStateChanged) and skips the form.
 *  - Sign in or create account with email + password, validated client-side.
 *  - Firebase errors are shown as short sentences (never raw "[auth/...]").
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, TextInput, Text, StyleSheet, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { firebaseAuth, saveFcmToken } from '../services/firebaseService';
import { useAppStore } from '../store/appStore';
import { WeRideColors, WeRideRadius, WeRideSpacing } from '../theme/theme';
import { type } from '../theme/typography';
import { authErrorMessage } from '../utils/authErrors';

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

function Wordmark() {
  return (
    <Text style={styles.logo} accessibilityRole="header">
      WE<Text style={styles.logoAccent}>RIDE</Text>
    </Text>
  );
}

export default function LoginScreen({ navigation }: any) {
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
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      const addr = email.trim();
      const cred =
        mode === 'create'
          ? await firebaseAuth.createUserWithEmailAndPassword(addr, password)
          : await firebaseAuth.signInWithEmailAndPassword(addr, password);
      enterApp(cred.user.uid);
    } catch (e: any) {
      if (!mounted.current) return;
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
          <Wordmark />
          <ActivityIndicator color={WeRideColors.primary} style={styles.splashSpinner} />
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
          <View style={styles.logoWrap}>
            <Wordmark />
          </View>

          <Text style={[type.heading, styles.modeTitle]}>{submitLabel}</Text>

          <TextInput
            style={[styles.input, fieldErrors.email ? styles.inputError : null]}
            placeholder="Email"
            placeholderTextColor={WeRideColors.textSub}
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
          {fieldErrors.email ? (
            <Text style={styles.fieldError} accessibilityLiveRegion="polite">{fieldErrors.email}</Text>
          ) : null}

          <TextInput
            ref={passwordRef}
            style={[styles.input, fieldErrors.password ? styles.inputError : null]}
            placeholder="Password"
            placeholderTextColor={WeRideColors.textSub}
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
          {fieldErrors.password ? (
            <Text style={styles.fieldError} accessibilityLiveRegion="polite">{fieldErrors.password}</Text>
          ) : isCreate ? (
            <Text style={styles.hint}>At least {MIN_PASSWORD} characters.</Text>
          ) : null}

          {isCreate ? (
            <>
              <TextInput
                ref={confirmRef}
                style={[styles.input, fieldErrors.confirm ? styles.inputError : null]}
                placeholder="Confirm password"
                placeholderTextColor={WeRideColors.textSub}
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
              {fieldErrors.confirm ? (
                <Text style={styles.fieldError} accessibilityLiveRegion="polite">{fieldErrors.confirm}</Text>
              ) : null}
            </>
          ) : null}

          {formError ? (
            <Text style={styles.formError} accessibilityLiveRegion="polite" accessibilityRole="alert">
              {formError}
            </Text>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, loading && styles.buttonLoading]}
            onPress={submit}
            disabled={loading}
            accessibilityLabel={submitLabel}
            accessibilityRole="button"
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={WeRideColors.onPrimary} size="small" />
                <Text style={type.button}>{isCreate ? 'Creating account…' : 'Signing in…'}</Text>
              </View>
            ) : (
              <Text style={type.button}>{submitLabel}</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.toggle}
            onPress={switchMode}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={isCreate ? 'Switch to sign in' : 'Switch to create account'}
          >
            <Text style={[type.body, { color: WeRideColors.textSub }]}>
              {isCreate ? 'Have an account? ' : 'New to WeRide? '}
              <Text style={[type.bodyStrong, { color: WeRideColors.primary }]}>
                {isCreate ? 'Sign in' : 'Create account'}
              </Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WeRideColors.dark },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: WeRideSpacing.lg,
    paddingVertical: WeRideSpacing.xxl,
  },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  splashSpinner: { marginTop: WeRideSpacing.lg },
  logoWrap: { alignItems: 'center', marginBottom: WeRideSpacing.xxl },
  logo: { ...type.display, letterSpacing: 1 },
  logoAccent: { color: WeRideColors.primary },
  modeTitle: { marginBottom: WeRideSpacing.xs },
  input: {
    ...type.input,
    height: 48,
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: WeRideRadius.md,
    paddingHorizontal: WeRideSpacing.md,
    marginTop: WeRideSpacing.md,
  },
  inputError: { borderColor: WeRideColors.error },
  fieldError: { ...type.caption, color: WeRideColors.error, marginTop: WeRideSpacing.xs },
  hint: { ...type.caption, marginTop: WeRideSpacing.xs },
  formError: {
    ...type.body,
    color: WeRideColors.error,
    marginTop: WeRideSpacing.md,
  },
  button: {
    minHeight: 48,
    backgroundColor: WeRideColors.primary,
    borderRadius: WeRideRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: WeRideSpacing.lg,
  },
  buttonPressed: { opacity: 0.85 },
  buttonLoading: { opacity: 0.6 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: WeRideSpacing.sm },
  toggle: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: WeRideSpacing.sm,
  },
});
