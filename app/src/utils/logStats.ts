/**
 * Pure maths + formatting for the ride log: season totals, the last-8-weeks bar chart, the "Season ∙ Sep – Oct" label,
 * track decimation and the "did we ever see another rider" rule. Everything takes its clock as an argument.
 */
import type { RideEventKind, RideLog } from '../models/domain';

export const WEEK_MS = 7 * 24 * 3600 * 1000;
export const WEEKS_SHOWN = 8;

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface LogTotals {
  km: number;
  rides: number;
  hours: number;
}

export function logTotals(logs: Pick<RideLog, 'km' | 'duration_s'>[]): LogTotals {
  let km = 0;
  let seconds = 0;
  for (const l of logs) {
    km += Number.isFinite(l.km) ? Math.max(0, l.km) : 0;
    seconds += Number.isFinite(l.duration_s) ? Math.max(0, l.duration_s) : 0;
  }
  return { km, rides: logs.length, hours: seconds / 3600 };
}

/**
 * Kilometres per week for the last 8 rolling 7-day windows that end at `now`, oldest first (W1..W8, W8 = the
 * last 7 days). A ride that started exactly 7 days before `now` belongs to the earlier window; rides older than
 * 8 weeks are not shown; a ride dated in the future (clock skew) counts in W8.
 */
export function weeklyKm(logs: Pick<RideLog, 'km' | 'started_ms'>[], now: number): { values: number[]; labels: string[] } {
  const values = new Array<number>(WEEKS_SHOWN).fill(0);
  for (const l of logs) {
    if (!Number.isFinite(l.km) || !Number.isFinite(l.started_ms)) continue;
    const ago = Math.max(0, Math.floor((now - l.started_ms) / WEEK_MS));
    if (ago >= WEEKS_SHOWN) continue;
    values[WEEKS_SHOWN - 1 - ago] += Math.max(0, l.km);
  }
  return { values, labels: values.map((_, i) => `W${i + 1}`) };
}

/** 'SEASON ∙ SEP – OCT' (one month: 'SEASON ∙ OCT'); 'YOUR LOG' when there are no rides. */
export function seasonLabel(logs: Pick<RideLog, 'started_ms'>[]): string {
  const ts = logs.map((l) => l.started_ms).filter((t) => Number.isFinite(t) && t > 0);
  if (ts.length === 0) return 'YOUR LOG';
  const a = MONTHS[new Date(Math.min(...ts)).getMonth()];
  const b = MONTHS[new Date(Math.max(...ts)).getMonth()];
  return a === b ? `SEASON ∙ ${a}` : `SEASON ∙ ${a} – ${b}`;
}

/** 'Sat 4 Oct' (device local time). */
export function formatRideDate(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const d = new Date(ms);
  const m = MONTHS[d.getMonth()];
  return `${DAYS[d.getDay()]} ${d.getDate()} ${m[0]}${m.slice(1).toLowerCase()}`;
}

/** '06:34' (device local time). */
export function formatClock(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Replay readout: 'm:ss', or 'h:mm:ss' from one hour. */
export function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Hours on the road: one decimal under 10 h ('3.4'), whole above. */
export function formatHours(hours: number): string {
  if (!Number.isFinite(hours) || hours < 0) return '0';
  return hours < 10 ? String(Math.round(hours * 10) / 10) : String(Math.round(hours));
}

/**
 * Keeps at most `max` points of a flat [lat,lng,…] track, evenly spaced by index, always keeping the first and
 * the last point. Shorter tracks are returned unchanged (as a copy).
 */
export function decimateFlat(flat: number[], maxPoints: number): number[] {
  const n = Math.floor(flat.length / 2);
  const max = Math.max(2, Math.floor(maxPoints));
  if (n <= max) return flat.slice(0, n * 2);
  const out: number[] = [];
  for (let i = 0; i < max; i++) {
    const k = Math.round((i * (n - 1)) / (max - 1));
    out.push(flat[k * 2], flat[k * 2 + 1]);
  }
  return out;
}

/**
 * Whether another rider was ever seen during the ride. The recorder stores 0 / 0 when it never saw one (a ride
 * where riders were seen always has a non-zero share together or a non-zero gap), so the UI shows '—' not '0%'.
 */
export function hasTogetherData(log: Pick<RideLog, 'together_pct' | 'longest_gap_m'>): boolean {
  return log.together_pct > 0 || log.longest_gap_m > 0;
}

export type TimelineTone = 'pri' | 'ok' | 'bad' | 'ink';
export function eventTone(kind: RideEventKind): TimelineTone {
  switch (kind) {
    case 'rolled':
    case 'arrived':
      return 'ok';
    case 'sos':
      return 'bad';
    case 'stop':
      return 'ink';
    default:
      return 'pri'; // hazard, gap
  }
}
