/** Ride logs: users/{uid}/ride_logs (OWNER: package C2). API fixed by the spec; stub until implemented. */
import type { RideLog, RouteRating } from '../models/domain';

/** Saves the log and bumps the rider's public lifetime stats. Idempotent per ride id. */
export async function saveRideLog(_uid: string, _log: RideLog): Promise<void> {
  return undefined;
}
export function subscribeRideLogs(_uid: string, _onLogs: (logs: RideLog[]) => void, _onError?: (e: unknown) => void): () => void {
  return () => undefined;
}
export async function getRideLog(_uid: string, _rideId: string): Promise<RideLog | null> {
  return null;
}
export async function setRouteRating(_uid: string, _rideId: string, _rating: RouteRating): Promise<void> {
  return undefined;
}
