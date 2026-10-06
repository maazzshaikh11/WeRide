/**
 * Group List / Join / Create Ride service.
 * Firestore groups/ CRUD. Used by the GroupListScreen.
 * Ported from group_service.dart.
 *
 * Join codes (docs/security/firestore.md): a group is readable only by its members, so a code is NOT resolved by querying
 * `groups`. Every code has a document `join_codes/{CODE} = { kind: 'ride', target_id }` that can be fetched by id only.
 * createGroup writes the group and its code doc in one batch; joinGroup resolves the code, then updates the group with
 * `member_ids += uid` and `join_proof = "<CODE>:<uid>"`. Joining by raw group id (the old legacy path) is no longer possible.
 */

import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { v4 as uuidv4 } from 'uuid';

export const RIDE_TYPES = ['Casual', 'Touring', 'Sport', 'Off-road'] as const;
export type RideType = (typeof RIDE_TYPES)[number];

export interface Group {
  id: string;
  name: string;
  created_by: string;
  member_ids: string[];
  created_at: any;
  active_ride_id: string | null;
  /** Short shareable code (6 chars). Absent on groups created before codes existed. */
  join_code?: string | null;
  ride_type?: RideType | null;
  /** Planned start, epoch ms. */
  start_time_ms?: number | null;
  /** Saved by Create Ride: start, stops and destination coordinates. */
  ride_plan?: RidePlanPayload | null;
}

/** Optional ride metadata chosen in the Create Ride modal. */
export interface RideMeta {
  ride_type?: RideType | null;
  start_time_ms?: number | null;
}

// No 0/O/1/I/L: codes are read aloud and typed on a phone.
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const JOIN_CODE_LENGTH = 6;
const JOIN_CODE_RE = new RegExp(`^[${JOIN_CODE_ALPHABET}]{${JOIN_CODE_LENGTH}}$`);

/** Uniform index in [0, n) from the platform CSPRNG (rejection sampling, no modulo bias). Throws if there is no secure source. */
function secureIndex(n: number): number {
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (!c || typeof c.getRandomValues !== 'function') throw new Error('no secure random source for join codes');
  const limit = 256 - (256 % n);
  const buf = new Uint8Array(1);
  for (;;) {
    c.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}

/** Join codes admit a rider to a ride, so they come from the CSPRNG; `random` exists only for deterministic tests. */
export function generateJoinCode(random?: () => number): string {
  let out = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    const idx = random ? Math.floor(random() * JOIN_CODE_ALPHABET.length) : secureIndex(JOIN_CODE_ALPHABET.length);
    out += JOIN_CODE_ALPHABET[idx];
  }
  return out;
}

/** True for a short join code (case-insensitive); false for a raw group id. */
export function isJoinCode(input: string): boolean {
  return JOIN_CODE_RE.test(input.trim().toUpperCase());
}

export interface RidePlanPayload {
  start: { label: string; lat: number; lng: number } | null;
  destination: { label: string; lat: number; lng: number } | null;
  stops: { id: string; label: string; lat: number; lng: number; icon: string }[];
}

export class GroupService {
  private _firestore: ReturnType<typeof firestore>;
  private _auth: ReturnType<typeof auth>;
  private _uuid = uuidv4;

  constructor() {
    this._firestore = firestore();
    this._auth = auth();
  }

