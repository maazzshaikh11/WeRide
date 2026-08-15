import { haversineMeters } from '../src/utils/geoUtils';

describe('haversineMeters', () => {
  test('~111km between points 1 degree apart at equator', () => {
    const d = haversineMeters(0, 0, 0, 1);
    expect(Math.round(d / 1000)).toBeCloseTo(111, 1);
  });

  test('zero distance for same point', () => {
    expect(haversineMeters(12.34, 56.78, 12.34, 56.78)).toBe(0);
  });
});