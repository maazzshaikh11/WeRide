/**
 * Rides across crews, RSVP, roll call, presence and ride status (docs/DEMO_PARITY_SPEC.md §2).
 * A ride is a `groups/{rideId}` document (models/domain.ts `Ride`); RSVP / roll call / presence are
 * per-rider docs in subcollections that each member writes for themselves.
 *
 * The converters are exported (and pure) so legacy documents are tested: an old group has no `status`,
 * `crew_id` or `pace` and must still load as a `planned` ride.
 */
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { v4 as uuidv4 } from 'uuid';
import { RIDING_STYLES } from '../models/domain';
import type {
  Place, PresenceDoc, PresenceState, RollCallDoc, RollCallState, Ride, RideStatus, RidingStyle, RsvpDoc, RsvpStatus,
} from '../models/domain';
import { P } from '../models/paths';
import { createWithJoinCode } from './joinCodes';
import { flattenPath, unflattenPath } from '../utils/routeGeo';
import type { LatLng } from '../utils/mapFit';

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
  /** The route chosen in the Plan flow: saved with the ride so every member sees the same distance / time / safety. */
  route?: { distanceKm: number; etaMinutes: number; safetyScore: number; path: LatLng[] } | null;
}

/** What the planner knew about the road route when the ride was created (absent on rides made elsewhere). */
export interface RouteStats {
  distance_km: number;
  eta_minutes: number;
  /** 0..1 */
  safety_score: number;
  /** The road geometry, compacted (≤ 150 points). */
  path: LatLng[];
}
/** A Ride as the converters below return it: `route_stats` rides along (read it with `routeStatsOf`). */
export type RideWithRoute = Ride & { route_stats?: RouteStats | null };

export function routeStatsOf(ride: Ride): RouteStats | null {
  return (ride as RideWithRoute).route_stats ?? null;
}

export function routeStatsFromDoc(r: any): RouteStats | null {
  if (!r || typeof r !== 'object') return null;
  const distance_km = finite(r.distance_km);
  const eta_minutes = finite(r.eta_minutes);
  const safety_score = finite(r.safety_score);
  if (distance_km == null || eta_minutes == null || safety_score == null) return null;
  return { distance_km, eta_minutes, safety_score: Math.max(0, Math.min(1, safety_score)), path: unflattenPath(r.path) };
}

const STATUSES: readonly RideStatus[] = ['planned', 'meetup', 'live', 'finished'];
const RSVPS: readonly RsvpStatus[] = ['going', 'maybe', 'no'];
const ROLL_STATES: readonly RollCallState[] = ['ready', 'notready'];
const PRESENCE_STATES: readonly PresenceState[] = ['riding', 'stopped', 'fuel', 'ready', 'arrived'];

const db = () => firestore();
/** Longest ride name the Firestore rules accept. */
export const RIDE_NAME_MAX = 60;
/** Longest place label the rules accept for a ride's start / destination / meetup. */
const clip = (label: string) => String(label ?? '').slice(0, 120);

// ── tolerant converters ─────────────────────────────────────────────────────────────

function finite(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Firestore Timestamp | {seconds} | number | Date → epoch ms (null when absent/unreadable). */
export function toMs(v: unknown): number | null {
  if (v == null) return null;
  const t: any = v;
  if (typeof t.toMillis === 'function') {
    const n = t.toMillis();
    return Number.isFinite(n) ? n : null;
  }
  if (typeof t.seconds === 'number') return t.seconds * 1000;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const ms = new Date(t).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function placeFromDoc(p: any): Place | null {
  if (!p || typeof p !== 'object') return null;
  const lat = finite(p.lat);
  const lng = finite(p.lng);
  if (lat == null || lng == null) return null;
  return { label: typeof p.label === 'string' ? p.label : '', lat, lng };
}

function stringList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0) : [];
}

