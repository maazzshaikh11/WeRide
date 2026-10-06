import { clearWeatherCache, fetchWeather, formatSunrise, parseWeather, skyFromCode, weatherUrl, WEATHER_TTL_MS } from '../src/utils/weather';
import { weatherLines } from '../src/screens/garage/parts/WeatherCard';

// Shape of a real https://api.open-meteo.com/v1/forecast?current=...&daily=sunrise&timezone=auto response.
const FIXTURE = {
  latitude: 19.0, longitude: 72.8, timezone: 'Asia/Kolkata',
  current_units: { temperature_2m: '°C', wind_speed_10m: 'km/h' },
  current: { time: '2025-10-11T05:45', interval: 900, temperature_2m: 21.4, weather_code: 1, wind_speed_10m: 9.2, precipitation: 0 },
  daily_units: { sunrise: 'iso8601' },
  daily: { time: ['2025-10-11'], sunrise: ['2025-10-11T06:24'] },
};

describe('parseWeather', () => {
  it('reads temperature, sky, wind and sunrise from an Open-Meteo response', () => {
    expect(parseWeather(FIXTURE)).toEqual({ tempC: 21.4, code: 1, sky: 'Mostly clear', fair: true, windKmh: 9.2, precipMm: 0, sunrise: '6:24 AM' });
  });
  it('accepts the older current_weather block', () => {
    expect(parseWeather({ current_weather: { temperature: 30, weathercode: 63, windspeed: 12 } })).toMatchObject({ tempC: 30, sky: 'Rain', fair: false, windKmh: 12, sunrise: null });
  });
  it('is null when there is no usable temperature', () => {
    expect(parseWeather(null)).toBeNull();
    expect(parseWeather({})).toBeNull();
    expect(parseWeather({ current: { temperature_2m: 'warm' } })).toBeNull();
    expect(parseWeather({ error: true, reason: 'bad latitude' })).toBeNull();
  });
  it('tolerates a missing weather code and sunrise', () => {
    expect(parseWeather({ current: { temperature_2m: 18 } })).toMatchObject({ tempC: 18, code: null, sky: 'Weather', windKmh: 0, precipMm: 0, sunrise: null });
  });
});

describe('sky + sunrise formatting', () => {
  it.each([[0, 'Clear sky'], [3, 'Overcast'], [45, 'Fog'], [65, 'Heavy rain'], [95, 'Thunderstorm'], [1234, 'Weather']])('code %i', (c, s) => expect(skyFromCode(c)).toBe(s));
  it.each([['2025-10-11T06:24', '6:24 AM'], ['2025-10-11T18:05', '6:05 PM'], ['2025-10-11T00:10', '12:10 AM'], ['2025-10-11T12:00', '12:00 PM']])('%s', (iso, out) => expect(formatSunrise(iso)).toBe(out));
  it('null for garbage', () => {
    expect(formatSunrise(undefined)).toBeNull();
    expect(formatSunrise('soon')).toBeNull();
  });
  it('card lines honour the rider\'s units', () => {
    const w = parseWeather(FIXTURE)!;
    expect(weatherLines(w, 'km')).toEqual({ title: '21° · Mostly clear', sub: 'wind 9 km/h · sunrise 6:24 AM' });
    expect(weatherLines(w, 'mi').sub).toBe('wind 6 mph · sunrise 6:24 AM');
    expect(weatherLines({ ...w, precipMm: 1.25 }, 'km').sub).toBe('rain 1.3 mm · wind 9 km/h · sunrise 6:24 AM');
  });
});

describe('fetchWeather', () => {
  const mockFetch = jest.fn();
  beforeEach(() => {
    clearWeatherCache();
    mockFetch.mockReset();
    (globalThis as any).fetch = mockFetch;
  });
  const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

  it('requests the Open-Meteo forecast for the point and returns the parsed weather', async () => {
    mockFetch.mockResolvedValue(ok(FIXTURE));
    const w = await fetchWeather(19.0, 72.8, 1000);
    expect(w?.tempC).toBe(21.4);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe(weatherUrl(19.0, 72.8));
    expect(url).toContain('api.open-meteo.com/v1/forecast');
    expect(url).toContain('current=temperature_2m,weather_code,wind_speed_10m,precipitation');
    expect(url).toContain('daily=sunrise');
  });

  it('caches for 15 minutes per ~1 km cell, then refetches', async () => {
    mockFetch.mockResolvedValue(ok(FIXTURE));
    await fetchWeather(19.001, 72.801, 0);
    await fetchWeather(19.004, 72.804, WEATHER_TTL_MS - 1); // same cell
    expect(mockFetch).toHaveBeenCalledTimes(1);
    await fetchWeather(19.001, 72.801, WEATHER_TTL_MS + 1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    await fetchWeather(25, 80, WEATHER_TTL_MS + 2); // elsewhere
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('resolves null (card hidden) on network errors, HTTP errors and junk bodies — and does not cache them', async () => {
    mockFetch.mockRejectedValueOnce(new Error('offline'));
    await expect(fetchWeather(10, 10, 0)).resolves.toBeNull();
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) });
    await expect(fetchWeather(10, 10, 0)).resolves.toBeNull();
    mockFetch.mockResolvedValueOnce(ok({ nope: 1 }));
    await expect(fetchWeather(10, 10, 0)).resolves.toBeNull();
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } });
    await expect(fetchWeather(10, 10, 0)).resolves.toBeNull();
    mockFetch.mockResolvedValueOnce(ok(FIXTURE));
    await expect(fetchWeather(10, 10, 0)).resolves.not.toBeNull();
  });

  it('does not call out for a non-finite position', async () => {
    await expect(fetchWeather(NaN, 1)).resolves.toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
