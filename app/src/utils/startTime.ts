/**
 * Ride start-time helpers (pure; `now` is injected so they are testable).
 * All wall-clock maths uses local-time Date constructors, so DST changes are
 * handled by the platform rather than by adding 24h of milliseconds.
 */

export const START_PRESETS = ['Now', 'In 30 min', 'In 1 hour', 'In 2 hours', 'Tomorrow 6:00'] as const;
export type StartPreset = (typeof START_PRESETS)[number];

const MIN = 60_000;

/** Epoch ms for a preset, relative to `now` (epoch ms). */
export function startTimeFromPreset(preset: StartPreset, now: number): number {
  switch (preset) {
    case 'Now':
      return now;
    case 'In 30 min':
      return now + 30 * MIN;
    case 'In 1 hour':
      return now + 60 * MIN;
    case 'In 2 hours':
      return now + 120 * MIN;
    case 'Tomorrow 6:00': {
      const d = new Date(now);
      // Local-time construction: month/day overflow and DST are handled by Date.
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 6, 0, 0, 0).getTime();
    }
  }
}

function clock(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function dayStart(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dayDiff(ms: number, now: number): number {
  const a = new Date(dayStart(ms));
  const b = new Date(dayStart(now));
  // Compare calendar days via UTC of the local Y/M/D so DST days (23/25h) count as one day.
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ua - ub) / 86_400_000);
}

function duration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/**
 * One-line description of a planned start, or null when there is none.
 *  - within 1 min of now: "Starting now"
 *  - future, under 1 h: "Starts in 25 min"
 *  - future, later today: "Starts today 18:30"
 *  - tomorrow: "Tomorrow 06:00"; further: "Sat 7 Oct 06:00"
 *  - past, under 24 h: "Started 10 min ago" / "Started 3 h ago"
 *  - older: "Started yesterday 18:30" / "Started 3 Oct 18:30"
 */
export function describeStart(ms: number | null | undefined, now: number): string | null {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return null;
  const diffMin = Math.round((ms - now) / MIN);
  const d = new Date(ms);

  if (diffMin === 0) return 'Starting now';

  if (diffMin < 0) {
    const ago = -diffMin;
    if (ago < 24 * 60) return `Started ${duration(ago)} ago`;
    const days = dayDiff(ms, now);
    if (days === -1) return `Started yesterday ${clock(d)}`;
    return `Started ${shortDate(d)} ${clock(d)}`;
  }

  if (diffMin < 60) return `Starts in ${diffMin} min`;
  const days = dayDiff(ms, now);
  if (days === 0) return `Starts today ${clock(d)}`;
  if (days === 1) return `Tomorrow ${clock(d)}`;
  return `${shortDate(d)} ${clock(d)}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortDate(d: Date): string {
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
