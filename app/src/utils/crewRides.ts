/** Pure helpers for the Crews screens: which ride is a crew's next one, and how times/months read. */
import type { Ride, UserStats } from '../models/domain';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A planned ride whose start passed more than this long ago is treated as over. */
export const STALE_AFTER_MS = 6 * HOUR;

export function clock12(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "Today 6:30 AM", "Tomorrow 6:30 AM", "Sat 6:30 AM" (within a week) or "12 Oct 6:30 AM". */
export function formatWhen(ms: number, now: number = Date.now()): string {
  const days = Math.round((startOfDay(ms) - startOfDay(now)) / DAY);
  const t = clock12(ms);
  if (days === 0) return `Today ${t}`;
  if (days === 1) return `Tomorrow ${t}`;
  if (days > 1 && days < 7) return `${DOW[new Date(ms).getDay()]} ${t}`;
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${t}`;
}

/** "12 Oct" for a past date. */
export function formatDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

/** "MARCH" for the hero's "CREW ∙ EST. MARCH"; null when the creation time is unknown. */
export function monthName(ms: number | null | undefined): string | null {
  if (ms == null || !Number.isFinite(ms)) return null;
  return MONTHS[new Date(ms).getMonth()].toUpperCase();
}

/** A ride that is still ahead (or running): not finished, and not a planned ride long past its start. */
export function isUpcoming(r: Ride, now: number): boolean {
  if (r.status === 'finished') return false;
  if (r.status === 'live' || r.status === 'meetup') return true;
  return r.start_time_ms == null || r.start_time_ms > now - STALE_AFTER_MS;
}

/** The crew's upcoming rides, soonest first (rides without a start time last). */
export function upcomingCrewRides(rides: Ride[], crewId: string, now: number): Ride[] {
  return rides
    .filter((r) => r.crew_id === crewId && isUpcoming(r, now))
    .sort((a, b) => (a.start_time_ms ?? Number.MAX_SAFE_INTEGER) - (b.start_time_ms ?? Number.MAX_SAFE_INTEGER));
}

export function nextCrewRide(rides: Ride[], crewId: string, now: number): Ride | null {
  return upcomingCrewRides(rides, crewId, now)[0] ?? null;
}

/** True when the ride starts within the next 24 hours (the "Ride tomorrow" pill). */
export function startsWithin24h(r: Pick<Ride, 'start_time_ms'> | null, now: number): boolean {
  const t = r?.start_time_ms;
  return t != null && t >= now && t - now <= DAY;
}

/** together_sum / rides, whole percent; null when the rider has no rides. */
export function togetherPct(stats: UserStats): number | null {
  if (!stats.rides || stats.rides <= 0) return null;
  return Math.max(0, Math.min(100, Math.round(stats.together_sum / stats.rides)));
}
