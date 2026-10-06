/**
 * Phone + email authentication (OWNER: package A). API fixed by the spec; stub until implemented.
 * Phone: Firebase `signInWithPhoneNumber`; the pending confirmation is kept inside this module.
 */
export type AuthFailure = 'invalid-phone' | 'too-many-requests' | 'invalid-code' | 'code-expired' | 'network' | 'unknown';
export class AuthFlowError extends Error {
  constructor(public kind: AuthFailure, message: string) {
    super(message);
  }
}

/** `e164` like "+919876543210". Sends the SMS. */
export async function startPhoneSignIn(_e164: string): Promise<void> {
  throw new AuthFlowError('unknown', 'not implemented');
}
/** Confirms the 6-digit code; resolves with the signed-in uid and the verified phone. */
export async function confirmPhoneCode(_code: string): Promise<{ uid: string; phone: string }> {
  throw new AuthFlowError('unknown', 'not implemented');
}
export async function signOut(): Promise<void> {
  return undefined;
}
