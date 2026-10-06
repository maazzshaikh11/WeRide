/**
 * Pure helpers for the SOS screens (no React, no Firebase): coordinates, clock, SMS link, direction, age.
 * Kept separate so the overlays, the listener and the tests all use the same numbers.
 */
import { haversineMeters } from '../utils/geoUtils';

export interface Fix {
  lat: number;
  lng: number;
  /** Horizontal accuracy in metres when known. */
  accuracy_m?: number | null;
}

/** "18.9718° N 73.3902° E" — four decimals (about 10 m), hemisphere letters like the demo. */
export function formatCoords(lat: number, lng: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${ns} ${Math.abs(lng).toFixed(4)}° ${ew}`;
}

/** Coordinates plus the accuracy when known: "18.9718° N 73.3902° E ∙ ±4 m". */
export function formatFixLine(fix: Fix | null): string {
  if (!fix) return 'No GPS fix yet';
  const acc = fix.accuracy_m != null && Number.isFinite(fix.accuracy_m) ? ` ∙ ±${Math.max(1, Math.round(fix.accuracy_m))} m` : '';
  return `${formatCoords(fix.lat, fix.lng)}${acc}`;
}

/** "6:43:12" (12-hour clock without am/pm, like the demo), local time. */
export function formatClock(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours() % 12 || 12;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${h}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** The text a contact receives. Without a name it is written in the first person; without a fix it has no link. */
export function sosSmsBody(name: string | null | undefined, fix: Fix | null): string {
  const who = name && name.trim() ? `${name.trim()} needs help.` : 'I need help.';
  const where = fix ? ` Live location: https://maps.google.com/?q=${fix.lat},${fix.lng}` : '';
  return `${who}${where} — sent by WeRide SOS.`;
}

/** `sms:<number>?body=<encoded>` — opens the SMS composer prefilled (the app never sends SMS itself). */
export function smsLink(number: string, name: string | null | undefined, fix: Fix | null): string {
  return `sms:${number}?body=${encodeURIComponent(sosSmsBody(name, fix))}`;
}

/** Compass bearing in degrees (0..360) from a to b. */
export function bearingDeg(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** A heading is only meaningful while moving. */
export const HEADING_MIN_SPEED_MPS = 1.5;

/**
 * Is `other` behind or ahead of me? Needs a trustworthy heading (I am moving); otherwise null and the
 * caller says "away". Ahead = within 90° of where I am heading.
 */
export function relativeDirection(
  me: { lat: number; lng: number; heading_deg?: number; speed_mps?: number },
  other: { lat: number; lng: number },
): 'ahead' | 'behind' | null {
  if (me.heading_deg == null || !Number.isFinite(me.heading_deg)) return null;
  if (me.speed_mps == null || !Number.isFinite(me.speed_mps) || me.speed_mps < HEADING_MIN_SPEED_MPS) return null;
  const b = bearingDeg(me, other);
  const diff = Math.abs(((b - me.heading_deg + 540) % 360) - 180);
  return diff < 90 ? 'ahead' : 'behind';
}

export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  return haversineMeters(a.lat, a.lng, b.lat, b.lng);
}

/** A real position (finite, in range, not the (0,0) "no fix" placeholder an SOS is sent with when nothing is known). */
export function isRealPosition(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

/** Wall-clock ms an SOS was raised, from its hybrid-logical-clock string "physical:counter" (or legacy "physical-counter"). */
export function sosCreatedMs(hlc: string | undefined | null): number | null {
  if (!hlc) return null;
  const n = Number(String(hlc).split(/[:-]/)[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** "SOS ∙ 8 S AGO" style age: seconds under a minute, then minutes. */
export function ageLabel(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} S AGO`;
  return `${Math.floor(s / 60)} MIN AGO`;
}

export interface ResponderLike {
  uid: string;
  state: 'going' | 'arrived';
  updated_ms: number;
}
export interface Loc {
  lat: number;
  lng: number;
  speed_mps?: number;
}

export interface NearestResponder {
  uid: string;
  state: 'going' | 'arrived';
  /** Metres from her last known fix to the SOS position, null when her position is unknown. */
  distanceM: number | null;
  /** Whole minutes, only when she is actually moving (>= 2 m/s) so it is not a guess. */
  etaMin: number | null;
  /** Other responders besides the nearest one. */
  others: number;
}

/**
 * The responder to show on the "is coming to you" row: the nearest by her last known fix; if nobody has a fix,
 * the earliest to respond. null while nobody has responded.
 */
export function nearestResponder(
  responders: ResponderLike[],
  target: { lat: number; lng: number } | null,
  locOf: (uid: string) => Loc | undefined,
): NearestResponder | null {
  if (responders.length === 0) return null;
  const rows = responders.map((r) => {
    const loc = locOf(r.uid);
    const usable = loc && target && isRealPosition(loc.lat, loc.lng) && isRealPosition(target.lat, target.lng);
    return { r, loc, d: usable ? distanceM(loc as Loc, target as { lat: number; lng: number }) : null };
  });
  const withD = rows.filter((x) => x.d != null).sort((a, b) => (a.d as number) - (b.d as number));
  const pick = withD[0] ?? [...rows].sort((a, b) => a.r.updated_ms - b.r.updated_ms)[0];
  const speed = pick.loc?.speed_mps;
  const etaMin = pick.d != null && pick.r.state === 'going' && speed != null && Number.isFinite(speed) && speed >= 2 ? Math.max(1, Math.round(pick.d / speed / 60)) : null;
  return { uid: pick.r.uid, state: pick.r.state, distanceM: pick.d, etaMin, others: rows.length - 1 };
}
