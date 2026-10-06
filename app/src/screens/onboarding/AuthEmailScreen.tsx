/**
 * AuthEmail — email + password sign in / create account (the production alternative to the demo's phone sign-in).
 * Same behaviour as the first release's login: client-side validation, friendly Firebase errors (never raw
 * "[auth/...]"), field errors shake, create mode adds a confirm field. Success resets to `Boot`, which routes
 * new riders to Profile and onboarded ones to the Garage.
 */
import React, { useEffect, useRef, useState } from 'react';
import { LayoutAnimation, Platform, Text, TextInput, UIManager } from 'react-native';
import { Button, FadeIn, PressableScale, Screen, Stepper, TextField, TopBar, haptic, useReducedMotion } from '../../ui';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import { createAccountWithEmail, signInWithEmail } from '../../services/authService';
import { authErrorMessage } from '../../utils/authErrors';
import Kav from './parts/Kav';

// Android needs layout animations switched on once (no-op elsewhere / in jest).
if (Platform.OS === 'android' && typeof UIManager?.setLayoutAnimationEnabledExperimental === 'function') {
  try {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  } catch {
    // optional nicety
  }
}

function animateLayout(): void {
  try {
    LayoutAnimation.configureNext({
      duration: 220,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
  } catch {
    // never block the state change
  }
}

export type AuthMode = 'signIn' | 'create';
type Field = 'email' | 'password' | 'confirm';
export type FieldErrors = Partial<Record<Field, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD = 6;

export function validateAuthForm(mode: AuthMode, email: string, password: string, confirm: string): FieldErrors {
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

export default function AuthEmailScreen({ navigation }: any) {
  const { type } = useTheme();
  const styles = useStyles(({ colors: c, type: t }) => ({
    fieldLabel: { ...t.fieldLabel, marginTop: 24, marginBottom: 8, marginLeft: 2 },
    hint: { ...t.sm, color: c.ink3, marginTop: 8, marginLeft: 2 },
    formError: { ...t.body, color: c.bad, marginTop: 16 },
    submit: { marginTop: 32 },
    toggle: { minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
    toggleLink: { ...t.bodyStrong, textDecorationLine: 'underline', textDecorationColor: c.pri, textDecorationStyle: 'solid' },
  }));
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const reduced = useReducedMotion();

  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const navigated = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

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
      if (mode === 'create') await createAccountWithEmail(addr, password);
      else await signInWithEmail(addr, password);
      haptic('success');
      if (!navigated.current) {
        navigated.current = true;
        navigation.reset({ index: 0, routes: [{ name: 'Boot' }] });
      }
    } catch (e: any) {
      if (!mounted.current) return;
      haptic('error');
      const code = e?.code;
      const message = authErrorMessage(e);
      if (code === 'auth/invalid-email' || code === 'auth/email-already-in-use') setFieldErrors({ email: message });
      else if (code === 'auth/weak-password') setFieldErrors({ password: message });
      else setFormError(message);
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  const isCreate = mode === 'create';
  const submitLabel = isCreate ? 'Create account' : 'Sign in';

  return (
    <Kav>
      <Screen testID="screen-AuthEmail">
        <TopBar onBack={() => navigation.goBack()} />
        <Stepper step={1} />
        <Text style={type.label}>{isCreate ? 'NEW RIDER' : 'WELCOME BACK'}</Text>
        <FadeIn key={mode}>
          <Text style={[type.h1, { marginTop: 12 }]} accessibilityRole="header">{submitLabel}</Text>
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
        {!fieldErrors.password && isCreate ? <Text style={styles.hint}>At least {MIN_PASSWORD} characters.</Text> : null}

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
            <Text style={styles.formError} accessibilityLiveRegion="polite" accessibilityRole="alert">{formError}</Text>
          </FadeIn>
        ) : null}

        <Button label={submitLabel} onPress={submit} loading={loading} disabled={loading} style={styles.submit} haptic="select" />
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
            <Text style={styles.toggleLink}>{isCreate ? 'Sign in' : 'Create account'}</Text>
          </Text>
        </PressableScale>
      </Screen>
    </Kav>
  );
}
