import {
  ageLabel, bearingDeg, formatClock, formatCoords, formatFixLine, isRealPosition, nearestResponder, relativeDirection,
  smsLink, sosCreatedMs, sosSmsBody,
} from '../src/services/sosFormat';

describe('coordinates and clock', () => {
  it('formats like the demo', () => {
    expect(formatCoords(18.97184, 73.39024)).toBe('18.9718° N 73.3902° E');
    expect(formatCoords(-33.8688, -70.1)).toBe('33.8688° S 70.1000° W');
    expect(formatFixLine({ lat: 18.9718, lng: 73.3902, accuracy_m: 4.2 })).toBe('18.9718° N 73.3902° E · ±4 m');
    expect(formatFixLine({ lat: 18.9718, lng: 73.3902 })).toBe('18.9718° N 73.3902° E');
  });
  it('no fix is stated honestly', () => expect(formatFixLine(null)).toBe('No GPS fix yet'));
  it('clock is 12-hour without am/pm', () => {
    expect(formatClock(new Date(2025, 9, 11, 18, 43, 12).getTime())).toBe('6:43:12');
    expect(formatClock(new Date(2025, 9, 11, 0, 5, 9).getTime())).toBe('12:05:09');
  });
});

describe('SMS link', () => {
  it('body names the rider, links the live location and says where it came from', () => {
    expect(sosSmsBody('Arjun', { lat: 18.9718, lng: 73.3902 })).toBe('Arjun needs help. Live location: https://maps.google.com/?q=18.9718,73.3902 — sent by WeRide SOS.');
  });
  it('is first person without a name and has no link without a fix', () => {
    expect(sosSmsBody(null, null)).toBe('I need help. — sent by WeRide SOS.');
  });
  it('sms:<number>?body=<encoded>', () => {
    const url = smsLink('+919800000000', 'Arjun', { lat: 1.5, lng: 2.5 });
    expect(url.startsWith('sms:+919800000000?body=')).toBe(true);
    expect(decodeURIComponent(url.split('?body=')[1])).toBe(sosSmsBody('Arjun', { lat: 1.5, lng: 2.5 }));
    expect(url).not.toContain(' ');
  });
});

describe('direction / positions / time', () => {
  it('bearing: due east is 90', () => expect(Math.round(bearingDeg({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }))).toBe(90));
  it('behind / ahead need me to be moving with a heading', () => {
    const me = { lat: 18.9, lng: 73.0, heading_deg: 90, speed_mps: 12 };
    expect(relativeDirection(me, { lat: 18.9, lng: 73.01 })).toBe('ahead');
    expect(relativeDirection(me, { lat: 18.9, lng: 72.99 })).toBe('behind');
    expect(relativeDirection({ ...me, speed_mps: 0.3 }, { lat: 18.9, lng: 72.99 })).toBeNull();
    expect(relativeDirection({ lat: 1, lng: 1 }, { lat: 2, lng: 2 })).toBeNull();
  });
  it('(0,0) and out-of-range are not real positions', () => {
    expect(isRealPosition(0, 0)).toBe(false);
    expect(isRealPosition(NaN, 3)).toBe(false);
    expect(isRealPosition(91, 3)).toBe(false);
    expect(isRealPosition(18.9, 73.3)).toBe(true);
  });
  it('reads wall-clock ms from an HLC string', () => {
    expect(sosCreatedMs('1760000000000:3')).toBe(1760000000000);
    expect(sosCreatedMs('1760000000000-3')).toBe(1760000000000);
    expect(sosCreatedMs('garbage')).toBeNull();
    expect(sosCreatedMs(undefined)).toBeNull();
  });
  it('age label', () => {
    expect(ageLabel(8000)).toBe('8 S AGO');
    expect(ageLabel(125_000)).toBe('2 MIN AGO');
  });
});

describe('nearestResponder', () => {
  const target = { lat: 18.9, lng: 73.0 };
  const loc: Record<string, { lat: number; lng: number; speed_mps?: number }> = {
    a: { lat: 18.9, lng: 73.01, speed_mps: 10 },
    b: { lat: 18.9, lng: 73.001, speed_mps: 0 },
  };
  it('null while nobody responded', () => expect(nearestResponder([], target, () => undefined)).toBeNull());
  it('picks the nearest by last known fix, counts the others, ETA only when moving', () => {
    const r = nearestResponder(
      [{ uid: 'a', state: 'going', updated_ms: 1 }, { uid: 'b', state: 'going', updated_ms: 2 }],
      target,
      (u) => loc[u],
    );
    expect(r?.uid).toBe('b');
    expect(r?.others).toBe(1);
    expect(r?.distanceM).toBeGreaterThan(90);
    expect(r?.distanceM).toBeLessThan(120);
    expect(r?.etaMin).toBeNull(); // b is not moving
    const only = nearestResponder([{ uid: 'a', state: 'going', updated_ms: 1 }], target, (u) => loc[u]);
    expect(only?.etaMin).toBeGreaterThanOrEqual(1);
  });
  it('without any fix, the earliest responder with unknown distance', () => {
    const r = nearestResponder([{ uid: 'x', state: 'going', updated_ms: 9 }, { uid: 'y', state: 'arrived', updated_ms: 3 }], target, () => undefined);
    expect(r).toMatchObject({ uid: 'y', state: 'arrived', distanceM: null, etaMin: null, others: 1 });
  });
});
