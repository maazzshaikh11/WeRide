import { authErrorMessage, AUTH_FALLBACK_MESSAGE } from '../src/utils/authErrors';

describe('authErrorMessage', () => {
  const cases: [string, string][] = [
    ['auth/invalid-credential', 'Email or password is incorrect.'],
    ['auth/user-not-found', 'No account uses this email.'],
    ['auth/wrong-password', 'Email or password is incorrect.'],
    ['auth/invalid-email', 'Enter a valid email address.'],
    ['auth/email-already-in-use', 'An account with this email already exists.'],
    ['auth/weak-password', 'Use a password with at least 6 characters.'],
    ['auth/network-request-failed', 'No connection. Check your internet and try again.'],
    ['auth/too-many-requests', 'Too many attempts. Wait a few minutes and try again.'],
    ['auth/user-disabled', 'This account has been disabled.'],
  ];

  test.each(cases)('maps %s', (code, expected) => {
    expect(authErrorMessage(code)).toBe(expected);
  });

  test.each(cases)('maps an error object with code %s', (code, expected) => {
    expect(authErrorMessage({ code, message: `[${code}] raw sdk text` })).toBe(expected);
  });

  test('falls back for unknown codes, and never leaks raw text', () => {
    expect(authErrorMessage('auth/something-new')).toBe(AUTH_FALLBACK_MESSAGE);
    const out = authErrorMessage({ code: 'auth/x', message: '[auth/x] boom' });
    expect(out).toBe(AUTH_FALLBACK_MESSAGE);
    expect(out).not.toMatch(/\[auth\//);
  });

  test('falls back for non-error input', () => {
    expect(authErrorMessage(undefined)).toBe(AUTH_FALLBACK_MESSAGE);
    expect(authErrorMessage(null)).toBe(AUTH_FALLBACK_MESSAGE);
    expect(authErrorMessage(new Error('plain'))).toBe(AUTH_FALLBACK_MESSAGE);
    expect(authErrorMessage(42)).toBe(AUTH_FALLBACK_MESSAGE);
  });

  test('messages are single short sentences', () => {
    for (const [code] of cases) {
      const m = authErrorMessage(code);
      expect(m.length).toBeLessThanOrEqual(70);
      expect(m.endsWith('.')).toBe(true);
    }
  });
});
