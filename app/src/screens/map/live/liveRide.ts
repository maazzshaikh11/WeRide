/**
 * Pure ride-flow maths for the live screen: where is a hazard / planned stop / the destination relative to the
 * rider AHEAD along the route, when does a hazard count as "passed" (the Still there / Gone confirm), when is the
 * rider stationary at a stop, when have they arrived. No React, no Firestore: every function is unit-tested.
 * Everything is derived from the rider's own verified fix and the real route/clusters/plan — nothing is simulated.
 */
import { haversineMeters } from '../../../utils/geoUtils';
import type { HazardType } from '../../../models/hazardCluster';

export interface LatLng {
  lat: number;
  lng: number;
}

/** Hazard warning radius (demo: the plate arms at 520 m; spec: 500 m). */
export const HAZARD_AHEAD_M = 500;
/** How far either side of the route a point may sit and still count as "on" it. */
export const ROUTE_LATERAL_M = 80;
/** The rider must be this close to the route for "ahead along the route" to be meaningful. */
export const OWN_ON_ROUTE_M = 150;
/** The post-hazard confirm buttons stay up this long (spec: ~4 min). */
export const CONFIRM_WINDOW_MS = 4 * 60 * 1000;
/** Stop-ahead plate radius. */
export const STOP_AHEAD_M = 800;
/** Stationary-at-a-stop rule (spec §3 Stop): < 5 km/h for 20 s within 150 m. */
export const STOP_ZONE_M = 150;
export const STOP_SPEED_KMH = 5;
export const STOP_DWELL_MS = 20_000;
/** Arrive rule: within 150 m of the destination, after having been away from it. */
export const ARRIVE_M = 150;
export const ARRIVE_ARM_M = 500;
/** Signal-from-crew plate duration. */
export const SIGNAL_PLATE_MS = 15_000;

const M_PER_DEG = 111_320;

function xy(p: LatLng, ref: LatLng): { x: number; y: number } {
  return { x: (p.lng - ref.lng) * M_PER_DEG * Math.cos((ref.lat * Math.PI) / 180), y: (p.lat - ref.lat) * M_PER_DEG };
}

export interface RouteLine {
  pts: LatLng[];
  /** Cumulative metres at each vertex. */
  cum: number[];
}

/** route path_points ([lat,lng] pairs) → a line with cumulative distance; null when there is no usable line. */
export function buildRouteLine(path: readonly number[][] | null | undefined): RouteLine | null {
  if (!path) return null;
  const pts: LatLng[] = [];
  for (const p of path) {
    if (Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) pts.push({ lat: p[0], lng: p[1] });
  }
  if (pts.length < 2) return null;
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + haversineMeters(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng));
  return { pts, cum };
}

/** Closest point of the route to `p`: metres along the line and metres off it. */
export function projectOnRoute(line: RouteLine, p: LatLng): { alongM: number; offM: number } {
  let best = { alongM: 0, offM: Infinity };
  for (let i = 0; i < line.pts.length - 1; i++) {
    const a = line.pts[i];
    const b = line.pts[i + 1];
    const B = xy(b, a);
    const P = xy(p, a);
    const len2 = B.x * B.x + B.y * B.y;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (P.x * B.x + P.y * B.y) / len2));
    const dx = P.x - t * B.x;
    const dy = P.y - t * B.y;
    const off = Math.sqrt(dx * dx + dy * dy);
    if (off < best.offM) best = { alongM: line.cum[i] + t * Math.sqrt(len2), offM: off };
  }
  return best;
}

export interface Pose extends LatLng {
  /** Heading in degrees (0 = north), used only when there is no route to measure along. */
  headingDeg?: number;
  speedMps?: number;
}

/**
 * Signed distance of `target` AHEAD of the rider (negative = behind) and how far to the side it is.
 * Along the route when the rider is on it, otherwise along the rider's heading (only while moving);
 * null when neither is possible.
 */
export function aheadOf(line: RouteLine | null, own: Pose, target: LatLng): { aheadM: number; lateralM: number } | null {
  if (line) {
    const o = projectOnRoute(line, own);
    if (o.offM <= OWN_ON_ROUTE_M) {
      const t = projectOnRoute(line, target);
      return { aheadM: t.alongM - o.alongM, lateralM: t.offM };
    }
  }
  if (Number.isFinite(own.headingDeg) && (own.speedMps ?? 0) > 1) {
    const d = haversineMeters(own.lat, own.lng, target.lat, target.lng);
    const v = xy(target, own);
    const bearing = (Math.atan2(v.x, v.y) * 180) / Math.PI;
    const diff = ((((bearing - (own.headingDeg as number)) % 360) + 540) % 360) - 180;
    const rad = (diff * Math.PI) / 180;
    return { aheadM: d * Math.cos(rad), lateralM: Math.abs(d * Math.sin(rad)) };
  }
  return null;
}

export interface HazardLike {
  cluster_id: string;
  hazard_type: HazardType | string;
  centroid_lat: number;
  centroid_lng: number;
  report_count: number;
  status?: string;
}

export interface HazardPosition<H extends HazardLike = HazardLike> {
  cluster: H;
  aheadM: number;
}

/** Every active cluster that is within the corridor around the route/heading, with its signed distance ahead. */
export function hazardPositions<H extends HazardLike>(line: RouteLine | null, own: Pose, clusters: readonly H[]): HazardPosition<H>[] {
  const out: HazardPosition<H>[] = [];
  for (const c of clusters) {
    if (c.status && c.status !== 'active') continue;
    if (!Number.isFinite(c.centroid_lat) || !Number.isFinite(c.centroid_lng)) continue;
    const a = aheadOf(line, own, { lat: c.centroid_lat, lng: c.centroid_lng });
    if (!a || a.lateralM > ROUTE_LATERAL_M) continue;
    out.push({ cluster: c, aheadM: a.aheadM });
  }
  return out;
}