function planFromDoc(plan: any): Ride['ride_plan'] {
  if (!plan || typeof plan !== 'object') return null;
  const stops = Array.isArray(plan.stops)
    ? plan.stops
        .map((s: any) => {
          const p = placeFromDoc(s);
          return p ? { id: typeof s.id === 'string' ? s.id : `${p.lat},${p.lng}`, label: p.label, lat: p.lat, lng: p.lng, icon: typeof s.icon === 'string' ? s.icon : '' } : null;
        })
        .filter(Boolean)
    : [];
  return { start: placeFromDoc(plan.start), stops, destination: placeFromDoc(plan.destination) };
}

/** groups/{id} → Ride. Legacy groups (no status) are `planned`. Never throws. */
export function rideFromDoc(id: string, data: Record<string, any> | undefined): RideWithRoute {
  const d = data ?? {};
  const status = (STATUSES as readonly string[]).includes(d.status) ? (d.status as RideStatus) : 'planned';
  return {
    id,
    name: typeof d.name === 'string' && d.name.trim() ? d.name.trim() : 'Ride',
    created_by: typeof d.created_by === 'string' ? d.created_by : '',
    member_ids: stringList(d.member_ids),
    crew_id: typeof d.crew_id === 'string' && d.crew_id ? d.crew_id : null,
    join_code: typeof d.join_code === 'string' && d.join_code ? d.join_code : null,
    ride_type: typeof d.ride_type === 'string' && d.ride_type ? d.ride_type : null,
    pace: (RIDING_STYLES as readonly string[]).includes(d.pace) ? (d.pace as RidingStyle) : null,
    start_time_ms: finite(d.start_time_ms),
    status,
    started_ms: finite(d.started_ms),
    finished_ms: finite(d.finished_ms),
    meetup: placeFromDoc(d.meetup),
    ride_plan: planFromDoc(d.ride_plan),
    invited_ids: stringList(d.invited_ids),
    created_ms: toMs(d.created_at) ?? finite(d.created_ms),
    route_stats: routeStatsFromDoc(d.ride_plan?.route),
  };
}

export function rsvpFromDoc(uid: string, d: Record<string, any> | undefined): RsvpDoc | null {
  if (!d || !(RSVPS as readonly string[]).includes(d.status)) return null;
  return { uid, status: d.status as RsvpStatus, updated_ms: finite(d.updated_ms) ?? 0 };
}
export function rollCallFromDoc(uid: string, d: Record<string, any> | undefined): RollCallDoc | null {
  if (!d || !(ROLL_STATES as readonly string[]).includes(d.state)) return null;
  return { uid, state: d.state as RollCallState, updated_ms: finite(d.updated_ms) ?? 0 };
}
export function presenceFromDoc(uid: string, d: Record<string, any> | undefined): PresenceDoc | null {
  if (!d || !(PRESENCE_STATES as readonly string[]).includes(d.state)) return null;
  return { uid, state: d.state as PresenceState, updated_ms: finite(d.updated_ms) ?? 0 };
}

/** Newest activity first: the planned start if there is one, else when it was created. */
export function sortRides(rides: Ride[]): Ride[] {
  const key = (r: Ride) => r.start_time_ms ?? r.created_ms ?? 0;
  return [...rides].sort((a, b) => key(b) - key(a));
}

// ── ride documents ──────────────────────────────────────────────────────────────────

/** Firestore rejects `undefined`; drop it from the (shallow) document. */
function defined<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/**
 * Creates the ride (status 'planned') and returns its id. The creator is a member; so are the invitees (the rules accept
 * invitees only when they are members of the ride's crew). The ride and its `join_codes/{code}` doc are written in one
 * batch: a code is how others find the ride (rides cannot be queried by code any more).
 */
