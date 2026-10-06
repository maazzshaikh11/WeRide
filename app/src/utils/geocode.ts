/**
 * Mapbox Geocoding API v5 forward search.
 * Uses the app's public Mapbox token. Returns top matches for a query.
 */
import { MAPBOX_TOKEN } from '@env';

export interface GeoResult {
  label: string;
  lat: number;
  lng: number;
}

export interface GeocodeOptions {
  /** Bias results towards this point (Mapbox `proximity`), e.g. the midpoint of a route. */
  proximity?: { lat: number; lng: number };
}

/** True when a Mapbox token is configured (search and POI lookups can work). */
export function geocodingAvailable(token: string | undefined | null = MAPBOX_TOKEN): boolean {
  return Boolean(token);
}

function buildUrl(q: string, limit: number, opts?: GeocodeOptions): string {
  const prox =
    opts?.proximity && Number.isFinite(opts.proximity.lat) && Number.isFinite(opts.proximity.lng)
      ? `&proximity=${opts.proximity.lng},${opts.proximity.lat}`
      : '';
  return (
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json` +
    `?access_token=${MAPBOX_TOKEN}&limit=${limit}&types=place,locality,neighborhood,address,poi${prox}`
  );
}

function parseFeatures(json: any, q: string): GeoResult[] {
  return (json.features ?? []).map((f: any) => ({
    label: f.place_name ?? f.text ?? q,
    lat: f.center?.[1] ?? 0,
    lng: f.center?.[0] ?? 0,
  }));
}

/**
 * Like geocodeSearch but throws on network / HTTP errors, so callers can tell
 * "no places found" (resolves []) from "search unavailable" (rejects).
 */
export async function geocodeSearchStrict(query: string, limit = 5, opts?: GeocodeOptions): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const res = await fetch(buildUrl(q, limit, opts));
  if (!res.ok) throw new Error(`Geocoding failed (HTTP ${res.status})`);
  return parseFeatures(await res.json(), q);
}

export async function geocodeSearch(query: string, limit = 5, opts?: GeocodeOptions): Promise<GeoResult[]> {
  try {
    return await geocodeSearchStrict(query, limit, opts);
  } catch {
    return [];
  }
}

/**
 * Reverse geocode a point to a short place name ("Bandra West"), or null when it cannot be resolved
 * (no token, offline, nothing there). Used to label "my current position" as a real place.
 */
export async function reverseGeocode(lat: number, lng: number, token: string | undefined | null = MAPBOX_TOKEN): Promise<string | null> {
  if (!token || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
        `?access_token=${token}&limit=1&types=neighborhood,locality,place`,
    );
    if (!res.ok) return null;
    const f = ((await res.json()).features ?? [])[0];
    const label = f?.text ?? (typeof f?.place_name === 'string' ? f.place_name.split(',')[0] : null);
    return typeof label === 'string' && label.trim() ? label.trim() : null;
  } catch {
    return null;
  }
}
