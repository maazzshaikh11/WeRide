/**
 * Sunrise / sunset and "is it dark here right now", from the NOAA solar-position equations
 * (https://gml.noaa.gov/grad/solcalc/calcdetails.html). Pure functions, no network, accurate to about a minute
 * at the latitudes riders use (polar day/night is reported, not guessed).
 *
 * Used by the Road theme "Sunset auto" setting: night at the rider's last known position -> the dark Road palette.
 */

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
/** Apparent sunrise/sunset: the sun's upper limb on the horizon, with standard refraction. */
const HORIZON_DEG = -0.833;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface SunTimes {
  /** null when the sun does not rise/set that day (see `polar`). */
  sunrise: Date | null;
  sunset: Date | null;
  /** 'day' = midnight sun, 'night' = polar night, null = normal day. */
  polar: 'day' | 'night' | null;
}

interface SolarParams {
  /** Solar declination, radians. */
  decl: number;
  /** Equation of time, minutes. */
  eqTime: number;
}

function solarParams(ms: number): SolarParams {
  const jd = ms / DAY_MS + 2440587.5;
  const T = (jd - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const Mr = M * RAD;
  const C =
    Math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * Mr) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * Mr) * 0.000289;
  const trueLong = L0 + C;
  const omega = (125.04 - 1934.136 * T) * RAD;
  const lambda = (trueLong - 0.00569 - 0.00478 * Math.sin(omega)) * RAD;
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = (eps0 + 0.00256 * Math.cos(omega)) * RAD;
  const decl = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const y = Math.tan(eps / 2) ** 2;
  const L0r = L0 * RAD;
  const eqTime =
    (4 / RAD) *
    (y * Math.sin(2 * L0r) -
      2 * e * Math.sin(Mr) +
      4 * e * y * Math.sin(Mr) * Math.cos(2 * L0r) -
      0.5 * y * y * Math.sin(4 * L0r) -
      1.25 * e * e * Math.sin(2 * Mr));
  return { decl, eqTime };
}

/** Sun elevation above the horizon in degrees at an instant and place (geometric, no refraction). */
export function sunElevation(at: Date | number, lat: number, lng: number): number {
  const ms = typeof at === 'number' ? at : at.getTime();
  const { decl, eqTime } = solarParams(ms);
  const minutesUtc = (((ms % DAY_MS) + DAY_MS) % DAY_MS) / 60000;
  const trueSolarTime = (((minutesUtc + eqTime + 4 * lng) % 1440) + 1440) % 1440;
  const hourAngle = (trueSolarTime / 4 - 180) * RAD;
  const latR = lat * RAD;
  const cosZenith = Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(hourAngle);
  return 90 - Math.acos(Math.max(-1, Math.min(1, cosZenith))) / RAD;
}

/** Hour angle of sunrise in degrees for a given declination, or null for polar day/night (with which). */
function hourAngleSunrise(lat: number, decl: number): { ha: number } | { polar: 'day' | 'night' } {
  const latR = lat * RAD;
  const cosHa = (Math.cos((90 - HORIZON_DEG) * RAD) - Math.sin(latR) * Math.sin(decl)) / (Math.cos(latR) * Math.cos(decl));
  if (cosHa < -1) return { polar: 'day' };
  if (cosHa > 1) return { polar: 'night' };
  return { ha: Math.acos(cosHa) / RAD };
}

/**
 * Sunrise and sunset of the local solar day containing `date`, at `lat`/`lng` (degrees, east positive).
 * Returned as absolute instants (format them in any zone).
 */
export function sunTimes(date: Date | number, lat: number, lng: number): SunTimes {
  const ms = typeof date === 'number' ? date : date.getTime();
  const offset = (lng / 15) * 3_600_000;
  // Local solar midnight of the day containing `ms`, then its solar noon.
  const noonEstimate = Math.floor((ms + offset) / DAY_MS) * DAY_MS - offset + DAY_MS / 2;
  const dayStartUtc = Math.floor(noonEstimate / DAY_MS) * DAY_MS;

  const at = (t: number, sign: 1 | -1): { ms: number } | { polar: 'day' | 'night' } => {
    const { decl, eqTime } = solarParams(t);
    const h = hourAngleSunrise(lat, decl);
    if ('polar' in h) return h;
    const noonMin = 720 - 4 * lng - eqTime;
    return { ms: dayStartUtc + (noonMin + sign * 4 * h.ha) * 60000 };
  };

  const first = at(noonEstimate, -1);
  if ('polar' in first) return { sunrise: null, sunset: null, polar: first.polar };
  // One refinement pass: evaluate the declination / equation of time at the event itself.
  const rise = at(first.ms, -1);
  const setFirst = at(noonEstimate, 1);
  const set = 'ms' in setFirst ? at(setFirst.ms, 1) : setFirst;
  if ('polar' in rise || 'polar' in set) return { sunrise: null, sunset: null, polar: 'polar' in rise ? rise.polar : (set as { polar: 'day' | 'night' }).polar };
  return { sunrise: new Date(rise.ms), sunset: new Date(set.ms), polar: null };
}

/** Local-clock fallback when there is no position fix: dark before 06:00 and from 18:30. */
export function isNightByClock(now: Date): boolean {
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes < 6 * 60 || minutes >= 18 * 60 + 30;
}

/**
 * Is it dark right now? With a position: the sun is below the horizon there (sunset to sunrise, polar day/night
 * included). Without one: the 06:00-18:30 local-clock fallback.
 */
export function isNight(now: Date | number, fix?: LatLng | null): boolean {
  const d = typeof now === 'number' ? new Date(now) : now;
  if (!fix || !Number.isFinite(fix.lat) || !Number.isFinite(fix.lng)) return isNightByClock(d);
  return sunElevation(d, fix.lat, fix.lng) < HORIZON_DEG;
}
