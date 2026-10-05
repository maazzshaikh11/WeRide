/**
 * LoginScreen: session restore, sign in, create account, validation, friendly errors.
 */
import React from 'react';
import { act, create, ReactTestInstance } from 'react-test-renderer';

const mockAuth = {
  onAuthStateChanged: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
};
const mockSaveFcmToken = jest.fn();
jest.mock('../src/services/firebaseService', () => ({
  get firebaseAuth() {
    return mockAuth;
  },
  saveFcmToken: (...a: unknown[]) => mockSaveFcmToken(...a),
}));

import LoginScreen from '../src/screens/LoginScreen';
import { useAppStore } from '../src/store/appStore';

const mounted: ReturnType<typeof create>[] = [];
let authCb: ((u: { uid: string } | null) => void) | null = null;
const unsubscribe = jest.fn();

function render(navigation: any) {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<LoginScreen navigation={navigation} />);
  });
  mounted.push(tree);
  return tree;
}

function byLabel(tree: ReturnType<typeof create>, label: string): ReactTestInstance {
  const found = tree.root.findAll((n) => n.props.accessibilityLabel === label);
  if (!found.length) throw new Error(`no node labelled "${label}"`);
  return found[0];
}

function texts(tree: ReturnType<typeof create>): string[] {
  return tree.root
    .findAll((n) => (n.type as unknown) === 'Text')
    .map((n) => n.children.map((c) => (typeof c === 'string' ? c : '')).join(''));
}

const hasText = (tree: ReturnType<typeof create>, s: string) => texts(tree).some((t) => t.includes(s));

async function signedOut(tree: ReturnType<typeof create>) {
  await act(async () => {
    authCb?.(null);
  });
  return tree;
}

function type(tree: ReturnType<typeof create>, label: string, value: string) {
  act(() => byLabel(tree, label).props.onChangeText(value));
}

async function press(tree: ReturnType<typeof create>, label: string) {
  await act(async () => {
    await byLabel(tree, label).props.onPress();
  });
}

beforeEach(() => {
  authCb = null;
  unsubscribe.mockReset();
  mockAuth.onAuthStateChanged.mockReset().mockImplementation((cb) => {
    authCb = cb;
    return unsubscribe;
  });
  mockAuth.signInWithEmailAndPassword.mockReset().mockResolvedValue({ user: { uid: 'u1' } });
  mockAuth.createUserWithEmailAndPassword.mockReset().mockResolvedValue({ user: { uid: 'u2' } });
  mockSaveFcmToken.mockReset().mockResolvedValue(undefined);
  useAppStore.setState({ userId: null });
});

afterEach(() => {
  mounted.splice(0).forEach((t) => act(() => t.unmount()));
});

describe('LoginScreen session restore', () => {
  test('shows a loading state, not the form, until the first auth state arrives', () => {
    const nav = { replace: jest.fn() };
    const tree = render(nav);
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'Email input')).toHaveLength(0);
    // Brand logo (image with an accessible name) is shown while auth state is unknown.
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'WeRide').length).toBeGreaterThan(0);
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'Checking sign-in').length).toBeGreaterThan(0);
  });

  test('a restored session sets the user and navigates to Groups exactly once', async () => {
    const nav = { replace: jest.fn() };
    const tree = render(nav);
    await act(async () => {
      authCb?.({ uid: 'restored' });
      authCb?.({ uid: 'restored' });
    });
    expect(useAppStore.getState().userId).toBe('restored');
    expect(mockSaveFcmToken).toHaveBeenCalledWith('restored');
    expect(nav.replace).toHaveBeenCalledTimes(1);
    expect(nav.replace).toHaveBeenCalledWith('Groups');
    // still no form flash
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'Email input')).toHaveLength(0);
  });

  test('a failing FCM save does not block navigation', async () => {
    mockSaveFcmToken.mockRejectedValue(new Error('no fcm'));
    const nav = { replace: jest.fn() };
    render(nav);
    await act(async () => {
      authCb?.({ uid: 'u' });
    });
    expect(nav.replace).toHaveBeenCalledWith('Groups');
  });

  test('no session shows the form; unmount unsubscribes', async () => {
    const nav = { replace: jest.fn() };
    const tree = render(nav);
    await signedOut(tree);
    expect(byLabel(tree, 'Email input')).toBeDefined();
    expect(nav.replace).not.toHaveBeenCalled();
    act(() => tree.unmount());
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  test('signing in does not navigate twice when the auth listener also fires', async () => {
    const nav = { replace: jest.fn() };
    const tree = render(nav);
    await signedOut(tree);
    type(tree, 'Email input', 'a@b.co');
    type(tree, 'Password input', 'secret1');
    await press(tree, 'Sign in');
    await act(async () => {
      authCb?.({ uid: 'u1' });
    });
    expect(nav.replace).toHaveBeenCalledTimes(1);
  });
});

