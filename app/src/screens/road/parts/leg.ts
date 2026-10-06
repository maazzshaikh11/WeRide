/**
 * The "Next leg" card of the Stop screen, from the real route: what is next (the next planned stop not yet visited, else
 * the destination), how far and how long, and how many active hazards lie on that leg. Nothing is invented: unknown = null.
 */
import type { HazardLike, LatLng, RouteLine } from '../../map/live/liveRide';
import { buildRouteLine, hazardPositions, projectOnRoute } from '../../map/live/liveRide';

export interface NextLeg {
  name: string;
  km: number | null;
  minutes: number | null;
  hazards: number;
}

export interface LegStop extends LatLng {
  id: string;
  name: string;
}

export function nextLeg(input: {
  routePath: readonly number[][] | null;
  distanceKm: number | null;
  etaMinutes: number | null;
  own: LatLng | null;
  stops: readonly LegStop[];
  visited: ReadonlySet<string>;
  destinationName: string | null;
  clusters: readonly HazardLike[];
}): NextLeg | null {
  const { routePath, distanceKm, etaMinutes, own, stops, visited, destinationName, clusters } = input;
  const line: RouteLine | null = buildRouteLine(routePath);
  const total = line ? line.cum[line.cum.length - 1] : 0;
  const ownAlong = line && own ? projectOnRoute(line, own).alongM : null;

  // next planned stop that is still ahead along the route
  let next: { stop: LegStop; along: number } | null = null;
  if (line && ownAlong != null) {
    for (const st of stops) {
      if (visited.has(st.id)) continue;
      const a = projectOnRoute(line, st);
      if (a.offM > 300 || a.alongM <= ownAlong + 100) continue;
      if (!next || a.alongM < next.along) next = { stop: st, along: a.alongM };
    }
  }
  const name = next ? next.stop.name : destinationName;
  if (!name) return null;

  const legM = line && ownAlong != null ? (next ? next.along : total) - ownAlong : null;
  const remainM = line && ownAlong != null ? total - ownAlong : null;
  let km: number | null = null;
  let minutes: number | null = null;
  if (distanceKm != null && Number.isFinite(distanceKm)) {
    const share = legM != null && remainM != null && remainM > 0 ? Math.max(0, Math.min(1, legM / remainM)) : next ? null : 1;
    if (share != null) {
      km = distanceKm * share;
      minutes = etaMinutes != null && Number.isFinite(etaMinutes) ? etaMinutes * share : null;
    }
  }
  const hazards = own && legM != null
    ? hazardPositions(line, { lat: own.lat, lng: own.lng }, clusters).filter((h) => h.aheadM > 0 && h.aheadM <= legM).length
    : 0;
  return { name, km, minutes, hazards };
}

/** "m:ss" under an hour, "h:mm:ss" past it (the break timer). */
export function breakClock(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

export interface RollInput {
  allReady: boolean;
  meReady: boolean;
  /** The lead's presence on the previous and the current snapshot. */
  leadPrev: string | undefined;
  leadNow: string | undefined;
}

/** The break ends when everybody is ready, or when the lead (who was ready) has rolled on while I am ready too. */
export function shouldRoll({ allReady, meReady, leadPrev, leadNow }: RollInput): boolean {
  if (allReady) return true;
  return meReady && leadPrev === 'ready' && leadNow === 'riding';
}
