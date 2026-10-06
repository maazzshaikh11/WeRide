/**
 * User profile + private settings (docs/DEMO_PARITY_SPEC.md §2).
 *   users/{uid}                  public profile  (name, bike, style, stats)
 *   users/{uid}/private/settings prefs, emergency contacts, onboarded flag, FCM token (owner only)
 * The pure converters are exported for tests; the Firestore calls are thin.
 */
import firestore from '@react-native-firebase/firestore';
import {
  DEFAULT_PREFS, DEFAULT_SETTINGS, EMPTY_STATS, RIDING_STYLES, EmergencyContact, HoldMs, Prefs, PrivateSettings,
  RidingStyle, RoadTheme, Units, UserProfile, UserStats,
} from '../models/domain';
import { P } from '../models/paths';

const HOLDS: readonly number[] = [1000, 1500, 2000];

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function profileFromDoc(uid: string, data: Record<string, any> | undefined): UserProfile {
  const d = data ?? {};
  const s = d.stats ?? {};
  const stats: UserStats = { km: num(s.km), rides: num(s.rides), together_sum: num(s.together_sum) };
  return {
    uid,
    name: typeof d.name === 'string' && d.name.trim() ? d.name.trim() : 'Rider',
    bike: typeof d.bike === 'string' && d.bike ? d.bike : 'Other',
    style: (RIDING_STYLES as readonly string[]).includes(d.style) ? (d.style as RidingStyle) : 'Steady',
    created_ms: typeof d.created_ms === 'number' ? d.created_ms : undefined,
    stats,
  };
}

/** Tolerant: unknown/invalid values fall back to the defaults, never throw. */
export function prefsFromDoc(p: Record<string, any> | undefined): Prefs {
  const d = p ?? {};
  return {
    hold_ms: (HOLDS.includes(d.hold_ms) ? d.hold_ms : DEFAULT_PREFS.hold_ms) as HoldMs,
    glove: typeof d.glove === 'boolean' ? d.glove : DEFAULT_PREFS.glove,
    units: (d.units === 'mi' || d.units === 'km' ? d.units : DEFAULT_PREFS.units) as Units,
    road: (['night', 'day', 'auto'].includes(d.road) ? d.road : DEFAULT_PREFS.road) as RoadTheme,
    crash: typeof d.crash === 'boolean' ? d.crash : DEFAULT_PREFS.crash,
    learn: typeof d.learn === 'boolean' ? d.learn : DEFAULT_PREFS.learn,
    share: 'crew',
  };
}

export function contactsFromDoc(list: unknown): EmergencyContact[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((c) => c && typeof c.name === 'string' && typeof c.number === 'string' && c.name.trim() && c.number.trim())
    .map((c, i) => ({ id: typeof c.id === 'string' && c.id ? c.id : `c${i}`, name: c.name.trim(), number: c.number.trim() }));
}

export function settingsFromDoc(data: Record<string, any> | undefined): PrivateSettings {
  const d = data ?? {};
  return {
    prefs: prefsFromDoc(d.prefs),
    contacts: contactsFromDoc(d.contacts),
    onboarded: d.onboarded === true,
    ...(typeof d.phone === 'string' && d.phone ? { phone: d.phone } : {}),
  };
}

/** A phone number is plausible for an SOS text: 7–15 digits, optional leading +, spaces/dashes allowed. */
export function normalizeNumber(input: string): string | null {
  const t = input.trim();
  const digits = t.replace(/[^\d]/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  if (!/^\+?[\d\s\-()]+$/.test(t)) return null;
  return (t.startsWith('+') ? '+' : '') + digits;
}

const db = () => firestore();

export async function getProfile(uid: string): Promise<UserProfile | null> {
  const snap = await db().doc(P.user(uid)).get();
  return snap.exists ? profileFromDoc(uid, snap.data()) : null;
}

/** Profiles for many uids (Firestore `in` allows 10 per query). Missing users are simply absent. */
export async function getProfiles(uids: string[]): Promise<Record<string, UserProfile>> {
  const out: Record<string, UserProfile> = {};
  const unique = Array.from(new Set(uids.filter(Boolean)));
  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const snap = await db().collection('users').where(firestore.FieldPath.documentId(), 'in', chunk).get();
    snap.docs.forEach((d: any) => {
      out[d.id] = profileFromDoc(d.id, d.data());
    });
  }
  return out;
}

export async function saveProfile(uid: string, p: { name: string; bike: string; style: RidingStyle }): Promise<void> {
  await db().doc(P.user(uid)).set(
    { name: p.name.trim().slice(0, 24) || 'Rider', bike: p.bike, style: p.style, created_ms: Date.now() },
    { merge: true },
  );
}

export function subscribeProfile(uid: string, onData: (p: UserProfile | null) => void, onError?: (e: unknown) => void): () => void {
  return db().doc(P.user(uid)).onSnapshot(
    (snap: any) => onData(snap.exists ? profileFromDoc(uid, snap.data()) : null),
    (e: unknown) => onError?.(e),
  );
}

export function subscribeSettings(uid: string, onData: (s: PrivateSettings) => void, onError?: (e: unknown) => void): () => void {
  return db().doc(P.settings(uid)).onSnapshot(
    (snap: any) => onData(snap.exists ? settingsFromDoc(snap.data()) : DEFAULT_SETTINGS),
    (e: unknown) => onError?.(e),
  );
}

export async function savePrefs(uid: string, patch: Partial<Prefs>): Promise<void> {
  await db().doc(P.settings(uid)).set({ prefs: patch }, { merge: true });
}

export async function saveContacts(uid: string, contacts: EmergencyContact[]): Promise<void> {
  await db().doc(P.settings(uid)).set({ contacts }, { merge: true });
}

export async function markOnboarded(uid: string, onboarded: boolean, phone?: string): Promise<void> {
  await db().doc(P.settings(uid)).set({ onboarded, ...(phone ? { phone } : {}) }, { merge: true });
}

/** Called once when a ride log is saved: lifetime totals shown on the rider card. */
export async function bumpStats(uid: string, d: { km: number; togetherPct: number }): Promise<void> {
  await db().doc(P.user(uid)).set(
    {
      stats: {
        km: firestore.FieldValue.increment(Math.max(0, d.km)),
        rides: firestore.FieldValue.increment(1),
        together_sum: firestore.FieldValue.increment(Math.max(0, Math.min(100, d.togetherPct))),
      },
    },
    { merge: true },
  );
}

export { EMPTY_STATS };
