/**
 * Ride join codes: 6 characters, no 0/O/1/I/L (they are read aloud and typed on a phone). Mirrors
 * `generateJoinCode` in modules/routing-eta/src/group/groupService.ts (same alphabet and length, so a ride
 * code and a crew code are interchangeable at the Join screen) without importing that module, whose own
 * Firebase copy cannot be loaded by tests that don't mock it.
 */
export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const JOIN_CODE_LENGTH = 6;

export function generateJoinCode(random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) out += JOIN_CODE_ALPHABET[Math.floor(random() * JOIN_CODE_ALPHABET.length)];
  return out;
}