export async function createRide(input: NewRideInput): Promise<string> {
  const uid = auth().currentUser?.uid;
  if (!uid) throw new Error('Sign in to create a ride');
  const id = uuidv4();
  const invited = Array.from(new Set((input.invitedIds ?? []).filter((u) => u && u !== uid)));
  const start = input.start ? { label: clip(input.start.label), lat: input.start.lat, lng: input.start.lng } : null;
  const destination = { label: clip(input.destination.label), lat: input.destination.lat, lng: input.destination.lng };
  const meetup = input.meetup ?? input.start;
  await createWithJoinCode('ride', P.ride(id), (joinCode) =>
    defined({
      name: input.name.trim().slice(0, RIDE_NAME_MAX),
      created_by: uid,
      member_ids: [uid, ...invited],
      created_at: firestore.FieldValue.serverTimestamp(),
      active_ride_id: null,
      join_code: joinCode,
      status: 'planned' as RideStatus,
      crew_id: input.crewId ?? undefined,
      ride_type: input.rideType ?? undefined,
      pace: input.pace ?? undefined,
      start_time_ms: input.startTimeMs,
      invited_ids: invited,
      meetup: meetup ? { label: clip(meetup.label), lat: meetup.lat, lng: meetup.lng } : undefined,
      ride_plan: {
        start,
        destination,
        stops: input.stops.map((s) => ({ id: s.id, label: clip(s.label), lat: s.lat, lng: s.lng, icon: s.icon })),
        ...(input.route
          ? {
              route: {
                distance_km: input.route.distanceKm,
                eta_minutes: input.route.etaMinutes,
                safety_score: input.route.safetyScore,
                path: flattenPath(input.route.path),
              },
            }
          : {}),
      },
    }),
  );
  return id;
}

/** Rides the rider is a member of, newest activity first. */
export function subscribeMyRides(uid: string, onRides: (rides: Ride[]) => void, onError?: (e: unknown) => void): () => void {
  return db()
    .collection(P.rides)
    .where('member_ids', 'array-contains', uid)
    .onSnapshot(
      (snap: any) => onRides(sortRides(snap.docs.map((d: any) => rideFromDoc(d.id, d.data())))),
      (e: unknown) => onError?.(e),
    );
}

export function subscribeRide(rideId: string, onRide: (ride: Ride | null) => void, onError?: (e: unknown) => void): () => void {
  return db()
    .doc(P.ride(rideId))
    .onSnapshot(
      (snap: any) => onRide(snap.exists ? rideFromDoc(snap.id ?? rideId, snap.data()) : null),
      (e: unknown) => onError?.(e),
    );
}

/** One writer per transition; stamps started_ms / finished_ms for the ones that carry a time. */
export async function setRideStatus(rideId: string, status: RideStatus): Promise<void> {
  const now = Date.now();
  await db()
    .doc(P.ride(rideId))
    .update({ status, ...(status === 'live' ? { started_ms: now } : status === 'finished' ? { finished_ms: now } : {}) });
}

// ── per-rider subcollections ────────────────────────────────────────────────────────

export async function setRsvp(rideId: string, uid: string, status: RsvpStatus): Promise<void> {
  await db().doc(`${P.rsvp(rideId)}/${uid}`).set({ status, updated_ms: Date.now() });
}
export async function setRollCall(rideId: string, uid: string, state: RollCallState): Promise<void> {
  await db().doc(`${P.rollCall(rideId)}/${uid}`).set({ state, updated_ms: Date.now() });
}
export async function setPresence(rideId: string, uid: string, state: PresenceState): Promise<void> {
  await db().doc(`${P.presence(rideId)}/${uid}`).set({ state, updated_ms: Date.now() });
}

function subscribeDocs<T>(path: string, convert: (uid: string, d: Record<string, any> | undefined) => T | null, on: (docs: T[]) => void, onError?: (e: unknown) => void) {
  return db()
    .collection(path)
    .onSnapshot(
      (snap: any) => on(snap.docs.map((d: any) => convert(d.id, d.data())).filter((x: T | null): x is T => x != null)),
      (e: unknown) => onError?.(e),
    );
}

export function subscribeRsvp(rideId: string, on: (docs: RsvpDoc[]) => void, onError?: (e: unknown) => void): () => void {
  return subscribeDocs(P.rsvp(rideId), rsvpFromDoc, on, onError);
}
export function subscribeRollCall(rideId: string, on: (docs: RollCallDoc[]) => void, onError?: (e: unknown) => void): () => void {
  return subscribeDocs(P.rollCall(rideId), rollCallFromDoc, on, onError);
}
export function subscribePresence(rideId: string, on: (docs: PresenceDoc[]) => void, onError?: (e: unknown) => void): () => void {
  return subscribeDocs(P.presence(rideId), presenceFromDoc, on, onError);
}