/** The nearest active hazard 0..maxM ahead of the rider, or null. */
export function hazardAhead<H extends HazardLike>(line: RouteLine | null, own: Pose, clusters: readonly H[], maxM = HAZARD_AHEAD_M): HazardPosition<H> | null {
  let best: HazardPosition<H> | null = null;
  for (const h of hazardPositions(line, own, clusters)) {
    if (h.aheadM < 0 || h.aheadM > maxM) continue;
    if (!best || h.aheadM < best.aheadM) best = h;
  }
  return best;
}

export interface HazardTracker {
  /** Clusters seen ahead (inside the warning radius) and not passed yet. */
  armed: string[];
  /** Clusters already offered for confirmation, never offered twice. */
  done: string[];
}
export const EMPTY_TRACKER: HazardTracker = { armed: [], done: [] };

/** A hazard counts as passed once it was ahead inside the warning radius and is now behind the rider. */
export const PASSED_BEHIND_M = -8;

export function stepHazardTracker<H extends HazardLike>(
  state: HazardTracker,
  positions: readonly HazardPosition<H>[],
  warnM = HAZARD_AHEAD_M,
): { state: HazardTracker; passed: H | null } {
  const armed = new Set(state.armed);
  const done = new Set(state.done);
  let passed: H | null = null;
  for (const { cluster, aheadM } of positions) {
    const id = cluster.cluster_id;
    if (done.has(id)) continue;
    if (aheadM >= 0 && aheadM <= warnM) armed.add(id);
    else if (aheadM < PASSED_BEHIND_M && aheadM > -400 && armed.has(id)) {
      armed.delete(id);
      done.add(id);
      if (!passed) passed = cluster;
    }
  }
  return { state: { armed: [...armed], done: [...done] }, passed };
}

export interface StopLike extends LatLng {
  id: string;
  label: string;
}

/** The nearest planned stop 0..800 m ahead that has not been visited yet. */
export function stopAhead<S extends StopLike>(
  line: RouteLine | null,
  own: Pose,
  stops: readonly S[],
  visited: ReadonlySet<string>,
  maxM = STOP_AHEAD_M,
): { stop: S; distanceM: number } | null {
  let best: { stop: S; distanceM: number } | null = null;
  for (const s of stops) {
    if (visited.has(s.id)) continue;
    const straight = haversineMeters(own.lat, own.lng, s.lat, s.lng);
    if (straight > maxM) continue;
    const a = aheadOf(line, own, s);
    // With a route/heading the stop must be in front of the rider; with neither, straight-line distance is all we know.
    if (a && a.aheadM < 0) continue;
    const d = a ? Math.max(0, a.aheadM) : straight;
    if (d > maxM) continue;
    if (!best || d < best.distanceM) best = { stop: s, distanceM: d };
  }
  return best;
}

/** The planned stop (if any) the rider is inside the 150 m stop zone of. */
export function stopInZone<S extends StopLike>(own: LatLng, stops: readonly S[], visited: ReadonlySet<string>): S | null {
  let best: { s: S; d: number } | null = null;
  for (const s of stops) {
    if (visited.has(s.id)) continue;
    const d = haversineMeters(own.lat, own.lng, s.lat, s.lng);
    if (d <= STOP_ZONE_M && (!best || d < best.d)) best = { s, d };
  }
  return best ? best.s : null;
}

export interface DwellState {
  stopId: string | null;
  sinceMs: number | null;
}
export const EMPTY_DWELL: DwellState = { stopId: null, sinceMs: null };

/** Stationary (< 5 km/h) inside a stop zone for 20 s straight → `open` is that stop's id. */
export function stepDwell(state: DwellState, input: { zoneStopId: string | null; speedKmh: number | null; now: number }): { state: DwellState; open: string | null } {
  const { zoneStopId, speedKmh, now } = input;
  const still = speedKmh != null && Number.isFinite(speedKmh) && speedKmh < STOP_SPEED_KMH;
  if (!zoneStopId || !still) return { state: EMPTY_DWELL, open: null };
  if (state.stopId !== zoneStopId || state.sinceMs == null) return { state: { stopId: zoneStopId, sinceMs: now }, open: null };
  if (now - state.sinceMs >= STOP_DWELL_MS) return { state: EMPTY_DWELL, open: zoneStopId };
  return { state, open: null };
}

export interface ArriveState {
  armed: boolean;
}

/** Arrive within 150 m of the destination, but only once the rider has been > 500 m away from it (a loop that starts at home never "arrives" at the meetup). */
export function stepArrive(state: ArriveState, own: LatLng, destination: LatLng | null): { state: ArriveState; arrived: boolean } {
  if (!destination) return { state, arrived: false };
  const d = haversineMeters(own.lat, own.lng, destination.lat, destination.lng);
  if (d > ARRIVE_ARM_M) return { state: { armed: true }, arrived: false };
  return { state, arrived: state.armed && d <= ARRIVE_M };
}

const HAZARD_NAMES: Record<string, string> = { pothole: 'Pothole', oil_spill: 'Oil', accident: 'Accident', debris: 'Debris', other: 'Hazard' };
export function hazardName(type: string): string {
  return HAZARD_NAMES[type] ?? 'Hazard';
}

/** "Reported by 2 riders" — the cluster only stores how many reports it has, never who made them. */
export function reportedBy(count: number): string {
  if (!Number.isFinite(count) || count <= 1) return 'Reported by a rider';
  return `Reported by ${count} riders`;
}
