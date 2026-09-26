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

export async function geocodeSearch(query: string, limit = 5): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json` +
    `?access_token=${MAPBOX_TOKEN}&limit=${limit}&types=place,locality,neighborhood,address,poi`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    return (json.features ?? []).map((f: any) => ({
      label: f.place_name ?? f.text ?? q,
      lat: f.center?.[1] ?? 0,
      lng: f.center?.[0] ?? 0,
    }));
  } catch {
    return [];
  }
}