/**
 * "Still there / Gone" — the post-hazard confirmation (docs/DEMO_PARITY_SPEC.md §3 Live).
 *  - Still there: another report at the cluster's spot (the normal 2-report DBSCAN rule keeps it active).
 *  - Gone: the rider's uid is added to hazards/{id}.gone_votes (arrayUnion, so a rider can vote once); the cluster
 *    is resolved once two DIFFERENT riders have said it is gone.
 */
import firestore from '@react-native-firebase/firestore';
import { P } from '../models/paths';
import { resolveHazard, submitHazardReport, triggerClustering } from '@hazard/services/hazardService';
import type { HazardType } from '../models/hazardCluster';

export const GONE_VOTES_TO_RESOLVE = 2;

/** Distinct, non-empty string ids from a `gone_votes` field of unknown shape. */
export function distinctVotes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v): v is string => typeof v === 'string' && v.length > 0))];
}

export function shouldResolve(votes: readonly string[]): boolean {
  return new Set(votes).size >= GONE_VOTES_TO_RESOLVE;
}

export interface GoneResult {
  votes: number;
  resolved: boolean;
}

export async function voteGone(clusterId: string, uid: string): Promise<GoneResult> {
  const ref = firestore().collection(P.hazards).doc(clusterId);
  await ref.update({ gone_votes: firestore.FieldValue.arrayUnion(uid) });
  const snap = await ref.get();
  const votes = distinctVotes((snap?.data?.() as { gone_votes?: unknown } | undefined)?.gone_votes);
  if (shouldResolve(votes)) {
    await resolveHazard(clusterId);
    return { votes: votes.length, resolved: true };
  }
  return { votes: votes.length, resolved: false };
}

/** Confirms the cluster is still there by reporting it again at its centroid. Returns whether the report was queued (offline). */
export async function confirmStillThere(args: {
  type: HazardType;
  lat: number;
  lng: number;
  riderId: string;
  groupId: string;
  hlc: string;
}): Promise<{ queued: boolean }> {
  const { queued } = await submitHazardReport(args.type, args.lat, args.lng, args.riderId, args.groupId, args.hlc);
  await triggerClustering(args.groupId);
  return { queued };
}
