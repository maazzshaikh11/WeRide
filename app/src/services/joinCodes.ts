/**
 * Join codes (docs/security/firestore.md). A crew / ride is readable only by its members, so a code is NOT resolved by
 * querying crews/groups any more. Each code has its own document `join_codes/{CODE} = { kind, target_id }` that can only be
 * fetched by id (no list / query), so you can use a code only if you already know it.
 *
 *   create: the creator writes the target and its code doc in ONE batch (the rules check the target in the same batch);
 *   join:   the rider updates the target with  member_ids += uid  and  join_proof = "<CODE>:<uid>"  and nothing else.
 */
import firestore from '@react-native-firebase/firestore';
import { generateJoinCode } from '../utils/joinCode';

export type JoinKind = 'crew' | 'ride';
export interface JoinTarget {
  kind: JoinKind;
  id: string;
}

const db = () => firestore();
export const codePath = (code: string) => `join_codes/${code}`;

/** The value a joiner writes to `join_proof`: the code, bound to their own uid (so a stored proof cannot be replayed by someone else). */
export const joinProof = (code: string, uid: string) => `${code}:${uid}`;

/** Resolves a (normalised, valid) code to its target, or null when no such code exists. */
export async function lookupJoinCode(code: string): Promise<JoinTarget | null> {
  const snap = await db().doc(codePath(code)).get();
  if (!snap.exists) return null;
  const d = (snap.data() ?? {}) as { kind?: unknown; target_id?: unknown };
  if ((d.kind !== 'crew' && d.kind !== 'ride') || typeof d.target_id !== 'string' || !d.target_id) return null;
  return { kind: d.kind, id: d.target_id };
}

const MAX_ATTEMPTS = 5;

function isDenied(e: unknown): boolean {
  return (e as { code?: string } | null)?.code === 'permission-denied' || /permission[-_ ]denied/i.test(String((e as Error | null)?.message ?? ''));
}

/**
 * Writes `targetPath` (document built by `build(code)`) and its `join_codes/{code}` doc in one batch, with a code nobody
 * uses yet. Two riders picking the same code at once: the loser's batch is refused (a code doc cannot be overwritten),
 * and this tries another code. Returns the code that was stored.
 */
export async function createWithJoinCode(kind: JoinKind, targetPath: string, build: (code: string) => Record<string, unknown>): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateJoinCode();
    const taken = await db().doc(codePath(code)).get();
    if (taken.exists) continue;
    const batch = db().batch();
    batch.set(db().doc(targetPath), build(code));
    batch.set(db().doc(codePath(code)), { kind, target_id: targetPath.split('/')[1] });
    try {
      await batch.commit();
      return code;
    } catch (e) {
      if (isDenied(e) && attempt < MAX_ATTEMPTS - 1) continue; // lost a race for the code: try another
      throw e;
    }
  }
  throw new Error('Could not allocate a join code — try again');
}
