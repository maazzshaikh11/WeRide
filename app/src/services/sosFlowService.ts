/**
 * The SOS flow around the existing offline-first SOS service (OWNER: package E). API fixed by the spec; stub until implemented.
 */
export interface SosSendResult {
  sosId: string;
  /** true when it was saved to the on-phone queue instead of being written to Firestore (no signal). */
  queued: boolean;
}
/** Sends (or queues) the rider's SOS with the best known position. `drill` sends nothing. */
export async function sendSos(_opts: { groupId: string; drill?: boolean; auto?: boolean }): Promise<SosSendResult | null> {
  return null;
}
export async function cancelSos(_sosId: string, _groupId: string): Promise<void> {
  return undefined;
}
export async function respondToSos(_sosId: string, _uid: string, _state: 'going' | 'arrived'): Promise<void> {
  return undefined;
}
export function subscribeResponders(_sosId: string, _on: (r: { uid: string; state: 'going' | 'arrived'; updated_ms: number }[]) => void): () => void {
  return () => undefined;
}