  /**
   * Writes the group and its `join_codes/{code}` doc in one batch, with a code nobody uses yet. Read-then-write: if two
   * riders pick the same code at once the loser's batch is refused by the rules (a code doc cannot be overwritten) and
   * another code is tried. With 31^6 (~887M) codes a collision is rare.
   */
  private async _createWithCode(groupId: string, build: (code: string) => Record<string, unknown>): Promise<void> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateJoinCode();
      const taken = await this._firestore.collection('join_codes').doc(code).get();
      if (taken.exists) continue;
      const batch = this._firestore.batch();
      batch.set(this._firestore.collection('groups').doc(groupId), build(code));
      batch.set(this._firestore.collection('join_codes').doc(code), { kind: 'ride', target_id: groupId });
      try {
        await batch.commit();
        return;
      } catch (e: any) {
        if (e?.code === 'permission-denied' && attempt < 4) continue; // lost a race for the code
        throw e;
      }
    }
    throw new Error('Could not allocate a join code — try again');
  }

  async createGroup(name?: string, plan?: RidePlanPayload, meta?: RideMeta): Promise<string> {
    const groupId = this._uuid();
    const uid = this._auth.currentUser!.uid;

    await this._createWithCode(groupId, (joinCode) => ({
      name: String(name ?? `Ride ${Date.now()}`).slice(0, 60),
      created_by: uid,
      member_ids: [uid],
      created_at: firestore.FieldValue.serverTimestamp(),
      active_ride_id: null,
      join_code: joinCode,
      ...(meta?.ride_type ? { ride_type: meta.ride_type } : {}),
      ...(meta?.start_time_ms ? { start_time_ms: meta.start_time_ms } : {}),
      ...(plan ? { ride_plan: plan } : {}),
    }));
    return groupId;
  }

  /** Fetch a group's saved ride plan (from the Create Ride modal). */
  async getRidePlan(groupId: string): Promise<RidePlanPayload | null> {
    const snap = await this._firestore.collection('groups').doc(groupId).get();
    const data = snap.data() as any;
    return data?.ride_plan ?? null;
  }

  /** Fetch a group's metadata (name, members). Returns null when missing. */
  async getGroup(groupId: string): Promise<Group | null> {
    const snap = await this._firestore.collection('groups').doc(groupId).get();
    if (!snap.exists) return null;
    const data = snap.data() as any;
    return {
      id: groupId,
      name: data?.name ?? 'Ride',
      created_by: data?.created_by ?? '',
      member_ids: data?.member_ids ?? [],
      created_at: data?.created_at ?? null,
      active_ride_id: data?.active_ride_id ?? null,
      join_code: data?.join_code ?? null,
      ride_type: data?.ride_type ?? null,
      start_time_ms: data?.start_time_ms ?? null,
    };
  }

  /** Resolve a short join code to a group id through `join_codes/{CODE}`. Throws "not found" for an unknown code. */
  private async _resolveGroupId(code: string): Promise<string> {
    const snap = await this._firestore.collection('join_codes').doc(code.toUpperCase()).get();
    const d = snap.exists ? (snap.data() as { kind?: string; target_id?: string } | undefined) : undefined;
    if (!d || d.kind !== 'ride' || !d.target_id) throw new Error(`Group "${code}" not found`);
    return d.target_id;
  }

  /**
   * Join by short code (e.g. "K7M2QX"). The raw-group-id path of earlier versions is gone: groups are readable by
   * members only and joining needs proof of the code, so an id alone is useless (and no longer accepted).
   */
  async joinGroup(groupCode: string): Promise<void> {
    const uid = this._auth.currentUser!.uid;
    const code = groupCode.trim().toUpperCase();
    if (!isJoinCode(code)) throw new Error(`Group "${groupCode}" not found`);
    const groupId = await this._resolveGroupId(code);
    const ref = this._firestore.collection('groups').doc(groupId);

    // Already a member? (a stranger is refused the read, which just means "not yet")
    const existing = await ref.get().catch(() => null);
    if (existing?.exists && Array.isArray((existing.data() as any)?.member_ids) && (existing.data() as any).member_ids.includes(uid)) return;

    try {
      await ref.update({
        member_ids: firestore.FieldValue.arrayUnion(uid),
        join_proof: `${code}:${uid}`,
      });
    } catch (e: any) {
      if (e.code === 'not-found') {
        throw new Error(`Group "${groupCode}" not found`);
      }
      throw e;
    }
  }

  /**
   * Remove the current user from the group's member_ids (Firestore rules allow a
   * member to update the group). The group document is kept for other members.
   */
  async leaveGroup(groupId: string): Promise<void> {
    const uid = this._auth.currentUser!.uid;
    await this._firestore.collection('groups').doc(groupId).update({
      member_ids: firestore.FieldValue.arrayRemove(uid),
    });
  }

  /**
   * Subscribe to groups where current user is a member.
   * Returns a function to unsubscribe. When `onError` is given, a snapshot
   * failure is reported there instead of being delivered as an empty list.
   */
  myGroups(onGroups: (groups: Group[]) => void, onError?: (e: unknown) => void): () => void {
    const uid = this._auth.currentUser!.uid;
    const unsubscribe = this._firestore
      .collection('groups')
      .where('member_ids', 'array-contains', uid)
      .onSnapshot(
        (snapshot: any) => {
          const groups: Group[] = snapshot.docs.map((doc: any) => ({
            id: doc.id,
            ...doc.data(),
          } as Group));
          onGroups(groups);
        },
        (error: any) => {
          if (onError) {
            onError(error);
            return;
          }
          console.error('Error fetching groups:', error);
          onGroups([]);
        }
      );
    return unsubscribe;
  }
}
