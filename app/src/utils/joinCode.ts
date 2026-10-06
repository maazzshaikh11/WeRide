/**
 * Ride join codes: 6 characters, no 0/O/1/I/L (they are read aloud and typed on a phone). Mirrors
 * `generateJoinCode` in modules/routing-eta/src/group/groupService.ts (same alphabet and length, so a ride
 * code and a crew code are interchangeable at the Join screen) without importing that module, whose own
 * Firebase copy cannot be loaded by tests that don't mock it.
 */
export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const JOIN_CODE_LENGTH = 6;

/**
 * Uniform index in [0, n) from the platform CSPRNG (crypto.getRandomValues, polyfilled by react-native-get-random-values,
 * imported first in index.js). Rejection sampling avoids modulo bias. Join codes are what lets a stranger into a ride, so
 * they must not come from Math.random (predictable, seedable). Throws if no secure source exists rather than degrading.
 */
function secureIndex(n: number): number {
  const c = (globalThis as { crypto?: { getRandomValues?: <T extends Uint8Array>(a: T) => T } }).crypto;
  if (!c || typeof c.getRandomValues !== 'function') throw new Error('no secure random source for join codes');
  const limit = 256 - (256 % n);
  const buf = new Uint8Array(1);
  for (;;) {
    c.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}

/** `random` is only for deterministic tests; production callers use the default (cryptographically secure). */
export function generateJoinCode(random?: () => number): string {
  let out = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    const idx = random ? Math.floor(random() * JOIN_CODE_ALPHABET.length) : secureIndex(JOIN_CODE_ALPHABET.length);
    out += JOIN_CODE_ALPHABET[idx];
  }
  return out;
}
