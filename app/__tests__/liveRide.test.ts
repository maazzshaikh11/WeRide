import {
  ARRIVE_M, EMPTY_DWELL, EMPTY_TRACKER, HAZARD_AHEAD_M, STOP_DWELL_MS, aheadOf, buildRouteLine, hazardAhead, hazardName, hazardPositions,
  projectOnRoute, reportedBy, stepArrive, stepDwell, stepHazardTracker, stopAhead, stopInZone,
} from '../src/screens/map/live/liveRide';

const O = { lat: 18.5, lng: 73.8 };
const north = (m: number, base = O) => ({ lat: base.lat + m / 111320, lng: base.lng });
// a straight route 5 km north, one vertex per km
const PATH = [0, 1000, 2000, 3000, 4000, 5000].map((m) => [north(m).lat, north(m).lng]);
const LINE = buildRouteLine(PATH)!;
const cluster = (id: string, m: number, extra: object = {}) => ({
  cluster_id: id, hazard_type: 'pothole', centroid_lat: north(m).lat, centroid_lng: north(m).lng, report_count: 2, status: 'active', ...extra,
});

describe('route projection', () => {
  it('builds a line and drops unusable points', () => {
    expect(buildRouteLine(null)).toBeNull();
    expect(buildRouteLine([[1, 1]])).toBeNull();
    expect(LINE.cum[LINE.cum.length - 1]).toBeGreaterThan(4990);
  });
  it('projects along and off the line', () => {
    const p = projectOnRoute(LINE, { lat: north(1500).lat, lng: O.lng + 0.0009 }); // ~95 m east
    expect(p.alongM).toBeGreaterThan(1490);
    expect(p.alongM).toBeLessThan(1510);
    expect(p.offM).toBeGreaterThan(90);
    expect(p.offM).toBeLessThan(100);
  });
});

describe('aheadOf', () => {
  it('is signed along the route: ahead positive, behind negative', () => {
    const own = north(1000);
    expect(aheadOf(LINE, own, north(1380))!.aheadM).toBeCloseTo(380, -1);
    expect(aheadOf(LINE, own, north(900))!.aheadM).toBeCloseTo(-100, -1);
  });
  it('falls back to the heading when the rider is far from the route, only while moving', () => {
    const own = { lat: O.lat, lng: O.lng + 0.05, headingDeg: 0, speedMps: 10 }; // ~5 km east of the route
    const t = north(300, own);
    expect(aheadOf(LINE, own, t)!.aheadM).toBeCloseTo(300, -1);
    expect(aheadOf(LINE, { ...own, headingDeg: 180 }, t)!.aheadM).toBeLessThan(0);
    expect(aheadOf(LINE, { ...own, speedMps: 0 }, t)).toBeNull();
    expect(aheadOf(null, own, t)!.aheadM).toBeCloseTo(300, -1);
  });
});

describe('hazard ahead', () => {
  const own = north(1000);
  it('finds the nearest active cluster within 500 m ahead', () => {
    const h = hazardAhead(LINE, own, [cluster('far', 1700), cluster('near', 1380), cluster('behind', 800)]);
    expect(h?.cluster.cluster_id).toBe('near');
    expect(h!.aheadM).toBeCloseTo(380, -1);
  });
  it(`ignores clusters beyond ${HAZARD_AHEAD_M} m, behind, resolved, or off the road`, () => {
    expect(hazardAhead(LINE, own, [cluster('far', 1600)])).toBeNull();
    expect(hazardAhead(LINE, own, [cluster('behind', 900)])).toBeNull();
    expect(hazardAhead(LINE, own, [cluster('done', 1200, { status: 'resolved' })])).toBeNull();
    expect(hazardAhead(LINE, own, [{ ...cluster('side', 1200), centroid_lng: O.lng + 0.01 }])).toBeNull();
  });
  it('names and counts', () => {
    expect(hazardName('oil_spill')).toBe('Oil');
    expect(hazardName('weird')).toBe('Hazard');
    expect(reportedBy(3)).toBe('Reported by 3 riders');
    expect(reportedBy(1)).toBe('Reported by a rider');
  });
});

