/**
 * Crews (OWNER: package C1). API fixed by docs/DEMO_PARITY_SPEC.md.
 * crews/{id}: name, created_by, member_ids, roles, join_code, created_at.
 *
 * A crew code uses the same alphabet as a ride code (no 0/O/1/I/L) so a rider can type either on the Join screen;
 * the screen tries the crew collection first and falls back to ride codes (see JoinScreen).
 */
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import type { Crew, CrewRole } from '../models/domain';
import { P } from '../models/paths';

export type CrewErrorKind = 'not-found' | 'bad-code' | 'bad-name' | 'signed-out' | 'network' | 'unknown';

export class CrewError extends Error {
  constructor(public kind: CrewErrorKind, message: string) {
    super(message);
    this.name = 'CrewError';
  }
}

export const CREW_NAME_MIN = 2;
export const CREW_NAME_MAX = 22;
/** Same alphabet as ride codes (no 0/O/1/I/L), 6 characters, case-insensitive. */
export const CREW_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CREW_CODE_LENGTH = 6;
const CODE_RE = new RegExp(`^[${CREW_CODE_ALPHABET}]{${CREW_CODE_LENGTH}}$`);

export function isCrewCode(input: string): boolean {
  return CODE_RE.test(String(input ?? '').trim().toUpperCase());
}

export function generateCrewCode(random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < CREW_CODE_LENGTH; i++) out += CREW_CODE_ALPHABET[Math.floor(random() * CREW_CODE_ALPHABET.length)];
  return out;
}

function toMs(v: any): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v.toMillis === 'function') {
    try {
      const n = v.toMillis();
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return null;
}

/** Tolerant converter: a missing/odd field falls back to a neutral value, never throws and never invents a rider. */
export function crewFromDoc(id: string, data: Record<string, any> | undefined): Crew {
  const d = data ?? {};
  const members: string[] = Array.isArray(d.member_ids) ? Array.from(new Set(d.member_ids.filter((m: unknown): m is string => typeof m === 'string' && !!m))) : [];
  const roles: Record<string, CrewRole> = {};
  if (d.roles && typeof d.roles === 'object') {
    for (const [uid, r] of Object.entries(d.roles as Record<string, unknown>)) {
      if (r === 'lead' || r === 'sweep') roles[uid] = r;
    }
  }
  return {
    id,
    name: typeof d.name === 'string' && d.name.trim() ? d.name.trim() : 'Crew',
    created_by: typeof d.created_by === 'string' ? d.created_by : '',
    member_ids: members,
    roles,
    join_code: typeof d.join_code === 'string' ? d.join_code.toUpperCase() : '',
    created_ms: toMs(d.created_at) ?? toMs(d.created_ms),
  };
}

const db = () => firestore();

function currentUid(): string {
  const uid = auth().currentUser?.uid;
  if (!uid) throw new CrewError('signed-out', 'Sign in first.');
  return uid;
}

function wrap(e: unknown): CrewError {
  if (e instanceof CrewError) return e;
  const code = (e as { code?: string })?.code ?? '';
  if (/unavailable|deadline-exceeded|network/i.test(code) || /network|offline|unavailable/i.test(String((e as Error)?.message ?? ''))) {
    return new CrewError('network', "Can't reach the server. Check your connection and try again.");
  }
  return new CrewError('unknown', (e as Error)?.message || 'Something went wrong.');
}

async function uniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCrewCode();
    const taken = await db().collection(P.crews).where('join_code', '==', code).limit(1).get();
    if (taken.empty) return code;
  }
  throw new CrewError('unknown', 'Could not allocate a crew code. Try again.');
}

/** Creates the crew with the signed-in rider as its only member and its lead. */
export async function createCrew(name: string): Promise<Crew> {
  const clean = String(name ?? '').trim().replace(/\s+/g, ' ');
  if (clean.length < CREW_NAME_MIN || clean.length > CREW_NAME_MAX) {
    throw new CrewError('bad-name', `A crew name is ${CREW_NAME_MIN} to ${CREW_NAME_MAX} characters.`);
  }
  try {
    const uid = currentUid();
    const code = await uniqueCode();
    const ref = db().collection(P.crews).doc();
    await ref.set({
      name: clean,
      created_by: uid,
      member_ids: [uid],
      roles: { [uid]: 'lead' },
      join_code: code,
      created_at: firestore.FieldValue.serverTimestamp(),
    });
    return { id: ref.id, name: clean, created_by: uid, member_ids: [uid], roles: { [uid]: 'lead' }, join_code: code, created_ms: Date.now() };
  } catch (e) {
    throw wrap(e);
  }
}

