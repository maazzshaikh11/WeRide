/**
 * Ride logs: users/{uid}/ride_logs/{rideId} (OWNER: package C2; owner-only by the rules).
 * Reads are tolerant (a malformed or older document never throws, it is sanitised); writes are idempotent per ride id.
 */
import firestore from '@react-native-firebase/firestore';
import { MAX_TRACK_POINTS, Place, RideEvent, RideEventKind, RideLog, RouteRating } from '../models/domain';
import { P } from '../models/paths';
import { decimateFlat } from '../utils/logStats';
import { bumpStats } from './userService';

const db = () => firestore();
const KINDS: readonly RideEventKind[] = ['rolled', 'hazard', 'stop', 'gap', 'arrived', 'sos'];
const RATINGS: readonly RouteRating[] = ['smooth', 'mixed', 'rough'];
/** Most recent logs kept live (the Log tab shows the season; this bounds the listener). */
export const MAX_LOGS = 200;

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
const nonNeg = (v: unknown) => Math.max(0, num(v));

function placeFrom(v: any): Place | null {
  if (!v || typeof v !== 'object') return null;
  const lat = Number(v.lat);
  const lng = Number(v.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { label: typeof v.label === 'string' ? v.label : '', lat, lng };
}

/** Flat [lat,lng,…]: keeps only valid pairs (also accepts [{lat,lng}] from older writers), at most MAX_TRACK_POINTS points. */
export function sanitizeTrack(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const flat: number[] = [];
  const push = (lat: unknown, lng: unknown) => {
    const a = Number(lat);
    const b = Number(lng);
    if (lat == null || lng == null || !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) return;
    flat.push(a, b);
  };
  if (raw.length > 0 && typeof raw[0] === 'object' && raw[0] !== null) {
    raw.forEach((p: any) => push(p?.lat, p?.lng));
  } else {
    for (let i = 0; i + 1 < raw.length; i += 2) push(raw[i], raw[i + 1]);
  }
  return decimateFlat(flat, MAX_TRACK_POINTS);
}

export function eventsFrom(raw: unknown): RideEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e) => e && KINDS.includes(e.kind) && Number.isFinite(Number(e.t_ms)))
    .map((e) => ({ t_ms: Number(e.t_ms), kind: e.kind as RideEventKind, text: typeof e.text === 'string' ? e.text : '' }))
    .sort((a, b) => a.t_ms - b.t_ms);
}

/** Firestore document -> RideLog, never throws. */
export function logFromDoc(rideId: string, data: Record<string, any> | undefined): RideLog {
  const d = data ?? {};
  const started = nonNeg(d.started_ms);
  const duration = nonNeg(d.duration_s);
  return {
    ride_id: typeof d.ride_id === 'string' && d.ride_id ? d.ride_id : rideId,
    crew_id: typeof d.crew_id === 'string' && d.crew_id ? d.crew_id : null,
    name: typeof d.name === 'string' && d.name.trim() ? d.name.trim() : 'Ride',
    started_ms: started,
    ended_ms: d.ended_ms != null && Number.isFinite(Number(d.ended_ms)) ? nonNeg(d.ended_ms) : started + duration * 1000,
    km: nonNeg(d.km),
    duration_s: duration,
    avg_kmh: nonNeg(d.avg_kmh),
    max_kmh: nonNeg(d.max_kmh),
    together_pct: Math.min(100, nonNeg(d.together_pct)),
    longest_gap_m: nonNeg(d.longest_gap_m),
    riders: Math.max(1, Math.round(num(d.riders, 1)) || 1),
    hazards_shared: Math.round(nonNeg(d.hazards_shared)),
    signals_sent: Math.round(nonNeg(d.signals_sent)),
    track: sanitizeTrack(d.track),
    events: eventsFrom(d.events),
    rating: RATINGS.includes(d.rating) ? d.rating : null,
    start: placeFrom(d.start),
    destination: placeFrom(d.destination),
  };
}

/** RideLog -> document. Firestore rejects `undefined`; `rating` is left out when unset so re-saving never clears a rating. */
export function logToDoc(log: RideLog): Record<string, any> {
  const clean = logFromDoc(log.ride_id, log as unknown as Record<string, any>);
  const { rating, ...rest } = clean;
  return { ...rest, ...(rating ? { rating } : {}) };
}

/**
 * Saves the log and bumps the rider's public lifetime stats, once per ride id: the stats are bumped only if the log
 * did not exist yet (or an earlier bump failed: the document carries `stats_counted`). Saving again just updates it.
 * The existence check is a plain read, not a transaction, so that it still works offline (cache) and the write queues.
 */
export async function saveRideLog(uid: string, log: RideLog): Promise<void> {
  const ref = db().doc(P.rideLog(uid, log.ride_id));
  let existing: Record<string, any> | null = null;
  try {
    const snap = await ref.get();
    existing = snap.exists ? snap.data() ?? {} : null;
  } catch {
    existing = null; // unreadable (offline with nothing cached): treat as new, the write queues
  }
  const isNew = existing === null;
  const needsBump = isNew || existing?.stats_counted === false;
  const doc = logToDoc(log);
  await ref.set(isNew ? { ...doc, stats_counted: false } : doc, { merge: true });
  if (needsBump) {
    await bumpStats(uid, { km: doc.km, togetherPct: doc.together_pct });
    await ref.set({ stats_counted: true }, { merge: true });
  }
}

/** Live list, newest ride first. Documents are sanitised by `logFromDoc`. */
export function subscribeRideLogs(uid: string, onLogs: (logs: RideLog[]) => void, onError?: (e: unknown) => void): () => void {
  return db()
    .collection(P.rideLogs(uid))
    .orderBy('started_ms', 'desc')
    .limit(MAX_LOGS)
    .onSnapshot(
      (snap: any) => onLogs(snap.docs.map((d: any) => logFromDoc(d.id, d.data()))),
      (e: unknown) => onError?.(e),
    );
}

export async function getRideLog(uid: string, rideId: string): Promise<RideLog | null> {
  const snap = await db().doc(P.rideLog(uid, rideId)).get();
  return snap.exists ? logFromDoc(rideId, snap.data()) : null;
}

/** Writes only the log's own `rating`. */
export async function setRouteRating(uid: string, rideId: string, rating: RouteRating): Promise<void> {
  await db().doc(P.rideLog(uid, rideId)).update({ rating });
}
