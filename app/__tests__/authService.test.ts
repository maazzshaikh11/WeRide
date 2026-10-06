/**
 * authService: phone sign-in (Firebase signInWithPhoneNumber), error mapping, email auth, sign out.
 */
const mockConfirm = jest.fn();
const mockSignInWithPhoneNumber = jest.fn();
const mockSignOut = jest.fn();
const mockSignInEmail = jest.fn();
const mockCreateEmail = jest.fn();
let mockCurrentUser: { phoneNumber?: string | null } | null = null;

jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: () => ({
    get currentUser() {
      return mockCurrentUser;
    },
    signInWithPhoneNumber: (...a: unknown[]) => mockSignInWithPhoneNumber(...a),
    signOut: (...a: unknown[]) => mockSignOut(...a),
    signInWithEmailAndPassword: (...a: unknown[]) => mockSignInEmail(...a),
    createUserWithEmailAndPassword: (...a: unknown[]) => mockCreateEmail(...a),
  }),
}));

import {
  AuthFlowError, confirmPhoneCode, createAccountWithEmail, currentPhoneNumber, hasPendingPhoneSignIn,
  pendingPhoneNumber, signInWithEmail, signOut, startPhoneSignIn, toAuthFlowError,
} from '../src/services/authService';

const fbError = (code: string) => Object.assign(new Error(`[${code}] raw sdk text`), { code });

beforeEach(async () => {
  jest.clearAllMocks();
  mockCurrentUser = null;
  mockSignOut.mockResolvedValue(undefined);
  mockConfirm.mockReset();
  mockSignInWithPhoneNumber.mockReset().mockResolvedValue({ confirm: mockConfirm });
  await signOut(); // clears any pending confirmation from the previous test
});

describe('startPhoneSignIn', () => {
  it('sends the SMS for a valid E.164 number and remembers the number', async () => {
    await startPhoneSignIn('+919876543210');
    expect(mockSignInWithPhoneNumber).toHaveBeenCalledWith('+919876543210');
    expect(hasPendingPhoneSignIn()).toBe(true);
    expect(pendingPhoneNumber()).toBe('+919876543210');
  });

  it.each(['9876543210', '+91 98765 43210', '+0123456789', '', '+91abc', '+12345'])('rejects %p as invalid-phone without calling Firebase', async (n) => {
    await expect(startPhoneSignIn(n)).rejects.toMatchObject({ kind: 'invalid-phone' });
    expect(mockSignInWithPhoneNumber).not.toHaveBeenCalled();
  });

  it.each([
    ['auth/invalid-phone-number', 'invalid-phone'],
    ['auth/too-many-requests', 'too-many-requests'],
    ['auth/quota-exceeded', 'too-many-requests'],
    ['auth/network-request-failed', 'network'],
    ['auth/something-else', 'unknown'],
  ])('maps %s to %s and never leaks the raw SDK text', async (code, kind) => {
    mockSignInWithPhoneNumber.mockRejectedValue(fbError(code));
    const err = await startPhoneSignIn('+919876543210').catch((e) => e);
    expect(err).toBeInstanceOf(AuthFlowError);
    expect(err.kind).toBe(kind);
    expect(err.message).not.toContain('[auth/');
    expect(hasPendingPhoneSignIn()).toBe(false);
  });
});