describe('LoginScreen sign in', () => {
  test('signs in with trimmed email, stores the uid, registers FCM, navigates', async () => {
    const nav = { replace: jest.fn() };
    const tree = render(nav);
    await signedOut(tree);
    type(tree, 'Email input', '  rider@example.com ');
    type(tree, 'Password input', 'hunter22');
    await press(tree, 'Sign in');
    expect(mockAuth.signInWithEmailAndPassword).toHaveBeenCalledWith('rider@example.com', 'hunter22');
    expect(useAppStore.getState().userId).toBe('u1');
    expect(mockSaveFcmToken).toHaveBeenCalledWith('u1');
    expect(nav.replace).toHaveBeenCalledWith('Groups');
  });

  test('empty form shows field errors and does not call Firebase', async () => {
    const tree = render({ replace: jest.fn() });
    await signedOut(tree);
    await press(tree, 'Sign in');
    expect(hasText(tree, 'Enter your email.')).toBe(true);
    expect(hasText(tree, 'Enter your password.')).toBe(true);
    expect(mockAuth.signInWithEmailAndPassword).not.toHaveBeenCalled();
  });

  test('rejects a malformed email', async () => {
    const tree = render({ replace: jest.fn() });
    await signedOut(tree);
    type(tree, 'Email input', 'not-an-email');
    type(tree, 'Password input', 'secret1');
    await press(tree, 'Sign in');
    expect(hasText(tree, 'Enter a valid email address.')).toBe(true);
    expect(mockAuth.signInWithEmailAndPassword).not.toHaveBeenCalled();
  });

  test('Firebase errors show a friendly sentence, never the raw code', async () => {
    mockAuth.signInWithEmailAndPassword.mockRejectedValue({
      code: 'auth/invalid-credential',
      message: '[auth/invalid-credential] The supplied auth credential is incorrect',
    });
    const nav = { replace: jest.fn() };
    const tree = render(nav);
    await signedOut(tree);
    type(tree, 'Email input', 'a@b.co');
    type(tree, 'Password input', 'secret1');
    await press(tree, 'Sign in');
    expect(hasText(tree, 'Email or password is incorrect.')).toBe(true);
    expect(texts(tree).some((t) => t.includes('[auth/'))).toBe(false);
    expect(nav.replace).not.toHaveBeenCalled();
  });

  test('submit is disabled and reports busy while the request is in flight', async () => {
    let resolve!: (v: unknown) => void;
    mockAuth.signInWithEmailAndPassword.mockReturnValue(new Promise((r) => { resolve = r; }));
    const tree = render({ replace: jest.fn() });
    await signedOut(tree);
    type(tree, 'Email input', 'a@b.co');
    type(tree, 'Password input', 'secret1');
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = byLabel(tree, 'Sign in').props.onPress();
    });
    expect(byLabel(tree, 'Sign in').props.disabled).toBe(true);
    // a second tap while loading must not send a second request
    await act(async () => {
      await byLabel(tree, 'Sign in').props.onPress();
    });
    expect(mockAuth.signInWithEmailAndPassword).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve({ user: { uid: 'u1' } });
      await pending;
    });
  });

  test('password field is secure and fields carry autofill hints', async () => {
    const tree = render({ replace: jest.fn() });
    await signedOut(tree);
    expect(byLabel(tree, 'Password input').props.secureTextEntry).toBe(true);
    expect(byLabel(tree, 'Password input').props.textContentType).toBe('password');
    expect(byLabel(tree, 'Email input').props.textContentType).toBe('emailAddress');
    expect(byLabel(tree, 'Email input').props.returnKeyType).toBe('next');
  });
});

