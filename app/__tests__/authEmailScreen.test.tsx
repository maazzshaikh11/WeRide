/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories need require */
/**
 * AuthEmail: the email/password sign-in and create-account screen (behaviour carried over from the first
 * release's login), restyled with Screen/TopBar/TextField. Success resets to Boot.
 */
import React from 'react';
import { LayoutAnimation, StyleSheet } from 'react-native';
import { act } from 'react-test-renderer';
import { Button, TextField } from '../src/ui';
import { THEMES } from '../src/theme/palettes';
import { ALL_PALETTES, byLabel, byTestId, hasText, hostById, mount, press, texts, typeInto, unmountAll } from './onboardingTestUtils';

const mockSignIn = jest.fn();
const mockCreate = jest.fn();
jest.mock('../src/services/authService', () => ({
  signInWithEmail: (...a: unknown[]) => mockSignIn(...a),
  createAccountWithEmail: (...a: unknown[]) => mockCreate(...a),
}));
jest.mock('react-native-safe-area-context', () => require('./onboardingTestUtils').safeAreaMock());

import AuthEmailScreen, { validateAuthForm } from '../src/screens/onboarding/AuthEmailScreen';

const nav = () => ({ reset: jest.fn(), goBack: jest.fn(), navigate: jest.fn() });
const BOOT = { index: 0, routes: [{ name: 'Boot' }] };

beforeEach(() => {
  mockSignIn.mockReset().mockResolvedValue({ uid: 'u1' });
  mockCreate.mockReset().mockResolvedValue({ uid: 'u2' });
});
afterEach(unmountAll);

describe('validateAuthForm', () => {
  it('checks email, password length (create only) and confirmation', () => {
    expect(validateAuthForm('signIn', '', '', '')).toEqual({ email: 'Enter your email.', password: 'Enter your password.' });
    expect(validateAuthForm('signIn', 'nope', 'x', '')).toEqual({ email: 'Enter a valid email address.' });
    expect(validateAuthForm('signIn', 'a@b.co', '1', '')).toEqual({});
    expect(validateAuthForm('create', 'a@b.co', '12345', '12346')).toEqual({ password: 'Use at least 6 characters.', confirm: 'Passwords do not match.' });
    expect(validateAuthForm('create', 'a@b.co', 'secret1', '')).toEqual({ confirm: 'Confirm your password.' });
    expect(validateAuthForm('create', 'a@b.co', 'secret1', 'secret1')).toEqual({});
  });
});

