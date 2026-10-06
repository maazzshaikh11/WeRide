/** Distance / speed formatting for the rider's units preference (km or mi). */
import type { Units } from '../models/domain';

const KM_PER_MI = 1.609344;

export function toUnitDistance(km: number, units: Units): number {
  return units === 'mi' ? km / KM_PER_MI : km;
}
export function toUnitSpeed(kmh: number, units: Units): number {
  return toUnitDistance(kmh, units);
}
export const distanceUnit = (units: Units): string => (units === 'mi' ? 'mi' : 'km');
export const speedUnit = (units: Units): string => (units === 'mi' ? 'MPH' : 'KM/H');

/** "84 km", "5.2 mi" — one decimal under 10, whole numbers above. */
export function formatDistance(km: number, units: Units = 'km', withUnit = true): string {
  if (!Number.isFinite(km)) return '--';
  const v = toUnitDistance(km, units);
  const s = v < 10 ? v.toFixed(1) : String(Math.round(v));
  return withUnit ? `${s} ${distanceUnit(units)}` : s;
}

/** Metres below one unit ("450 m"), otherwise km/mi. Used for gaps. */
export function formatShortDistance(m: number, units: Units = 'km'): string {
  if (!Number.isFinite(m)) return '--';
  if (units === 'mi') {
    const mi = m / 1609.344;
    return mi < 0.1 ? `${Math.round(m * 3.28084 / 10) * 10} ft` : `${mi.toFixed(1)} mi`;
  }
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
}

export function formatSpeed(kmh: number, units: Units = 'km'): string {
  if (!Number.isFinite(kmh)) return '--';
  return String(Math.round(toUnitSpeed(kmh, units)));
}

/** "2h 05" / "58 min" — the demo's duration style. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}` : `${m} min`;
}
