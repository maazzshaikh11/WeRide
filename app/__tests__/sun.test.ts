/**
 * NOAA sunrise/sunset + "is it night": checked against published almanac times (to a few minutes),
 * polar day/night, the local-clock fallback and the horizon crossing itself.
 */
import { isNight, isNightByClock, sunElevation, sunTimes } from '../src/utils/sun';

const MUMBAI = { lat: 19.076, lng: 72.8777 };
const LONDON = { lat: 51.5074, lng: -0.1278 };
const TROMSO = { lat: 69.65, lng: 18.96 };
const SYDNEY = { lat: -33.8688, lng: 151.2093 };
const minutesApart = (a: Date | null, iso: string) => Math.abs((a!.getTime() - Date.parse(iso)) / 60000);

describe('sunTimes', () => {
  it('Mumbai on the March equinox: sunrise ~06:42 IST, sunset ~18:49 IST', () => {
    const t = sunTimes(Date.UTC(2026, 2, 21, 6), MUMBAI.lat, MUMBAI.lng);
    expect(t.polar).toBeNull();
    expect(minutesApart(t.sunrise, '2026-03-21T01:12:00Z')).toBeLessThan(3);
    expect(minutesApart(t.sunset, '2026-03-21T13:19:00Z')).toBeLessThan(3);
  });

  it('London at the June solstice: sunrise 04:43 BST, sunset 21:21 BST', () => {
    const t = sunTimes(Date.UTC(2026, 5, 21, 12), LONDON.lat, LONDON.lng);
    expect(minutesApart(t.sunrise, '2026-06-21T03:43:00Z')).toBeLessThan(3);
    expect(minutesApart(t.sunset, '2026-06-21T20:21:00Z')).toBeLessThan(3);
  });

  it('southern hemisphere, east of the date line offset: Sydney at the December solstice', () => {
    const t = sunTimes(Date.UTC(2026, 11, 21, 2), SYDNEY.lat, SYDNEY.lng);
    expect(minutesApart(t.sunrise, '2026-12-20T18:41:00Z')).toBeLessThan(3); // 05:41 AEDT
    expect(minutesApart(t.sunset, '2026-12-21T09:05:00Z')).toBeLessThan(3); // 20:05 AEDT
  });

  it('reports polar day and polar night instead of inventing times', () => {
    expect(sunTimes(Date.UTC(2026, 5, 21, 12), TROMSO.lat, TROMSO.lng)).toEqual({ sunrise: null, sunset: null, polar: 'day' });
    expect(sunTimes(Date.UTC(2026, 11, 21, 12), TROMSO.lat, TROMSO.lng)).toEqual({ sunrise: null, sunset: null, polar: 'night' });
  });

  it('sunrise comes before sunset on the same solar day', () => {
    const t = sunTimes(Date.UTC(2026, 9, 6, 5), MUMBAI.lat, MUMBAI.lng);
    expect(t.sunrise!.getTime()).toBeLessThan(t.sunset!.getTime());
    expect((t.sunset!.getTime() - t.sunrise!.getTime()) / 3600000).toBeGreaterThan(11);
    expect((t.sunset!.getTime() - t.sunrise!.getTime()) / 3600000).toBeLessThan(13);
  });
});

describe('isNight with a position', () => {
  it('flips at the real sunrise and sunset', () => {
    const t = sunTimes(Date.UTC(2026, 2, 21, 6), MUMBAI.lat, MUMBAI.lng);
    const rise = t.sunrise!.getTime();
    const set = t.sunset!.getTime();
    expect(isNight(rise - 5 * 60000, MUMBAI)).toBe(true);
    expect(isNight(rise + 5 * 60000, MUMBAI)).toBe(false);
    expect(isNight(set - 5 * 60000, MUMBAI)).toBe(false);
    expect(isNight(set + 5 * 60000, MUMBAI)).toBe(true);
  });

  it('uses the sun where the rider is, not the phone clock zone', () => {
    const instant = Date.UTC(2026, 2, 21, 2, 0); // 07:30 in Mumbai (day), 02:00 in London (night)
    expect(isNight(instant, MUMBAI)).toBe(false);
    expect(isNight(instant, LONDON)).toBe(true);
  });

  it('midnight sun is never night, polar night is always night', () => {
    expect(isNight(Date.UTC(2026, 5, 21, 23, 30), TROMSO)).toBe(false);
    expect(isNight(Date.UTC(2026, 11, 21, 12), TROMSO)).toBe(true);
  });

  it('sun elevation is near 90 - lat at local noon on the equinox', () => {
    const noon = (sunTimes(Date.UTC(2026, 2, 21, 6), MUMBAI.lat, MUMBAI.lng).sunrise!.getTime() + sunTimes(Date.UTC(2026, 2, 21, 6), MUMBAI.lat, MUMBAI.lng).sunset!.getTime()) / 2;
    expect(sunElevation(noon, MUMBAI.lat, MUMBAI.lng)).toBeGreaterThan(90 - 19.076 - 3);
    expect(sunElevation(noon, MUMBAI.lat, MUMBAI.lng)).toBeLessThan(90 - 19.076 + 3);
  });
});

describe('isNight without a position', () => {
  const at = (h: number, m: number) => new Date(2026, 9, 6, h, m, 0);
  it('is day from 06:00 to 18:29 local, night otherwise', () => {
    expect(isNightByClock(at(5, 59))).toBe(true);
    expect(isNightByClock(at(6, 0))).toBe(false);
    expect(isNightByClock(at(12, 0))).toBe(false);
    expect(isNightByClock(at(18, 29))).toBe(false);
    expect(isNightByClock(at(18, 30))).toBe(true);
    expect(isNightByClock(at(23, 0))).toBe(true);
    expect(isNight(at(12, 0), null)).toBe(false);
    expect(isNight(at(2, 0), undefined)).toBe(true);
  });
  it('treats a junk fix as no fix', () => {
    expect(isNight(new Date(2026, 9, 6, 12, 0), { lat: NaN, lng: 0 })).toBe(false);
  });
});
