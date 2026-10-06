/**
 * Date/time helpers for the Plan flow and the Ride tab header. Formatting is manual (no dependence on the
 * device's Intl/locale), and every function takes `now` so it is testable.
 */
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Roll-out time range, minutes after midnight (the demo's 5:00–10:00 AM, 15-minute steps). */
export const MIN_TIME_MIN = 300;
export const MAX_TIME_MIN = 600;
export const DEFAULT_TIME_MIN = 390;
export const TIME_STEP_MIN = 15;

export function clampTime(min: number): number {
  return Math.max(MIN_TIME_MIN, Math.min(MAX_TIME_MIN, min));
}

/** 390 → { hh: 6, mm: '30', ampm: 'AM' }; 12 o'clock is 12 PM, 0 is 12 AM. */
export function clockParts(min: number): { hh: number; mm: string; ampm: 'AM' | 'PM' } {
  const h = Math.floor(min / 60) % 24;
  return { hh: h % 12 === 0 ? 12 : h % 12, mm: String(min % 60).padStart(2, '0'), ampm: h < 12 ? 'AM' : 'PM' };
}

export function clockLabel(min: number): string {
  const c = clockParts(min);
  return `${c.hh}:${c.mm} ${c.ampm}`;
}

/** "Sat 18 Oct" */
export function shortDate(d: Date): string {
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export interface DayChip {
  offset: number;
  label: string;
}

/** Today, Tomorrow, then the next two dates by name ("Sat 18 Oct"). */
export function dayChips(now: Date): DayChip[] {
  const at = (n: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + n);
  return [
    { offset: 0, label: 'Today' },
    { offset: 1, label: 'Tomorrow' },
    { offset: 2, label: shortDate(at(2)) },
    { offset: 3, label: shortDate(at(3)) },
  ];
}

/** Epoch ms of `dayOffset` days from today's date at `timeMin` minutes past local midnight. */
export function startMsFor(dayOffset: number, timeMin: number, now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, 0, timeMin, 0, 0).getTime();
}

/** "Tomorrow ∙ 6:30 AM" / "Sat 18 Oct ∙ 6:30 AM" for a ride start, relative to `now`. */
export function whenLabel(ms: number, now: Date): string {
  const d = new Date(ms);
  const days = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000,
  );
  const day = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : shortDate(d);
  return `${day} ∙ ${clockLabel(d.getHours() * 60 + d.getMinutes())}`;
}

/** "SAT 11 OCT ∙ 5:41 AM" (the Ride tab eyebrow). */
export function headerLabel(d: Date): string {
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ∙ ${clockLabel(d.getHours() * 60 + d.getMinutes())}`.toUpperCase();
}

/** "Sat 11 Oct ∙ 6:30 AM" always with the date (ride tickets). */
export function ticketWhen(ms: number): string {
  const d = new Date(ms);
  return `${shortDate(d)} ∙ ${clockLabel(d.getHours() * 60 + d.getMinutes())}`;
}

/** "2h ago", "40 min ago", "just now", "3 d ago". */
export function agoLabel(ms: number, now: number): string {
  const mins = Math.floor(Math.max(0, now - ms) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)} d ago`;
}
