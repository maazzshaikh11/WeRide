/** The points a ride's map draws: its saved road geometry when it has one, else start → stops → destination. */
import type { Ride } from '../models/domain';
import { routeStatsOf } from '../services/rideService';
import { isUsableCoord, LatLng } from './mapFit';

export function planPointsOf(ride: Ride): LatLng[] {
  const road = routeStatsOf(ride)?.path ?? [];
  if (road.length >= 2) return road;
  const plan = ride.ride_plan;
  const start = ride.meetup ?? plan?.start ?? null;
  const all = [start, ...(plan?.stops ?? []), plan?.destination ?? null];
  return all.filter((p): p is NonNullable<typeof p> => !!p && isUsableCoord(p.lat, p.lng)).map((p) => ({ lat: p.lat, lng: p.lng }));
}
