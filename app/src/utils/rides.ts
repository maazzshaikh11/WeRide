/**
 * Pure helpers behind the ride cards: distance, badge, grouping into sections.
 * Everything derives from fields the group document really has (ride_plan,
 * member_ids, ride_type, start_time_ms, created_at). Nothing is estimated that
 * we can't back: there is no ETA, average speed or safety score for a planned
 * ride, so none is shown.
 */
import type { Group } from '@routing/group/groupService';
import { haversineMeters } from './geoUtils';
import { isUsableCoord, LatLng } from './mapFit';

const HOUR = 3_600_000;
/** A ride that started less than this long ago still counts as current. */
export const RECENT_WINDOW_MS = 12 * HOUR;

export type BadgeTone = 'ice' | 'go' | 'dim';
export interface RideBadge { label: string; tone: BadgeTone }

/** start → stops → destination, usable points only. */
export function planPoints(group: Pick<Group, 'ride_plan'>): (LatLng & { label?: string })[] {
  const plan = group.ride_plan;
  if (!plan) return [];
  const all = [plan.start, ...(plan.stops ?? []), plan.destination];
  return all.filter((p): p is NonNullable<typeof p> => !!p && isUsableCoord(p.lat, p.lng));
}

/** Straight-line distance along the planned waypoints (km); null with < 2 points. */
export function planDistanceKm(group: Pick<Group, 'ride_plan'>): number | null {
  const pts = planPoints(group);
  if (pts.length < 2) return null;
  let m = 0;
  for (let i = 1; i < pts.length; i++) m += haversineMeters(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
  return m / 1000;
}

export function createdMs(group: Pick<Group, 'created_at'>): number {
  const c: any = group.created_at;
  if (!c) return 0;
  if (typeof c.toMillis === 'function') return c.toMillis();
  if (typeof c.seconds === 'number') return c.seconds * 1000;
  const t = new Date(c).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function rideBadge(group: Pick<Group, 'start_time_ms'>, now: number): RideBadge {
  const t = group.start_time_ms;
  if (!t) return { label: 'Planned', tone: 'dim' };
  if (t > now) return { label: 'Upcoming', tone: 'ice' };
  if (now - t <= RECENT_WINDOW_MS) return { label: 'Started', tone: 'go' };
  return { label: 'Past', tone: 'dim' };
}

export interface RideSections {
  upNext: Group | null;
  rides: Group[];
  earlier: Group[];
}

/**
 * upNext = the soonest scheduled ride that has not long since started.
 * rides  = other current rides (scheduled ones by start time, then unscheduled
 *          newest first). earlier = scheduled rides that started > 12 h ago.
 */
export function sectionRides(groups: Group[], now: number): RideSections {
  const current: Group[] = [];
  const unscheduled: Group[] = [];
  const earlier: Group[] = [];
  for (const g of groups) {
    const t = g.start_time_ms;
    if (!t) unscheduled.push(g);
    else if (now - t > RECENT_WINDOW_MS) earlier.push(g);
    else current.push(g);
  }
  current.sort((a, b) => (a.start_time_ms ?? 0) - (b.start_time_ms ?? 0));
  unscheduled.sort((a, b) => createdMs(b) - createdMs(a));
  earlier.sort((a, b) => (b.start_time_ms ?? 0) - (a.start_time_ms ?? 0));
  const [upNext = null, ...restCurrent] = current;
  return { upNext, rides: [...restCurrent, ...unscheduled], earlier };
}

export function formatKm(km: number): string {
  return km < 10 ? km.toFixed(1) : String(Math.round(km));
}

export function shortPlace(label: string | null | undefined): string | null {
  const s = (label ?? '').split(',')[0].trim();
  return s || null;
}

// ---- date/time labels (manual formatting: no dependence on device Intl/locale) ----
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

/** "SAT, OCT 4" */
export function dayLabel(date: Date): string {
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** "6:00 AM" */
export function timeOfDay(date: Date): string {
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "SUN, OCT 5 · 6:00 AM" for a ride's scheduled start; null when unscheduled. */
export function startLabel(ms: number | null | undefined): string | null {
  if (!ms) return null;
  const d = new Date(ms);
  return `${dayLabel(d)} · ${timeOfDay(d)}`;
}
