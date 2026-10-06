/**
 * Small geometry helpers for the Ride tab and the Plan flow: distance from a point to a path, which hazard
 * clusters sit on a route, the middle of a route, and compacting a road geometry into a flat array that
 * fits in a Firestore document. Distances use an equirectangular projection, accurate to well under a
 * percent over the few-hundred-metre scales involved.
 */
import { isUsableCoord, LatLng } from './mapFit';

const M_PER_DEG = 111_320;

function project(p: LatLng, lat0: number): { x: number; y: number } {
  return { x: p.lng * M_PER_DEG * Math.cos((lat0 * Math.PI) / 180), y: p.lat * M_PER_DEG };
}

/** Metres from `p` to the segment a–b. */
export function distanceToSegmentM(p: LatLng, a: LatLng, b: LatLng): number {
  const lat0 = p.lat;
  const P = project(p, lat0), A = project(a, lat0), B = project(b, lat0);
  const dx = B.x - A.x, dy = B.y - A.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((P.x - A.x) * dx + (P.y - A.y) * dy) / len2));
  return Math.hypot(P.x - (A.x + t * dx), P.y - (A.y + t * dy));
}

/** Metres from `p` to the closest point on the polyline (Infinity for an empty path). */
export function distanceToPathM(p: LatLng, path: LatLng[]): number {
  if (path.length === 0) return Infinity;
  if (path.length === 1) return distanceToSegmentM(p, path[0], path[0]);
  let best = Infinity;
  for (let i = 1; i < path.length; i++) best = Math.min(best, distanceToSegmentM(p, path[i - 1], path[i]));
  return best;
}

export interface HazardLike {
  centroid_lat: number;
  centroid_lng: number;
}

/** Hazard clusters within `radiusM` of the route (the server scores a 100 m radius; the map shows a little more). */
export function hazardsNearPath<T extends HazardLike>(path: LatLng[], clusters: T[], radiusM = 150): T[] {
  if (path.length === 0) return [];
  return clusters.filter(
    (c) => isUsableCoord(c.centroid_lat, c.centroid_lng) && distanceToPathM({ lat: c.centroid_lat, lng: c.centroid_lng }, path) <= radiusM,
  );
}

function hav(a: LatLng, b: LatLng): number {
  const lat0 = (a.lat + b.lat) / 2;
  const A = project(a, lat0), B = project(b, lat0);
  return Math.hypot(A.x - B.x, A.y - B.y);
}

/** Length of the polyline in metres. */
export function pathLengthM(path: LatLng[]): number {
  let m = 0;
  for (let i = 1; i < path.length; i++) m += hav(path[i - 1], path[i]);
  return m;
}

/** The point half-way along the polyline (by distance), or null for an empty path. */
export function pathMidpoint(path: LatLng[]): LatLng | null {
  if (path.length === 0) return null;
  if (path.length === 1) return path[0];
  const half = pathLengthM(path) / 2;
  let run = 0;
  for (let i = 1; i < path.length; i++) {
    const seg = hav(path[i - 1], path[i]);
    if (run + seg >= half) {
      const t = seg === 0 ? 0 : (half - run) / seg;
      return { lat: path[i - 1].lat + (path[i].lat - path[i - 1].lat) * t, lng: path[i - 1].lng + (path[i].lng - path[i - 1].lng) * t };
    }
    run += seg;
  }
  return path[path.length - 1];
}

/** [[lat,lng],…] (the routing contract) → points. */
export function pairsToPoints(pairs: number[][]): LatLng[] {
  return pairs.filter((p) => p.length >= 2).map((p) => ({ lat: p[0], lng: p[1] }));
}

/** Points → flat [lat,lng,…], keeping at most `maxPoints` (always the first and last). Firestore forbids nested arrays. */
export function flattenPath(path: LatLng[], maxPoints = 150): number[] {
  const pts = path.filter((p) => isUsableCoord(p.lat, p.lng));
  if (pts.length === 0) return [];
  const n = Math.min(maxPoints, pts.length);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = pts[n === 1 ? 0 : Math.round((i * (pts.length - 1)) / (n - 1))];
    out.push(Math.round(p.lat * 1e5) / 1e5, Math.round(p.lng * 1e5) / 1e5);
  }
  return out;
}

export function unflattenPath(flat: unknown): LatLng[] {
  if (!Array.isArray(flat)) return [];
  const out: LatLng[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const lat = Number(flat[i]), lng = Number(flat[i + 1]);
    if (isUsableCoord(lat, lng)) out.push({ lat, lng });
  }
  return out;
}

/** Kilometres along the polyline to the point of it closest to `p` (null for fewer than two path points). */
export function distanceAlongPathKm(path: LatLng[], p: LatLng): number | null {
  if (path.length < 2) return null;
  let bestD = Infinity;
  let bestAlong = 0;
  let run = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const seg = hav(a, b);
    const d = distanceToSegmentM(p, a, b);
    if (d < bestD) {
      bestD = d;
      const lat0 = p.lat;
      const A = project(a, lat0), B = project(b, lat0), P = project(p, lat0);
      const dx = B.x - A.x, dy = B.y - A.y;
      const len2 = dx * dx + dy * dy;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((P.x - A.x) * dx + (P.y - A.y) * dy) / len2));
      bestAlong = run + seg * t;
    }
    run += seg;
  }
  return bestAlong / 1000;
}
