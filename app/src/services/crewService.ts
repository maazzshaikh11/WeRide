/**
 * Crews (OWNER: package C1). API fixed by docs/DEMO_PARITY_SPEC.md; stub until implemented.
 * crews/{id}: name, created_by, member_ids, roles, join_code, created_at.
 */
import type { Crew } from '../models/domain';

export class CrewError extends Error {
  constructor(public kind: 'not-found' | 'bad-code' | 'network' | 'unknown', message: string) {
    super(message);
  }
}
/** Same alphabet as ride codes (no 0/O/1/I/L), 6 characters, case-insensitive. */
export function isCrewCode(_input: string): boolean {
  return false;
}
export async function createCrew(_name: string): Promise<Crew> {
  throw new CrewError('unknown', 'not implemented');
}
/** Resolves a crew code and adds the signed-in rider; rejects with CrewError('not-found') for an unknown code. */
export async function joinCrewByCode(_code: string): Promise<Crew> {
  throw new CrewError('unknown', 'not implemented');
}
export async function leaveCrew(_crewId: string): Promise<void> {
  return undefined;
}
export async function getCrew(_crewId: string): Promise<Crew | null> {
  return null;
}
export function subscribeMyCrews(_uid: string, _onCrews: (crews: Crew[]) => void, _onError?: (e: unknown) => void): () => void {
  return () => undefined;
}
