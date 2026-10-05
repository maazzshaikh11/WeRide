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

function buildUrl(q: string, limit: number): string {
  return (
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json` +
    `?access_token=${MAPBOX_TOKEN}&limit=${limit}&types=place,locality,neighborhood,address,poi`
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
export async function geocodeSearchStrict(query: string, limit = 5): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const res = await fetch(buildUrl(q, limit));
  if (!res.ok) throw new Error(`Geocoding failed (HTTP ${res.status})`);
  return parseFeatures(await res.json(), q);
}

export async function geocodeSearch(query: string, limit = 5): Promise<GeoResult[]> {
  try {
    return await geocodeSearchStrict(query, limit);
  } catch {
    return [];
  }
}
