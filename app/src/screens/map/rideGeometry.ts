/**
 * Pure geometry helpers shared by RouteOverlay (what is drawn) and MapScreen
 * (what the camera frames). Kept free of Mapbox/React so they are unit-tested.
 */
import type { RouteResponse } from '@app/models/routeResponse';
import { isUsableCoord, LatLng } from '@app/utils/mapFit';

export interface PlanPoint extends LatLng {
  label: string;
}

export interface RidePlanGeometry {
  start: PlanPoint | null;
  stops: PlanPoint[];
  destination: PlanPoint | null;
}

/** path_points ([lat,lng] pairs, contract order) → usable LatLng list. */
export function routeLatLngs(route: RouteResponse | null): LatLng[] {
  if (!route) return [];
  const out: LatLng[] = [];
  for (const p of route.path_points ?? []) {
    if (Array.isArray(p) && isUsableCoord(p[0], p[1])) out.push({ lat: p[0], lng: p[1] });
  }
  return out;
}

/** Every point the camera should frame: route line + start + stops + destination. */
export function fitPointsFor(route: RouteResponse | null, plan: RidePlanGeometry): LatLng[] {
  const pts: LatLng[] = [...routeLatLngs(route)];
  if (plan.start) pts.push(plan.start);
  plan.stops.forEach((s) => pts.push(s));
  if (plan.destination) pts.push(plan.destination);
  return pts.filter((p) => isUsableCoord(p.lat, p.lng));
}

/**
 * Changes whenever the camera should re-frame: the plan changed, or a route to
 * that plan arrived for the first time. Re-routes (new route_id, same plan) keep
 * the signature so the camera never jumps while the rider is looking around.
 */
export function fitSignature(plan: RidePlanGeometry, routeReady: boolean): string {
  const k = (p: LatLng | null) => (p ? `${p.lat.toFixed(5)},${p.lng.toFixed(5)}` : '-');
  return [
    k(plan.start),
    plan.stops.map(k).join(';'),
    k(plan.destination),
    routeReady ? 'route' : 'plan',
  ].join('|');
}

type PinKind = 'start' | 'stop' | 'end';

export interface RidePinFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: { kind: PinKind; n: string; label: string };
}

export interface RidePinCollection {
  type: 'FeatureCollection';
  features: RidePinFeature[];
}

const shortLabel = (label: string | undefined) => (label ?? '').split(',')[0].trim();

/**
 * Start / numbered stops / destination as one GeoJSON collection.
 * The start falls back to the route's first point when the plan has none
 * (route origin = the rider's own position), so there is always a start pin
 * once a route exists. Nothing is invented: no data → no pin.
 */
export function buildRidePins(
  plan: RidePlanGeometry,
  route: RouteResponse | null,
): RidePinCollection {
  const features: RidePinFeature[] = [];
  const add = (kind: PinKind, p: LatLng, label: string, n = '') => {
    if (!isUsableCoord(p.lat, p.lng)) return;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { kind, n, label: shortLabel(label) },
    });
  };

  const routePts = routeLatLngs(route);
  if (plan.start) add('start', plan.start, plan.start.label);
  else if (routePts.length > 0) add('start', routePts[0], 'You');

  plan.stops.forEach((s, i) => add('stop', s, s.label, String(i + 1)));
  if (plan.destination) add('end', plan.destination, plan.destination.label);

  return { type: 'FeatureCollection', features };
}
