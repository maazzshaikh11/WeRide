/** "Popular with crews near you": the destinations of rides in the rider's crews, most-ridden first. Real rides only. */
import type { Crew, Ride } from '../models/domain';
import { haversineMeters } from './geoUtils';

export interface PopularPlace {
  label: string;
  short: string;
  lat: number;
  lng: number;
  rides: number;
  crewName: string | null;
  /** Straight-line km from the starting point (an approximation; null without a start). */
  kmFromStart: number | null;
}

export function popularPlaces(rides: Ride[], crews: Crew[], start: { lat: number; lng: number } | null, limit = 6): PopularPlace[] {
  const crewIds = new Set(crews.map((c) => c.id));
  const byName = new Map<string, PopularPlace & { last: number }>();
  for (const r of rides) {
    const d = r.ride_plan?.destination;
    if (!d || !r.crew_id || !crewIds.has(r.crew_id)) continue;
    const short = (d.label.split(',')[0] ?? '').trim();
    if (!short) continue;
    const key = short.toLowerCase();
    const last = r.start_time_ms ?? r.created_ms ?? 0;
    const hit = byName.get(key);
    if (hit) {
      hit.rides += 1;
      hit.last = Math.max(hit.last, last);
    } else {
      byName.set(key, {
        label: d.label,
        short,
        lat: d.lat,
        lng: d.lng,
        rides: 1,
        crewName: crews.find((c) => c.id === r.crew_id)?.name ?? null,
        kmFromStart: start ? haversineMeters(start.lat, start.lng, d.lat, d.lng) / 1000 : null,
        last,
      });
    }
  }
  return [...byName.values()]
    .sort((a, b) => b.rides - a.rides || b.last - a.last)
    .slice(0, limit)
    .map(({ last: _last, ...p }) => p);
}
