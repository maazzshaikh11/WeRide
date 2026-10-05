/**
 * Group List / Join / Create Ride service.
 * Firestore groups/ CRUD. Used by the GroupListScreen.
 * Ported from group_service.dart.
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

export function generateJoinCode(random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    out += JOIN_CODE_ALPHABET[Math.floor(random() * JOIN_CODE_ALPHABET.length)];
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
   * A join code not used by any existing group. Read-then-write, so two
   * simultaneous creates could in theory pick the same code; with 31^6 (~887M)
   * codes that is accepted rather than adding a server-side counter.
   */
  private async _uniqueJoinCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateJoinCode();
      const taken = await this._firestore
        .collection('groups')
        .where('join_code', '==', code)
        .limit(1)
        .get();
      if (taken.empty) return code;
    }
    throw new Error('Could not allocate a join code — try again');
  }

  async createGroup(name?: string, plan?: RidePlanPayload, meta?: RideMeta): Promise<string> {
    const groupId = this._uuid();
    const uid = this._auth.currentUser!.uid;
    const joinCode = await this._uniqueJoinCode();

    await this._firestore.collection('groups').doc(groupId).set({
      name: name ?? `Ride ${Date.now()}`,
      created_by: uid,
      member_ids: [uid],
      created_at: firestore.FieldValue.serverTimestamp(),
      active_ride_id: null,
      join_code: joinCode,
      ...(meta?.ride_type ? { ride_type: meta.ride_type } : {}),
      ...(meta?.start_time_ms ? { start_time_ms: meta.start_time_ms } : {}),
      ...(plan ? { ride_plan: plan } : {}),
    });
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

  /** Resolve a short join code or a raw group id to a group id. */
  private async _resolveGroupId(input: string): Promise<string> {
    const trimmed = input.trim();
    if (!isJoinCode(trimmed)) return trimmed; // legacy: the group id itself
    const snap = await this._firestore
      .collection('groups')
      .where('join_code', '==', trimmed.toUpperCase())
      .limit(1)
      .get();
    if (snap.empty) throw new Error(`Group "${trimmed}" not found`);
    return snap.docs[0].id;
  }

  /** Join by short code (e.g. "K7M2QX") or by raw group id. */
  async joinGroup(groupCode: string): Promise<void> {
    const uid = this._auth.currentUser!.uid;
    const groupId = await this._resolveGroupId(groupCode);

    try {
      await this._firestore.collection('groups').doc(groupId).update({
        member_ids: firestore.FieldValue.arrayUnion(uid),
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
