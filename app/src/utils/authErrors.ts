/**
 * Maps Firebase Auth errors to one short, human sentence.
 * Never returns the raw "[auth/...]" text the SDK puts in `message`.
 */

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/user-not-found': 'No account uses this email.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'Use a password with at least 6 characters.',
  'auth/network-request-failed': 'No connection. Check your internet and try again.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/user-disabled': 'This account has been disabled.',
};

export const AUTH_FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

/** Accepts a Firebase error code string or an error-like object with `code`. */
export function authErrorMessage(codeOrError: unknown): string {
  let code: unknown = codeOrError;
  if (codeOrError && typeof codeOrError === 'object') {
    code = (codeOrError as { code?: unknown }).code;
  }
  if (typeof code === 'string' && MESSAGES[code]) return MESSAGES[code];
  return AUTH_FALLBACK_MESSAGE;
}