describe('LoginScreen create account', () => {
  async function toCreate(tree: ReturnType<typeof create>) {
    await signedOut(tree);
    await press(tree, 'Switch to create account');
  }

  test('toggle reveals the confirm field and a Create account button', async () => {
    const tree = render({ replace: jest.fn() });
    await signedOut(tree);
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'Confirm password input')).toHaveLength(0);
    await press(tree, 'Switch to create account');
    expect(byLabel(tree, 'Confirm password input')).toBeDefined();
    expect(byLabel(tree, 'Create account')).toBeDefined();
    await press(tree, 'Switch to sign in');
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'Confirm password input')).toHaveLength(0);
  });

  test('validates length and confirmation before calling Firebase', async () => {
    const tree = render({ replace: jest.fn() });
    await toCreate(tree);
    type(tree, 'Email input', 'new@b.co');
    type(tree, 'Password input', '12345');
    type(tree, 'Confirm password input', '12346');
    await press(tree, 'Create account');
    expect(hasText(tree, 'Use at least 6 characters.')).toBe(true);
    expect(hasText(tree, 'Passwords do not match.')).toBe(true);
    expect(mockAuth.createUserWithEmailAndPassword).not.toHaveBeenCalled();
  });

  test('mismatched confirmation alone blocks the call', async () => {
    const tree = render({ replace: jest.fn() });
    await toCreate(tree);
    type(tree, 'Email input', 'new@b.co');
    type(tree, 'Password input', 'secret1');
    type(tree, 'Confirm password input', 'secret2');
    await press(tree, 'Create account');
    expect(hasText(tree, 'Passwords do not match.')).toBe(true);
    expect(mockAuth.createUserWithEmailAndPassword).not.toHaveBeenCalled();
  });

  test('creates the account, stores the uid and navigates', async () => {
    const nav = { replace: jest.fn() };
    const tree = render(nav);
    await toCreate(tree);
    type(tree, 'Email input', 'new@b.co');
    type(tree, 'Password input', 'secret1');
    type(tree, 'Confirm password input', 'secret1');
    await press(tree, 'Create account');
    expect(mockAuth.createUserWithEmailAndPassword).toHaveBeenCalledWith('new@b.co', 'secret1');
    expect(mockAuth.signInWithEmailAndPassword).not.toHaveBeenCalled();
    expect(useAppStore.getState().userId).toBe('u2');
    expect(mockSaveFcmToken).toHaveBeenCalledWith('u2');
    expect(nav.replace).toHaveBeenCalledWith('Groups');
  });

  test('email-already-in-use is shown on the email field', async () => {
    mockAuth.createUserWithEmailAndPassword.mockRejectedValue({ code: 'auth/email-already-in-use', message: '[auth/email-already-in-use] x' });
    const tree = render({ replace: jest.fn() });
    await toCreate(tree);
    type(tree, 'Email input', 'dup@b.co');
    type(tree, 'Password input', 'secret1');
    type(tree, 'Confirm password input', 'secret1');
    await press(tree, 'Create account');
    expect(hasText(tree, 'An account with this email already exists.')).toBe(true);
  });

  test('editing a field clears its error', async () => {
    const tree = render({ replace: jest.fn() });
    await signedOut(tree);
    await press(tree, 'Sign in');
    expect(hasText(tree, 'Enter your email.')).toBe(true);
    type(tree, 'Email input', 'a');
    expect(hasText(tree, 'Enter your email.')).toBe(false);
  });
});