/** Resolves a crew code and adds the signed-in rider; rejects with CrewError('not-found') for an unknown code. */
export async function joinCrewByCode(code: string): Promise<Crew> {
  const clean = String(code ?? '').trim().toUpperCase();
  if (!isCrewCode(clean)) throw new CrewError('bad-code', 'Codes have six characters.');
  try {
    const uid = currentUid();
    const snap = await db().collection(P.crews).where('join_code', '==', clean).limit(1).get();
    if (snap.empty) throw new CrewError('not-found', `No crew uses ${clean}.`);
    const doc = snap.docs[0];
    const crew = crewFromDoc(doc.id, doc.data());
    if (crew.member_ids.includes(uid)) return crew;
    await db().doc(P.crew(doc.id)).update({ member_ids: firestore.FieldValue.arrayUnion(uid) });
    return { ...crew, member_ids: [...crew.member_ids, uid] };
  } catch (e) {
    throw wrap(e);
  }
}

/** Removes the signed-in rider from the crew (and from its roles). The crew stays for the others. */
export async function leaveCrew(crewId: string): Promise<void> {
  try {
    const uid = currentUid();
    await db().doc(P.crew(crewId)).update({
      member_ids: firestore.FieldValue.arrayRemove(uid),
      [`roles.${uid}`]: firestore.FieldValue.delete(),
    });
  } catch (e) {
    throw wrap(e);
  }
}

export async function getCrew(crewId: string): Promise<Crew | null> {
  try {
    const snap = await db().doc(P.crew(crewId)).get();
    return snap.exists ? crewFromDoc(crewId, snap.data()) : null;
  } catch (e) {
    throw wrap(e);
  }
}

/** Newest first; a crew whose server timestamp has not landed yet (null) counts as newest. */
export function sortCrews(crews: Crew[]): Crew[] {
  return [...crews].sort((a, b) => (b.created_ms ?? Number.MAX_SAFE_INTEGER) - (a.created_ms ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name));
}

export function subscribeMyCrews(uid: string, onCrews: (crews: Crew[]) => void, onError?: (e: unknown) => void): () => void {
  return db()
    .collection(P.crews)
    .where('member_ids', 'array-contains', uid)
    .onSnapshot(
      (snap: any) => onCrews(sortCrews(snap.docs.map((d: any) => crewFromDoc(d.id, d.data())))),
      (e: unknown) => onError?.(e),
    );
}

/** A ride found by its short code (read-only lookup used by the Join screen to describe a ride join). */
export interface RideByCode {
  id: string;
  name: string;
  member_ids: string[];
  start_time_ms: number | null;
}

export async function findRideByCode(code: string): Promise<RideByCode | null> {
  const clean = String(code ?? '').trim().toUpperCase();
  if (!isCrewCode(clean)) return null;
  try {
    const snap = await db().collection(P.rides).where('join_code', '==', clean).limit(1).get();
    if (snap.empty) return null;
    const d = snap.docs[0].data() ?? {};
    return {
      id: snap.docs[0].id,
      name: typeof d.name === 'string' && d.name.trim() ? d.name.trim() : 'Ride',
      member_ids: Array.isArray(d.member_ids) ? d.member_ids : [],
      start_time_ms: toMs(d.start_time_ms),
    };
  } catch (e) {
    throw wrap(e);
  }
}

/** The soonest unfinished ride of a crew, straight from Firestore (the rider may not be in it yet). */
export async function getCrewNextRide(crewId: string, now: number = Date.now()): Promise<{ id: string; name: string; start_time_ms: number } | null> {
  try {
    const snap = await db().collection(P.rides).where('crew_id', '==', crewId).get();
    let best: { id: string; name: string; start_time_ms: number } | null = null;
    snap.docs.forEach((doc: any) => {
      const d = doc.data() ?? {};
      const t = toMs(d.start_time_ms);
      if (t == null || d.status === 'finished' || t < now - 6 * 3_600_000) return;
      if (!best || t < best.start_time_ms) best = { id: doc.id, name: typeof d.name === 'string' && d.name.trim() ? d.name.trim() : 'Ride', start_time_ms: t };
    });
    return best;
  } catch {
    return null;
  }
}
