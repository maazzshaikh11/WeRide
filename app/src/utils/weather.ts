/**
 * Weather for the Ride tab's card — Open-Meteo (https://open-meteo.com, no API key).
 * Current temperature, WMO weather code → plain-language sky, wind speed and today's sunrise, for a point.
 * Any failure resolves to null and the card is simply not shown. Results are cached for 15 minutes per
 * ~1 km cell so re-opening the tab does not re-request.
 */
export interface Weather {
  tempC: number;
  /** WMO weather interpretation code, when reported. */
  code: number | null;
  /** "Clear sky", "Light rain", … */
  sky: string;
  /** True for fair-weather codes (clear / mainly clear / partly cloudy): the card uses the sun icon. */
  fair: boolean;
  windKmh: number;
  /** Precipitation right now, mm (0 when dry or unreported). */
  precipMm: number;
  /** Local time of today's sunrise as "6:24 AM", null when not reported. */
  sunrise: string | null;
}

export const WEATHER_TTL_MS = 15 * 60_000;
const REQUEST_TIMEOUT_MS = 6000;

// WMO weather interpretation codes (WW) as documented by Open-Meteo.
const SKY: Record<number, string> = {
  0: 'Clear sky', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Freezing fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Light showers', 81: 'Showers', 82: 'Heavy showers', 85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with hail',
};

export function skyFromCode(code: number | null): string {
  if (code == null) return 'Weather';
  return SKY[code] ?? 'Weather';
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** "2026-10-11T06:24" (local, from `timezone=auto`) → "6:24 AM". */
export function formatSunrise(iso: unknown): string | null {
  if (typeof iso !== 'string') return null;
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return null;
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

/**
 * Parses an Open-Meteo /v1/forecast response (`current=` + `daily=sunrise`). Also accepts the older
 * `current_weather` block. Returns null when there is no usable temperature.
 */
export function parseWeather(json: any): Weather | null {
  if (!json || typeof json !== 'object') return null;
  const cur = json.current ?? null;
  const legacy = json.current_weather ?? null;
  const tempC = num(cur?.temperature_2m) ?? num(legacy?.temperature);
  if (tempC == null) return null;
  const code = num(cur?.weather_code) ?? num(legacy?.weathercode);
  const windKmh = num(cur?.wind_speed_10m) ?? num(legacy?.windspeed) ?? 0;
  const precipMm = num(cur?.precipitation) ?? 0;
  return {
    tempC,
    code,
    sky: skyFromCode(code),
    fair: code != null && code <= 2,
    windKmh,
    precipMm,
    sunrise: formatSunrise(Array.isArray(json.daily?.sunrise) ? json.daily.sunrise[0] : null),
  };
}

export function weatherUrl(lat: number, lng: number): string {
  return (
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    '&current=temperature_2m,weather_code,wind_speed_10m,precipitation' +
    '&daily=sunrise&timezone=auto&forecast_days=1&wind_speed_unit=kmh'
  );
}

const cache = new Map<string, { at: number; value: Weather }>();
const cellKey = (lat: number, lng: number) => `${lat.toFixed(2)},${lng.toFixed(2)}`;

/** Test hook. */
export function clearWeatherCache(): void {
  cache.clear();
}

/** Current weather at a point, or null on any failure (offline, HTTP error, unexpected body, timeout). */
export async function fetchWeather(lat: number, lng: number, now: number = Date.now()): Promise<Weather | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const key = cellKey(lat, lng);
  const hit = cache.get(key);
  if (hit && now - hit.at < WEATHER_TTL_MS) return hit.value;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
  try {
    const res = await fetch(weatherUrl(lat, lng), controller ? { signal: controller.signal } : undefined);
    if (!res.ok) return null;
    const w = parseWeather(await res.json());
    if (w) cache.set(key, { at: now, value: w });
    return w;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
