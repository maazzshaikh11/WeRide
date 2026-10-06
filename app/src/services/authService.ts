/**
 * Phone + email authentication (OWNER: package A).
 * Phone: Firebase `signInWithPhoneNumber`; the pending ConfirmationResult is kept inside this module
 * (it cannot be serialised into navigation params). Firebase errors are mapped to `AuthFlowError` kinds so
 * screens never see "[auth/...]" text.
 * Email/password (the production sign-in kept from the first release) lives here too.
 */
import auth from '@react-native-firebase/auth';

export type AuthFailure = 'invalid-phone' | 'too-many-requests' | 'invalid-code' | 'code-expired' | 'network' | 'unknown';
export class AuthFlowError extends Error {
  constructor(public kind: AuthFailure, message: string) {
    super(message);
    this.name = 'AuthFlowError';
  }
}

/** Short, human sentence per failure kind (what the screens show). */
export const AUTH_FAILURE_MESSAGES: Record<AuthFailure, string> = {
  'invalid-phone': 'That number does not look right. Check it and try again.',
  'too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'invalid-code': 'That code is not right. Check the text and try again.',
  'code-expired': 'That code has expired. Ask for a new one.',
  network: 'No connection. Check your internet and try again.',
  unknown: 'Something went wrong. Please try again.',
};

const CODE_TO_KIND: Record<string, AuthFailure> = {
  'auth/invalid-phone-number': 'invalid-phone',
  'auth/missing-phone-number': 'invalid-phone',
  'auth/too-many-requests': 'too-many-requests',
  'auth/quota-exceeded': 'too-many-requests',
  'auth/network-request-failed': 'network',
  'auth/invalid-verification-code': 'invalid-code',
  'auth/missing-verification-code': 'invalid-code',
  'auth/code-expired': 'code-expired',
  'auth/session-expired': 'code-expired',
  'auth/invalid-verification-id': 'code-expired',
};

/** Maps a Firebase error (or anything thrown) to an AuthFlowError. */
export function toAuthFlowError(e: unknown): AuthFlowError {
  if (e instanceof AuthFlowError) return e;
  const code = typeof (e as { code?: unknown } | null)?.code === 'string' ? (e as { code: string }).code : '';
  const kind = CODE_TO_KIND[code] ?? 'unknown';
  return new AuthFlowError(kind, AUTH_FAILURE_MESSAGES[kind]);
}

interface PendingConfirmation {
  confirm: (code: string) => Promise<{ user?: { uid: string; phoneNumber?: string | null } | null } | null>;
}
let pending: PendingConfirmation | null = null;
let pendingPhone: string | null = null;

const E164 = /^\+[1-9]\d{7,14}$/;

/** `e164` like "+919876543210". Sends the SMS. */
export async function startPhoneSignIn(e164: string): Promise<void> {
  if (!E164.test(e164)) throw new AuthFlowError('invalid-phone', AUTH_FAILURE_MESSAGES['invalid-phone']);
  try {
    pending = (await auth().signInWithPhoneNumber(e164)) as unknown as PendingConfirmation;
    pendingPhone = e164;
  } catch (e) {
    pending = null;
    pendingPhone = null;
    throw toAuthFlowError(e);
  }
}

/** Confirms the 6-digit code; resolves with the signed-in uid and the verified phone. */
export async function confirmPhoneCode(code: string): Promise<{ uid: string; phone: string }> {
  const digits = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(digits)) throw new AuthFlowError('invalid-code', AUTH_FAILURE_MESSAGES['invalid-code']);
  if (!pending) throw new AuthFlowError('code-expired', AUTH_FAILURE_MESSAGES['code-expired']);
  try {
    const cred = await pending.confirm(digits);
    const user = cred?.user;
    if (!user?.uid) throw new AuthFlowError('unknown', AUTH_FAILURE_MESSAGES.unknown);
    const phone = user.phoneNumber || pendingPhone || '';
    pending = null;
    pendingPhone = null;
    return { uid: user.uid, phone };
  } catch (e) {
    const err = toAuthFlowError(e);
    // An expired code can never be retried; a wrong one can.
    if (err.kind === 'code-expired') {
      pending = null;
      pendingPhone = null;
    }
    throw err;
  }
}

/** True while a code has been sent and not yet confirmed. */
export function hasPendingPhoneSignIn(): boolean {
  return pending !== null;
}

/** The E.164 number the pending code was sent to (for "Sent to …" and resend), or null. */
export function pendingPhoneNumber(): string | null {
  return pendingPhone;
}

/** The phone number of the signed-in rider, if they signed in with one. */
export function currentPhoneNumber(): string | null {
  try {
    return auth().currentUser?.phoneNumber ?? null;
  } catch {
    return null;
  }
}

/** Email + password sign in. Rejects with the Firebase error (use `authErrorMessage`). */
export async function signInWithEmail(email: string, password: string): Promise<{ uid: string }> {
  const cred = await auth().signInWithEmailAndPassword(email, password);
  return { uid: cred.user.uid };
}

/** Email + password registration. Rejects with the Firebase error (use `authErrorMessage`). */
export async function createAccountWithEmail(email: string, password: string): Promise<{ uid: string }> {
  const cred = await auth().createUserWithEmailAndPassword(email, password);
  return { uid: cred.user.uid };
}

export async function signOut(): Promise<void> {
  pending = null;
  pendingPhone = null;
  await auth().signOut();
}
