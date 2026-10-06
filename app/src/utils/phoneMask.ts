/**
 * Display-only masking of a phone number, like the demo's "+91 98•••• 21034":
 * country code, the first two digits of the national number, dots, then the last five.
 * The stored value is never changed. Anything too short to hide digits is returned as typed.
 */
export function maskPhone(raw: string): string {
  const t = (raw ?? '').trim();
  const digits = t.replace(/\D/g, '');
  const plus = t.startsWith('+');
  // National numbers are taken as 10 digits; anything before them is the country code.
  const nationalLen = Math.min(10, digits.length);
  const cc = digits.slice(0, digits.length - nationalLen);
  const national = digits.slice(digits.length - nationalLen);
  if (national.length < 8) return t;
  const prefix = cc ? `${plus ? '+' : ''}${cc} ` : '';
  return `${prefix}${national.slice(0, 2)}•••• ${national.slice(-5)}`;
}
