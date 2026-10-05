import {
  planFit,
  isUsableCoord,
  fitPadding,
  MIN_FIT_SPAN_M,
  POINT_FIT_ZOOM,
} from '../src/utils/mapFit';

// Pune → Lonavala, roughly 65 km
const PUNE = { lat: 18.5204, lng: 73.8567 };
const LONAVALA = { lat: 18.7546, lng: 73.4062 };

describe('isUsableCoord', () => {
  it('accepts real coordinates', () => {
    expect(isUsableCoord(18.52, 73.85)).toBe(true);
    expect(isUsableCoord(-33.86, 151.2)).toBe(true);
  });

  it('rejects NaN / Infinity / out of range', () => {
    expect(isUsableCoord(NaN, 10)).toBe(false);
    expect(isUsableCoord(10, Infinity)).toBe(false);
    expect(isUsableCoord(91, 10)).toBe(false);
    expect(isUsableCoord(10, -181)).toBe(false);
  });

  it('rejects (0,0) null island — an uninitialised fix, never a real ride', () => {
    expect(isUsableCoord(0, 0)).toBe(false);
  });

  it('keeps a point that is only on one zero axis', () => {
    expect(isUsableCoord(0, 36.8)).toBe(true); // equator
    expect(isUsableCoord(51.4, 0)).toBe(true); // prime meridian
  });
});

describe('planFit', () => {
  it('returns null with no usable points', () => {
    expect(planFit([])).toBeNull();
    expect(planFit([{ lat: 0, lng: 0 }, { lat: NaN, lng: 1 }])).toBeNull();
  });

  it('fits a normal route as a lng/lat bounding box (ne/sw in [lng,lat])', () => {
    const plan = planFit([PUNE, LONAVALA]);
    expect(plan).toEqual({
      kind: 'bounds',
      ne: [PUNE.lng, LONAVALA.lat],
      sw: [LONAVALA.lng, PUNE.lat],
    });
  });

  it('is order-independent and includes every intermediate point', () => {
    const detour = { lat: 18.9, lng: 73.2 };
    const plan = planFit([LONAVALA, detour, PUNE]);
    expect(plan).toMatchObject({ kind: 'bounds', ne: [PUNE.lng, 18.9], sw: [73.2, PUNE.lat] });
  });

  it('SAME start and end → centred point plan, not a zero-area box', () => {
    const plan = planFit([PUNE, { ...PUNE }]);
    expect(plan).toEqual({ kind: 'point', center: [PUNE.lng, PUNE.lat], zoom: POINT_FIT_ZOOM });
  });

  it('a single point → centred point plan', () => {
    expect(planFit([PUNE])).toEqual({
      kind: 'point',
      center: [PUNE.lng, PUNE.lat],
      zoom: POINT_FIT_ZOOM,
    });
  });

  it('VERY SHORT route (< MIN_FIT_SPAN_M) → point plan at the midpoint', () => {
    // ~60 m north
    const a = { lat: 18.5204, lng: 73.8567 };
    const b = { lat: 18.5204 + 60 / 111_320, lng: 73.8567 };
    const plan = planFit([a, b]);
    expect(plan?.kind).toBe('point');
    if (plan?.kind === 'point') {
      expect(plan.center[1]).toBeCloseTo((a.lat + b.lat) / 2, 8);
    }
  });

  it('just over MIN_FIT_SPAN_M → bounds', () => {
    const a = { lat: 18.5204, lng: 73.8567 };
    const b = { lat: 18.5204 + (MIN_FIT_SPAN_M + 20) / 111_320, lng: 73.8567 };
    expect(planFit([a, b])?.kind).toBe('bounds');
  });

  it('VERY LONG route (cross-country) → plain bounds, no clamping', () => {
    const delhi = { lat: 28.6139, lng: 77.209 };
    const chennai = { lat: 13.0827, lng: 80.2707 };
    expect(planFit([delhi, chennai])).toEqual({
      kind: 'bounds',
      ne: [80.2707, 28.6139],
      sw: [77.209, 13.0827],
    });
  });

  it('a stray (0,0) point is dropped instead of zooming the map to the world', () => {
    const withStray = planFit([PUNE, LONAVALA, { lat: 0, lng: 0 }]);
    const without = planFit([PUNE, LONAVALA]);
    expect(withStray).toEqual(without);
  });

  it('width shrinks with latitude (a 0.001° lng span is narrower near the pole)', () => {
    // 0.0012° lng ≈ 133 m at the equator (point) but only ≈ 46 m at 70°N (point);
    // at 0.0016° it is ≈ 178 m at the equator (bounds) vs ≈ 61 m at 70°N (point).
    const eq = planFit([{ lat: 1, lng: 10 }, { lat: 1, lng: 10.0016 }]);
    const arctic = planFit([{ lat: 70, lng: 10 }, { lat: 70, lng: 10.0016 }]);
    expect(eq?.kind).toBe('bounds');
    expect(arctic?.kind).toBe('point');
  });
});

describe('fitPadding', () => {
  it('returns [top,right,bottom,left] clear of header, FABs and bottom sheet', () => {
    expect(fitPadding({ headerHeight: 100, fabColumnWidth: 60, sheetHeight: 208 })).toEqual([
      132, 92, 240, 32,
    ]);
  });

  it('honours a custom gutter', () => {
    expect(
      fitPadding({ headerHeight: 100, fabColumnWidth: 60, sheetHeight: 200, gutter: 16 }),
    ).toEqual([116, 76, 216, 16]);
  });
});
