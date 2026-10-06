/**
 * Turns the routing server's `alternatives` into the cards on the Plan > Route step. Everything shown is
 * what the server returned (duration, distance, safety score, hazard count); nothing is invented.
 */
import type { RouteAlternative, RouteResponse } from '../models/routeResponse';

export interface RouteOption {
  /** Index into the response's alternatives. */
  index: number;
  alt: RouteAlternative;
  title: string;
  durationMin: number;
  distanceKm: number;
  /** 0..100 */
  safety: number;
  hazardCount: number;
  /** "Passes 2 reported hazards · +7 min" */
  note: string;
  /** Only true for a route that is genuinely the safest, to highlight it. */
  recommended: boolean;
}

/** The options to show: the server's alternatives, or the single top-level route from an older server. */
export function alternativesOf(route: RouteResponse): RouteAlternative[] {
  if (route.alternatives && route.alternatives.length > 0) return route.alternatives.slice(0, 3);
  return [
    {
      route_id: route.route_id,
      path_points: route.path_points,
      distance_km: route.distance_km,
      eta_minutes: route.eta_minutes,
      safety_score: route.safety_score,
      hazard_count: 0,
      label: 'Alternative',
    },
  ];
}

export function hazardNote(count: number): string {
  if (count <= 0) return 'No reported hazards on this route';
  return `Passes ${count} reported ${count === 1 ? 'hazard' : 'hazards'}`;
}

export function buildOptions(alts: RouteAlternative[]): RouteOption[] {
  const minEta = Math.min(...alts.map((a) => a.eta_minutes));
  const altCount = alts.filter((a) => a.label === 'Alternative').length;
  let altN = 0;
  return alts.map((alt, index) => {
    const title =
      alts.length === 1 ? 'Your route'
      : alt.label === 'Alternative' ? (altCount > 1 ? `Alternative ${++altN}` : 'Alternative')
      : alt.label;
    const delta = Math.round(alt.eta_minutes - minEta);
    const note = hazardNote(alt.hazard_count) + (delta >= 1 ? ` · +${delta} min` : '');
    return {
      index,
      alt,
      title,
      durationMin: alt.eta_minutes,
      distanceKm: alt.distance_km,
      safety: Math.round(alt.safety_score * 100),
      hazardCount: alt.hazard_count,
      note,
      recommended: alts.length > 1 && alt.label === 'Safest',
    };
  });
}

/** "2h 05" / "58 min" from minutes. */
export function durationLabel(min: number): string {
  const total = Math.max(0, Math.round(min));
  const h = Math.floor(total / 60);
  return h > 0 ? `${h}h ${String(total % 60).padStart(2, '0')}` : `${total} min`;
}
