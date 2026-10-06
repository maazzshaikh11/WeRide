/**
 * Domain types for the demo-parity data model. See docs/DEMO_PARITY_SPEC.md §2 — that document and
 * infra/firebase/firestore.rules are the source of truth; keep all three in step.
 *
 * Firestore forbids nested arrays, so coordinates lists are FLAT number arrays: [lat, lng, lat, lng, …].
 */

export const RIDING_STYLES = ['Relaxed', 'Steady', 'Spirited'] as const;
export type RidingStyle = (typeof RIDING_STYLES)[number];

export const BIKES = ['Himalayan 450', 'Duke 390', 'Interceptor 650', 'Meteor 350', 'Other'] as const;

/** Public profile: users/{uid}. Readable by any signed-in user. */
export interface UserProfile {
  uid: string;
  name: string;
  bike: string;
  style: RidingStyle;
  created_ms?: number;
  stats: UserStats;
}

/** Lifetime totals, updated by the owner when a ride log is saved. together_sum / rides = average % together. */
export interface UserStats {
  km: number;
  rides: number;
  together_sum: number;
}

export const EMPTY_STATS: UserStats = { km: 0, rides: 0, together_sum: 0 };

export type HoldMs = 1000 | 1500 | 2000;
export type RoadTheme = 'night' | 'day' | 'auto';
export type Units = 'km' | 'mi';

/** users/{uid}/private/settings.prefs — owner only. */
export interface Prefs {
  hold_ms: HoldMs;
  glove: boolean;
  units: Units;
  road: RoadTheme;
  crash: boolean;
  learn: boolean;
  share: 'crew';
}

export const DEFAULT_PREFS: Prefs = {
  hold_ms: 1500,
  glove: false,
  units: 'km',
  road: 'auto',
  crash: true,
  learn: true,
  share: 'crew',
};

export interface EmergencyContact {
  id: string;
  name: string;
  number: string;
}

/** users/{uid}/private/settings — owner only. */
export interface PrivateSettings {
  prefs: Prefs;
  contacts: EmergencyContact[];
  onboarded: boolean;
  phone?: string;
}

export const DEFAULT_SETTINGS: PrivateSettings = { prefs: DEFAULT_PREFS, contacts: [], onboarded: false };

export type CrewRole = 'lead' | 'sweep';

/** crews/{crewId}: the persistent set of people. */
export interface Crew {
  id: string;
  name: string;
  created_by: string;
  member_ids: string[];
  roles: Record<string, CrewRole>;
  join_code: string;
  created_ms: number | null;
}

export type RideStatus = 'planned' | 'meetup' | 'live' | 'finished';
export type RsvpStatus = 'going' | 'maybe' | 'no';
export type RollCallState = 'ready' | 'notready';
export type PresenceState = 'riding' | 'stopped' | 'fuel' | 'ready' | 'arrived';

export interface Place {
  label: string;
  lat: number;
  lng: number;
}

/** A ride = a `groups/{rideId}` document (the existing group doc, plus the optional fields below). */
export interface Ride {
  id: string;
  name: string;
  created_by: string;
  member_ids: string[];
  crew_id: string | null;
  join_code: string | null;
  ride_type: string | null;
  pace: RidingStyle | null;
  start_time_ms: number | null;
  status: RideStatus;
  started_ms: number | null;
  finished_ms: number | null;
  meetup: Place | null;
  ride_plan: { start: Place | null; stops: { id: string; label: string; lat: number; lng: number; icon: string }[]; destination: Place | null } | null;
  invited_ids: string[];
  created_ms: number | null;
}

export interface RsvpDoc {
  uid: string;
  status: RsvpStatus;
  updated_ms: number;
}
export interface RollCallDoc {
  uid: string;
  state: RollCallState;
  updated_ms: number;
}
export interface PresenceDoc {
  uid: string;
  state: PresenceState;
  updated_ms: number;
}

export type RideEventKind = 'rolled' | 'hazard' | 'stop' | 'gap' | 'arrived' | 'sos';
export interface RideEvent {
  t_ms: number;
  kind: RideEventKind;
  text: string;
}
export type RouteRating = 'smooth' | 'mixed' | 'rough';

/** users/{uid}/ride_logs/{rideId} — owner only. `track` is flat [lat,lng,…], at most MAX_TRACK_POINTS points. */
export interface RideLog {
  ride_id: string;
  crew_id: string | null;
  name: string;
  started_ms: number;
  ended_ms: number;
  km: number;
  duration_s: number;
  avg_kmh: number;
  max_kmh: number;
  together_pct: number;
  longest_gap_m: number;
  riders: number;
  hazards_shared: number;
  signals_sent: number;
  track: number[];
  events: RideEvent[];
  rating: RouteRating | null;
  start: Place | null;
  destination: Place | null;
}
export const MAX_TRACK_POINTS = 600;

export interface SosResponder {
  uid: string;
  state: 'going' | 'arrived';
  updated_ms: number;
}