describe('hazard tracker (post-hazard confirm)', () => {
  it('offers the confirm once, after the hazard was ahead and is now behind', () => {
    const c = cluster('h1', 1300);
    let state = EMPTY_TRACKER;
    const at = (m: number) => stepHazardTracker(state, hazardPositions(LINE, north(m), [c]));
    let r = at(1000); state = r.state; expect(r.passed).toBeNull();
    r = at(1250); state = r.state; expect(r.passed).toBeNull(); // still ahead (50 m)
    r = at(1320); state = r.state; expect(r.passed?.cluster_id).toBe('h1'); // 20 m behind it now
  });
  it('fires exactly once', () => {
    const c = cluster('h1', 1300);
    let state = EMPTY_TRACKER;
    const seq = [1000, 1290, 1330, 1400, 1500];
    const passes: string[] = [];
    for (const m of seq) {
      const r = stepHazardTracker(state, hazardPositions(LINE, north(m), [c]));
      state = r.state;
      if (r.passed) passes.push(r.passed.cluster_id);
    }
    expect(passes).toEqual(['h1']);
  });
  it('a hazard never seen ahead (e.g. reported while already past it) is not offered', () => {
    const r = stepHazardTracker(EMPTY_TRACKER, hazardPositions(LINE, north(2000), [cluster('h', 1900)]));
    expect(r.passed).toBeNull();
  });
});

describe('stops', () => {
  const stops = [{ id: 's1', label: 'Chai Point', lat: north(1600).lat, lng: north(1600).lng }];
  it('stop ahead within 800 m', () => {
    expect(stopAhead(LINE, north(1000), stops, new Set())!.distanceM).toBeCloseTo(600, -1);
    expect(stopAhead(LINE, north(700), stops, new Set())).toBeNull(); // 900 m
    expect(stopAhead(LINE, north(1700), stops, new Set())).toBeNull(); // behind
    expect(stopAhead(LINE, north(1000), stops, new Set(['s1']))).toBeNull(); // already visited
  });
  it('stop zone is 150 m', () => {
    expect(stopInZone(north(1500), stops, new Set())?.id).toBe('s1');
    expect(stopInZone(north(1400), stops, new Set())).toBeNull();
  });
  it('dwell: < 5 km/h for 20 s inside the zone opens Stop, once', () => {
    let st = EMPTY_DWELL;
    let r = stepDwell(st, { zoneStopId: 's1', speedKmh: 2, now: 0 }); st = r.state;
    expect(r.open).toBeNull();
    r = stepDwell(st, { zoneStopId: 's1', speedKmh: 3, now: STOP_DWELL_MS - 1 }); st = r.state;
    expect(r.open).toBeNull();
    r = stepDwell(st, { zoneStopId: 's1', speedKmh: 3, now: STOP_DWELL_MS }); st = r.state;
    expect(r.open).toBe('s1');
    expect(stepDwell(st, { zoneStopId: 's1', speedKmh: 0, now: STOP_DWELL_MS + 1 }).open).toBeNull();
  });
  it('dwell resets when the rider moves or leaves the zone', () => {
    let st = stepDwell(EMPTY_DWELL, { zoneStopId: 's1', speedKmh: 1, now: 0 }).state;
    st = stepDwell(st, { zoneStopId: 's1', speedKmh: 30, now: 10_000 }).state;
    expect(stepDwell(st, { zoneStopId: 's1', speedKmh: 1, now: 25_000 }).open).toBeNull();
    expect(stepDwell(st, { zoneStopId: null, speedKmh: 0, now: 40_000 }).open).toBeNull();
    expect(stepDwell(EMPTY_DWELL, { zoneStopId: 's1', speedKmh: null, now: 0 }).state).toEqual(EMPTY_DWELL);
  });
});

describe('arrive', () => {
  const dest = north(5000);
  it(`arrives within ${ARRIVE_M} m, only after having been away`, () => {
    let st = { armed: false };
    let r = stepArrive(st, north(0), dest); st = r.state;
    expect(r).toMatchObject({ arrived: false, state: { armed: true } });
    r = stepArrive(st, north(4900), dest); st = r.state;
    expect(r.arrived).toBe(true);
  });
  it('a ride that starts at its destination does not arrive immediately', () => {
    expect(stepArrive({ armed: false }, north(4950), dest).arrived).toBe(false);
    expect(stepArrive({ armed: true }, north(4700), dest).arrived).toBe(false);
  });
  it('no destination, no arrival', () => {
    expect(stepArrive({ armed: true }, O, null).arrived).toBe(false);
  });
});