describe('confirmPhoneCode', () => {
  it('confirms and resolves with the uid and the verified phone, then forgets the confirmation', async () => {
    await startPhoneSignIn('+919876543210');
    mockConfirm.mockResolvedValue({ user: { uid: 'u1', phoneNumber: '+919876543210' } });
    await expect(confirmPhoneCode('123456')).resolves.toEqual({ uid: 'u1', phone: '+919876543210' });
    expect(mockConfirm).toHaveBeenCalledWith('123456');
    expect(hasPendingPhoneSignIn()).toBe(false);
  });

  it('falls back to the number the code was sent to when the user has no phoneNumber yet', async () => {
    await startPhoneSignIn('+919876543210');
    mockConfirm.mockResolvedValue({ user: { uid: 'u1' } });
    await expect(confirmPhoneCode('123456')).resolves.toEqual({ uid: 'u1', phone: '+919876543210' });
  });

  it('without a sent code it reports an expired code', async () => {
    await expect(confirmPhoneCode('123456')).rejects.toMatchObject({ kind: 'code-expired' });
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it.each(['12345', '1234567', 'abcdef', ''])('rejects the malformed code %p locally', async (c) => {
    await startPhoneSignIn('+919876543210');
    await expect(confirmPhoneCode(c)).rejects.toMatchObject({ kind: 'invalid-code' });
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('a wrong code maps to invalid-code and can be retried', async () => {
    await startPhoneSignIn('+919876543210');
    mockConfirm.mockRejectedValueOnce(fbError('auth/invalid-verification-code'));
    await expect(confirmPhoneCode('000000')).rejects.toMatchObject({ kind: 'invalid-code' });
    expect(hasPendingPhoneSignIn()).toBe(true);
    mockConfirm.mockResolvedValue({ user: { uid: 'u2', phoneNumber: '+919876543210' } });
    await expect(confirmPhoneCode('123456')).resolves.toMatchObject({ uid: 'u2' });
  });

  it('an expired code maps to code-expired and drops the confirmation', async () => {
    await startPhoneSignIn('+919876543210');
    mockConfirm.mockRejectedValue(fbError('auth/code-expired'));
    await expect(confirmPhoneCode('123456')).rejects.toMatchObject({ kind: 'code-expired' });
    expect(hasPendingPhoneSignIn()).toBe(false);
  });

  it('a network failure keeps the confirmation so the rider can retry', async () => {
    await startPhoneSignIn('+919876543210');
    mockConfirm.mockRejectedValue(fbError('auth/network-request-failed'));
    await expect(confirmPhoneCode('123456')).rejects.toMatchObject({ kind: 'network' });
    expect(hasPendingPhoneSignIn()).toBe(true);
  });

  it('a confirmation with no user is an unknown failure', async () => {
    await startPhoneSignIn('+919876543210');
    mockConfirm.mockResolvedValue(null);
    await expect(confirmPhoneCode('123456')).rejects.toMatchObject({ kind: 'unknown' });
  });
});

describe('toAuthFlowError', () => {
  it('passes AuthFlowError through and maps session-expired', () => {
    const e = new AuthFlowError('network', 'x');
    expect(toAuthFlowError(e)).toBe(e);
    expect(toAuthFlowError(fbError('auth/session-expired')).kind).toBe('code-expired');
    expect(toAuthFlowError('boom').kind).toBe('unknown');
    expect(toAuthFlowError(null).kind).toBe('unknown');
  });
});

describe('email + session helpers', () => {
  it('signs in and registers with email, returning the uid', async () => {
    mockSignInEmail.mockResolvedValue({ user: { uid: 'e1' } });
    mockCreateEmail.mockResolvedValue({ user: { uid: 'e2' } });
    await expect(signInWithEmail('a@b.co', 'secret1')).resolves.toEqual({ uid: 'e1' });
    await expect(createAccountWithEmail('a@b.co', 'secret1')).resolves.toEqual({ uid: 'e2' });
    expect(mockSignInEmail).toHaveBeenCalledWith('a@b.co', 'secret1');
    expect(mockCreateEmail).toHaveBeenCalledWith('a@b.co', 'secret1');
  });

  it('email errors reject with the Firebase error untouched (screens map them)', async () => {
    mockSignInEmail.mockRejectedValue(fbError('auth/invalid-credential'));
    await expect(signInWithEmail('a@b.co', 'x')).rejects.toMatchObject({ code: 'auth/invalid-credential' });
  });

  it('currentPhoneNumber reads the signed-in user', () => {
    expect(currentPhoneNumber()).toBeNull();
    mockCurrentUser = { phoneNumber: '+919876543210' };
    expect(currentPhoneNumber()).toBe('+919876543210');
    mockCurrentUser = { phoneNumber: null };
    expect(currentPhoneNumber()).toBeNull();
  });

  it('signOut signs out of Firebase and forgets a pending code', async () => {
    await startPhoneSignIn('+919876543210');
    await signOut();
    expect(mockSignOut).toHaveBeenCalled();
    expect(hasPendingPhoneSignIn()).toBe(false);
    expect(pendingPhoneNumber()).toBeNull();
  });
});