describe('AuthEmailScreen', () => {
  it.each(ALL_PALETTES)('%s/%s: page colour, back chip, step bar, fields and primary action', (id, scheme) => {
    const t = mount(<AuthEmailScreen navigation={nav()} />, id, scheme);
    const p = THEMES[id][scheme];
    expect(StyleSheet.flatten(hostById(t, 'screen-AuthEmail').props.style).backgroundColor).toBe(p.bg);
    expect(byLabel(t, 'Back')).toBeDefined();
    expect(byTestId(t, 'stepper')).toBeDefined();
    expect(hasText(t, 'WELCOME BACK')).toBe(true);
    expect(byLabel(t, 'Email input')).toBeDefined();
    expect(byLabel(t, 'Password input').props.secureTextEntry).toBe(true);
    expect(t.root.findByType(Button).props.label).toBe('Sign in');
  });

  it('password field is secure and fields carry autofill hints', () => {
    const t = mount(<AuthEmailScreen navigation={nav()} />);
    expect(byLabel(t, 'Password input').props.textContentType).toBe('password');
    expect(byLabel(t, 'Email input').props.textContentType).toBe('emailAddress');
    expect(byLabel(t, 'Email input').props.returnKeyType).toBe('next');
  });

  it('signs in with a trimmed email and resets to Boot', async () => {
    const n = nav();
    const t = mount(<AuthEmailScreen navigation={n} />);
    typeInto(t, 'Email input', '  rider@example.com ');
    typeInto(t, 'Password input', 'hunter22');
    await press(t, 'Sign in');
    expect(mockSignIn).toHaveBeenCalledWith('rider@example.com', 'hunter22');
    expect(n.reset).toHaveBeenCalledWith(BOOT);
  });

  it('an empty form shows field errors and does not call Firebase', async () => {
    const t = mount(<AuthEmailScreen navigation={nav()} />);
    await press(t, 'Sign in');
    expect(hasText(t, 'Enter your email.')).toBe(true);
    expect(hasText(t, 'Enter your password.')).toBe(true);
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('rejects a malformed email', async () => {
    const t = mount(<AuthEmailScreen navigation={nav()} />);
    typeInto(t, 'Email input', 'not-an-email');
    typeInto(t, 'Password input', 'secret1');
    await press(t, 'Sign in');
    expect(hasText(t, 'Enter a valid email address.')).toBe(true);
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('Firebase errors show a friendly sentence, never the raw code, and do not navigate', async () => {
    mockSignIn.mockRejectedValue({ code: 'auth/invalid-credential', message: '[auth/invalid-credential] The supplied auth credential is incorrect' });
    const n = nav();
    const t = mount(<AuthEmailScreen navigation={n} />);
    typeInto(t, 'Email input', 'a@b.co');
    typeInto(t, 'Password input', 'secret1');
    await press(t, 'Sign in');
    expect(hasText(t, 'Email or password is incorrect.')).toBe(true);
    expect(texts(t).some((x) => x.includes('[auth/'))).toBe(false);
    expect(n.reset).not.toHaveBeenCalled();
  });

  it('a network failure shows the form-level message with an alert role', async () => {
    mockSignIn.mockRejectedValue({ code: 'auth/network-request-failed' });
    const t = mount(<AuthEmailScreen navigation={nav()} />);
    typeInto(t, 'Email input', 'a@b.co');
    typeInto(t, 'Password input', 'secret1');
    await press(t, 'Sign in');
    expect(hasText(t, 'No connection. Check your internet and try again.')).toBe(true);
    expect(t.root.findAll((n) => n.props.accessibilityRole === 'alert').length).toBeGreaterThan(0);
  });

  it('submit is busy while in flight and a second tap sends nothing', async () => {
    let resolve!: (v: unknown) => void;
    mockSignIn.mockReturnValue(new Promise((r) => { resolve = r; }));
    const t = mount(<AuthEmailScreen navigation={nav()} />);
    typeInto(t, 'Email input', 'a@b.co');
    typeInto(t, 'Password input', 'secret1');
    expect(t.root.findByType(Button).props.loading).toBe(false);
    let pending: Promise<void> = Promise.resolve();
    act(() => { pending = byLabel(t, 'Sign in').props.onPress(); });
    expect(t.root.findByType(Button).props.loading).toBe(true);
    await act(async () => { await byLabel(t, 'Sign in').props.onPress(); });
    expect(mockSignIn).toHaveBeenCalledTimes(1);
    await act(async () => { resolve({ uid: 'u1' }); await pending; });
  });

  it('validation errors are handed to the fields and clear on edit', async () => {
    const t = mount(<AuthEmailScreen navigation={nav()} />);
    const errors = () => t.root.findAllByType(TextField).map((f) => f.props.error);
    expect(errors()).toEqual([undefined, undefined]);
    await press(t, 'Sign in');
    expect(errors()).toEqual(['Enter your email.', 'Enter your password.']);
    typeInto(t, 'Email input', 'a');
    expect(errors()).toEqual([undefined, 'Enter your password.']);
  });

  describe('create account', () => {
    it('toggle reveals the confirm field and a Create account button, with a layout animation', async () => {
      const configure = jest.spyOn(LayoutAnimation, 'configureNext').mockImplementation(() => undefined);
      const t = mount(<AuthEmailScreen navigation={nav()} />);
      const confirm = () => t.root.findAll((n) => n.props.accessibilityLabel === 'Confirm password input');
      expect(confirm()).toHaveLength(0);
      await press(t, 'Switch to create account');
      expect(confirm().length).toBeGreaterThan(0);
      expect(hasText(t, 'NEW RIDER')).toBe(true);
      expect(t.root.findByType(Button).props.label).toBe('Create account');
      await press(t, 'Switch to sign in');
      expect(confirm()).toHaveLength(0);
      expect(configure).toHaveBeenCalledTimes(2);
      configure.mockRestore();
    });

    async function toCreate(t: ReturnType<typeof mount>) {
      await press(t, 'Switch to create account');
    }

    it('validates length and confirmation before calling Firebase', async () => {
      const t = mount(<AuthEmailScreen navigation={nav()} />);
      await toCreate(t);
      typeInto(t, 'Email input', 'new@b.co');
      typeInto(t, 'Password input', '12345');
      typeInto(t, 'Confirm password input', '12346');
      await press(t, 'Create account');
      expect(hasText(t, 'Use at least 6 characters.')).toBe(true);
      expect(hasText(t, 'Passwords do not match.')).toBe(true);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('creates the account and resets to Boot', async () => {
      const n = nav();
      const t = mount(<AuthEmailScreen navigation={n} />);
      await toCreate(t);
      typeInto(t, 'Email input', 'new@b.co');
      typeInto(t, 'Password input', 'secret1');
      typeInto(t, 'Confirm password input', 'secret1');
      await press(t, 'Create account');
      expect(mockCreate).toHaveBeenCalledWith('new@b.co', 'secret1');
      expect(mockSignIn).not.toHaveBeenCalled();
      expect(n.reset).toHaveBeenCalledWith(BOOT);
    });

    it('email-already-in-use lands on the email field; weak-password on the password field', async () => {
      mockCreate.mockRejectedValueOnce({ code: 'auth/email-already-in-use' });
      const t = mount(<AuthEmailScreen navigation={nav()} />);
      await toCreate(t);
      typeInto(t, 'Email input', 'dup@b.co');
      typeInto(t, 'Password input', 'secret1');
      typeInto(t, 'Confirm password input', 'secret1');
      await press(t, 'Create account');
      expect(t.root.findAllByType(TextField)[0].props.error).toBe('An account with this email already exists.');
      mockCreate.mockRejectedValueOnce({ code: 'auth/weak-password' });
      await press(t, 'Create account');
      expect(t.root.findAllByType(TextField)[1].props.error).toBe('Use a password with at least 6 characters.');
    });
  });

  it('back goes back', async () => {
    const n = nav();
    const t = mount(<AuthEmailScreen navigation={n} />);
    await press(t, 'Back');
    expect(n.goBack).toHaveBeenCalled();
  });
});
