/**
 * Mapbox Static Images URL for a ride's planned route thumbnail.
 *
 * Draws the plan's points (start → stops → destination) as an ember line with a
 * green start pin and an ember end pin, framed automatically. These are the
 * PLANNED waypoints joined by straight segments — the group document does not
 * store the road geometry — so callers must not present it as the road route.
 *
 * Returns null when there is nothing drawable or no token (callers fall back to
 * the on-device sketch).
 */
import { isUsableCoord, LatLng } from './mapFit';
import { encodePolyline } from './polyline';

export const ROUTE_HEX = 'FF4D00';
export const START_HEX = '2FD180';
const MAX_URL = 7800; // Mapbox limit is 8192 chars

export interface StaticMapOptions {
  points: LatLng[];
  width: number;
  height: number;
  token: string | undefined | null;
  style?: string;
}

export function buildStaticMapUrl({ points, width, height, token, style = 'dark-v11' }: StaticMapOptions): string | null {
  if (!token) return null;
  const pts = points.filter((p) => isUsableCoord(p.lat, p.lng));
  if (pts.length === 0) return null;

  const first = pts[0];
  const last = pts[pts.length - 1];
  const distinct = pts.some((p) => p.lat !== first.lat || p.lng !== first.lng);
  const fmt = (n: number) => n.toFixed(5);

  const overlays: string[] = [];
  if (distinct) overlays.push(`path-4+${ROUTE_HEX}-1(${encodeURIComponent(encodePolyline(pts))})`);
  if (distinct) overlays.push(`pin-s+${START_HEX}(${fmt(first.lng)},${fmt(first.lat)})`);
  overlays.push(`pin-s+${ROUTE_HEX}(${fmt(last.lng)},${fmt(last.lat)})`);

  // 'auto' frames the overlays; with a single location there is no extent to fit.
  const view = distinct ? 'auto' : `${fmt(first.lng)},${fmt(first.lat)},14`;
  const w = Math.min(1280, Math.max(1, Math.round(width)));
  const h = Math.min(1280, Math.max(1, Math.round(height)));
  const query = `${distinct ? 'padding=36&' : ''}access_token=${encodeURIComponent(token)}`;
  const url = `https://api.mapbox.com/styles/v1/mapbox/${style}/static/${overlays.join(',')}/${view}/${w}x${h}@2x?${query}`;
  return url.length > MAX_URL ? null : url;
}
