/**
 * Camera fit planning for the ride map ("the route is the hero").
 *
 * Pure functions only — no Mapbox import — so the edge cases are unit-tested.
 * MapScreen turns a FitPlan into camera.fitBounds() / camera.setCamera().
 *
 * Edge cases handled here:
 *  - same start/end, or a route shorter than MIN_FIT_SPAN_M → a 'point' plan
 *    (centre + street-level zoom) instead of a degenerate zero-area box that
 *    Mapbox would zoom to its max level;
 *  - unusable coordinates (NaN, out of range, and (0,0) "null island", which is
 *    what an uninitialised fix looks like) are dropped — a single stray (0,0)
 *    would otherwise stretch the box across the Atlantic and zoom the map out
 *    to the whole world;
 *  - very long routes need no special case: the box simply gets large and
 *    Mapbox picks a low zoom, same as Google Maps.
 */

export type LngLat = [number, number];

export interface LatLng {
  lat: number;
  lng: number;
}

export type FitPlan =
  | { kind: 'bounds'; ne: LngLat; sw: LngLat }
  | { kind: 'point'; center: LngLat; zoom: number };

/** Below this box size (metres, longest side) we centre + zoom instead of fitting. */
export const MIN_FIT_SPAN_M = 150;
/** Street-level zoom used for 'point' plans (same start/end, very short routes). */
export const POINT_FIT_ZOOM = 16;

const M_PER_DEG_LAT = 111_320;

/** True for a coordinate that can be shown on a map and is not (0,0). */
export function isUsableCoord(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  // (0,0) is the Gulf of Guinea: never a real ride, always an uninitialised fix.
  if (lat === 0 && lng === 0) return false;
  return true;
}

export function planFit(points: LatLng[]): FitPlan | null {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  let count = 0;

  for (const p of points) {
    if (!isUsableCoord(p.lat, p.lng)) continue;
    count += 1;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  if (count === 0) return null;

  const midLat = (minLat + maxLat) / 2;
  const midLng = (minLng + maxLng) / 2;
  const heightM = (maxLat - minLat) * M_PER_DEG_LAT;
  const widthM = (maxLng - minLng) * M_PER_DEG_LAT * Math.cos((midLat * Math.PI) / 180);

  if (Math.max(heightM, widthM) < MIN_FIT_SPAN_M) {
    return { kind: 'point', center: [midLng, midLat], zoom: POINT_FIT_ZOOM };
  }
  return { kind: 'bounds', ne: [maxLng, maxLat], sw: [minLng, minLat] };
}

/**
 * Viewport padding [top, right, bottom, left] that keeps the route clear of the
 * floating header (top), FAB column (right) and bottom sheet (bottom).
 */
export function fitPadding(layout: {
  headerHeight: number;
  fabColumnWidth: number;
  sheetHeight: number;
  gutter?: number;
}): [number, number, number, number] {
  const gutter = layout.gutter ?? 32;
  return [
    layout.headerHeight + gutter,
    layout.fabColumnWidth + gutter,
    layout.sheetHeight + gutter,
    gutter,
  ];
}
