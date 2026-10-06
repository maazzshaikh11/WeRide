/**
 * Which ride the Ride tab leads with, and the small derived labels around it. Pure functions: the screen
 * supplies `now`, so every branch is unit-tested.
 *
 * Priority: a live ride > a meetup ride > the nearest upcoming ride (starts in the future, or started less
 * than 12 h ago, and is not finished) > the rider's most recent finished ride when it ended less than 24 h
 * ago and they have a ride log for it.
 */
import type { Ride } from '../models/domain';

const MIN = 60_000;
const HOUR = 3_600_000;
/** A planned ride that started less than this long ago still counts as upcoming. */
export const UPCOMING_GRACE_MS = 12 * HOUR;
/** A finished ride stays the hero for this long after it ended. */
export const FINISHED_HERO_MS = 24 * HOUR;

export type HeroKind = 'planned' | 'meetup' | 'live' | 'finished';

/** The ride's scheduled start counts as "upcoming": in the future, or within the grace window. */
export function isUpcoming(r: Ride, now: number): boolean {
  if (r.status !== 'planned' && r.status !== 'meetup') return false;
  const t = r.start_time_ms;
  if (t == null) return false;
  return t >= now - UPCOMING_GRACE_MS;
}

export function endedMs(r: Ride): number | null {
  return r.finished_ms ?? r.started_ms ?? r.start_time_ms;
}

export function pickNextRide(rides: Ride[], now: number, logRideIds: ReadonlySet<string> | readonly string[] = []): Ride | null {
  const hasLog = (id: string) => (logRideIds instanceof Set ? logRideIds.has(id) : (logRideIds as readonly string[]).includes(id));

  const live = rides.filter((r) => r.status === 'live').sort((a, b) => (b.started_ms ?? 0) - (a.started_ms ?? 0));
  if (live.length) return live[0];

  const byNearest = (a: Ride, b: Ride) => Math.abs((a.start_time_ms ?? now) - now) - Math.abs((b.start_time_ms ?? now) - now);

  // Roll call has opened: it wins even when its scheduled time is far off.
  const meetup = rides.filter((r) => r.status === 'meetup').sort(byNearest);
  if (meetup.length) return meetup[0];

  const upcoming = rides.filter((r) => isUpcoming(r, now)).sort(byNearest);
  if (upcoming.length) return upcoming[0];

  const finished = rides
    .filter((r) => r.status === 'finished' && hasLog(r.id))
    .filter((r) => {
      const e = endedMs(r);
      return e != null && now - e < FINISHED_HERO_MS;
    })
    .sort((a, b) => (endedMs(b) ?? 0) - (endedMs(a) ?? 0));
  return finished[0] ?? null;
}

export function heroKind(r: Ride): HeroKind {
  return r.status;
}

/** The rider's other upcoming rides (the "Also coming up" list), soonest first. */
export function upcomingRides(rides: Ride[], now: number, excludeId?: string | null): Ride[] {
  return rides
    .filter((r) => r.id !== excludeId && isUpcoming(r, now))
    .sort((a, b) => (a.start_time_ms ?? 0) - (b.start_time_ms ?? 0));
}

/** "IN 49 MIN", "IN 3H 05M", "IN 2 DAYS"; "NOW" within a minute of the start; "STARTED 20 MIN AGO" after it. */
export function countdownLabel(startMs: number, now: number): string {
  const diff = startMs - now;
  const abs = Math.abs(diff);
  const mins = Math.floor(abs / MIN);
  if (diff > 0) {
    if (mins < 1) return 'IN 1 MIN';
    if (mins < 60) return `IN ${mins} MIN`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `IN ${h}H ${String(mins % 60).padStart(2, '0')}M`;
    const d = Math.floor(h / 24);
    return `IN ${d} ${d === 1 ? 'DAY' : 'DAYS'}`;
  }
  if (mins < 1) return 'NOW';
  if (mins < 60) return `STARTED ${mins} MIN AGO`;
  return `STARTED ${Math.floor(mins / 60)}H AGO`;
}

export interface PastDestination { label: string; short: string; lat: number; lng: number }

/**
 * Distinct places the rider has ridden to, newest first: the "Where next?" chips. Comes from their finished
 * rides and from their own ride logs (which outlive a ride they have since left).
 */
export function pastDestinations(
  rides: Ride[],
  logs: { destination: { label: string; lat: number; lng: number } | null; ended_ms: number }[] = [],
  limit = 4,
): PastDestination[] {
  const all: { d: { label: string; lat: number; lng: number }; at: number }[] = [];
  for (const r of rides) if (r.status === 'finished' && r.ride_plan?.destination) all.push({ d: r.ride_plan.destination, at: endedMs(r) ?? 0 });
  for (const l of logs) if (l.destination) all.push({ d: l.destination, at: l.ended_ms });
  all.sort((a, b) => b.at - a.at);
  const seen = new Set<string>();
  const out: PastDestination[] = [];
  for (const { d } of all) {
    const short = (d.label.split(',')[0] ?? '').trim();
    if (!short || seen.has(short.toLowerCase())) continue;
    seen.add(short.toLowerCase());
    out.push({ label: d.label, short, lat: d.lat, lng: d.lng });
    if (out.length >= limit) break;
  }
  return out;
}

/** The place a ride starts from: the meetup point, else the plan's start. */
export function rideStartPlace(r: Ride): { label: string; lat: number; lng: number } | null {
  return r.meetup ?? r.ride_plan?.start ?? null;
}
