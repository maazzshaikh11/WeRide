/**
 * Rides across crews, RSVP, roll call, presence, ride status (OWNER: package B). API fixed by the spec; stub until implemented.
 * A ride is a `groups/{rideId}` document (see models/domain.ts `Ride`).
 */
import type { Place, PresenceDoc, PresenceState, RollCallDoc, RollCallState, Ride, RideStatus, RidingStyle, RsvpDoc, RsvpStatus } from '../models/domain';

export interface NewRideInput {
  name: string;
  crewId: string | null;
  start: Place | null;
  destination: Place;
  stops: { id: string; label: string; lat: number; lng: number; icon: string }[];
  startTimeMs: number;
  rideType?: string | null;
  pace?: RidingStyle | null;
  invitedIds?: string[];
  meetup?: Place | null;
}

/** Creates the ride (status 'planned') and returns its id. */
export async function createRide(_input: NewRideInput): Promise<string> {
  throw new Error('not implemented');
}
/** Rides the rider is a member of, newest activity first. */
export function subscribeMyRides(_uid: string, _onRides: (rides: Ride[]) => void, _onError?: (e: unknown) => void): () => void {
  return () => undefined;
}
export function subscribeRide(_rideId: string, _onRide: (ride: Ride | null) => void, _onError?: (e: unknown) => void): () => void {
  return () => undefined;
}
export async function setRideStatus(_rideId: string, _status: RideStatus): Promise<void> {
  return undefined;
}
export async function setRsvp(_rideId: string, _uid: string, _status: RsvpStatus): Promise<void> {
  return undefined;
}
export function subscribeRsvp(_rideId: string, _on: (docs: RsvpDoc[]) => void): () => void {
  return () => undefined;
}
export async function setRollCall(_rideId: string, _uid: string, _state: RollCallState): Promise<void> {
  return undefined;
}
export function subscribeRollCall(_rideId: string, _on: (docs: RollCallDoc[]) => void): () => void {
  return () => undefined;
}
export async function setPresence(_rideId: string, _uid: string, _state: PresenceState): Promise<void> {
  return undefined;
}
export function subscribePresence(_rideId: string, _on: (docs: PresenceDoc[]) => void): () => void {
  return () => undefined;
}
