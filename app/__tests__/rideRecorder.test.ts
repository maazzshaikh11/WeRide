import { RideRecorder, RecorderStorage, RecorderStart } from '../src/services/rideRecorder';
import type { VerifiedLocation } from '../src/models/verifiedLocation';
import { MAX_TRACK_POINTS } from '../src/models/domain';

const DEG_PER_M = 180 / (Math.PI * 6371000);
const T0 = 1_700_000_000_000;
const META: RecorderStart = {
  rideId: 'ride1', crewId: 'crew1', name: 'Marine Drive Sunrise',
  start: { label: 'Start', lat: 19, lng: 72.8 }, destination: { label: 'Lonavala', lat: 19.1, lng: 72.8 },
};

function fix(northM: number, o: Partial<VerifiedLocation> = {}, eastM = 0): VerifiedLocation {
  return {
    rider_id: 'me', group_id: 'ride1', timestamp_hlc: '', lat: 19 + northM * DEG_PER_M,
    lng: 72.8 + (eastM * DEG_PER_M) / Math.cos((19 * Math.PI) / 180),
    speed_mps: 10, heading_deg: 0, spoof_flag: false, nis_score: 0, accuracy_m: 5, ...o,
  };
}
const other = (northM: number, eastM = 0, id = 'o1') => fix(northM, { rider_id: id }, eastM);

function memory(): RecorderStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getString: (k) => map.get(k), set: (k, v) => void map.set(k, v), delete: (k) => void map.delete(k) };
}
const make = () => {
  const store = memory();
  return { rec: new RideRecorder(store), store };
};

/** Straight ride north at `mps`, one fix per second for `seconds`; returns the last `now`. */
function ride(rec: RideRecorder, seconds: number, mps = 10, from = 0) {
  for (let i = from; i <= seconds; i++) rec.onOwnFix(fix(i * mps, { speed_mps: mps }), T0 + i * 1000);
  return T0 + seconds * 1000;
}

describe('RideRecorder basics', () => {
  it('is idle until started, and finish() of nothing is null', () => {
    const { rec } = make();
    expect(rec.isRecording()).toBe(false);
    rec.onOwnFix(fix(0), T0);
    expect(rec.finish(3, T0 + 1000)).toBeNull();
    rec.start(META, T0);
    expect(rec.isRecording()).toBe(true);
    expect(rec.rideId()).toBe('ride1');
    expect(rec.finish(3, T0 + 1000)).toBeNull(); // no usable fix ever
    expect(rec.isRecording()).toBe(false);
  });

  it('a straight 1 km ride at 10 m/s: distance, duration, average and max speed', () => {
    const { rec } = make();
    rec.start(META, T0);
    const end = ride(rec, 100);
    const log = rec.finish(5, end)!;
    expect(log.ride_id).toBe('ride1');
    expect(log.crew_id).toBe('crew1');
    expect(log.name).toBe('Marine Drive Sunrise');
    expect(log.km).toBeCloseTo(1.0, 2);
    expect(log.duration_s).toBe(100);
    expect(log.started_ms).toBe(T0);
    expect(log.ended_ms).toBe(end);
    expect(log.avg_kmh).toBeCloseTo(36, 0);
    expect(log.max_kmh).toBeCloseTo(36, 1);
    expect(log.riders).toBe(5);
    expect(log.rating).toBeNull();
    expect(log.start).toEqual(META.start);
    expect(log.destination).toEqual(META.destination);
  });

  it('samples the track every >= 15 m and keeps the first and last position', () => {
    const { rec } = make();
    rec.start(META, T0);
    const end = ride(rec, 100); // 10 m per fix -> a point every 20 m (2 fixes)
    const log = rec.finish(1, end)!;
    const n = log.track.length / 2;
    expect(n).toBeGreaterThan(40);
    expect(n).toBeLessThan(60);
    expect(log.track[0]).toBeCloseTo(19, 6);
    expect(log.track[log.track.length - 2]).toBeCloseTo(19 + 1000 * DEG_PER_M, 6);
    expect(log.track.every(Number.isFinite)).toBe(true);
  });

  it('decimates a long ride to <= 600 points, keeping the first and last point', () => {
    const { rec } = make();
    rec.start(META, T0);
    const end = ride(rec, 3000, 20); // 60 km -> 3000 points of 20 m
    const log = rec.finish(1, end)!;
    expect(log.track.length / 2).toBeLessThanOrEqual(MAX_TRACK_POINTS);
    expect(log.track.length / 2).toBeGreaterThan(100);
    expect(log.track[0]).toBeCloseTo(19, 6);
    expect(log.track[log.track.length - 2]).toBeCloseTo(19 + 60000 * DEG_PER_M, 6);
    expect(log.km).toBeCloseTo(60, 1);
  });

  it('ignores bad fixes: accuracy > 50 m, spoof flag, NaN', () => {
    const { rec } = make();
    rec.start(META, T0);
    rec.onOwnFix(fix(0), T0);
    rec.onOwnFix(fix(500, { accuracy_m: 80 }), T0 + 1000);
    rec.onOwnFix(fix(500, { spoof_flag: true }), T0 + 2000);
    rec.onOwnFix({ ...fix(0), lat: NaN }, T0 + 3000);
    rec.onOwnFix(fix(30), T0 + 4000);
    const log = rec.finish(1, T0 + 5000)!;
    expect(log.km).toBeCloseTo(0.03, 2);
  });

  it('ignores GPS jumps above 120 m/s, then carries on from the real path', () => {
    const { rec } = make();
    rec.start(META, T0);
    ride(rec, 10);
    rec.onOwnFix(fix(100 + 50_000), T0 + 11_000); // 50 km in a second
    rec.onOwnFix(fix(100 + 10), T0 + 11_000 + 1000); // back on the road: +10 m from the last real fix at 100 m? (110 m)
    const log = rec.finish(1, T0 + 12_000)!;
    expect(log.km).toBeLessThan(0.2);
    expect(log.km).toBeCloseTo(0.11, 2);
    expect(log.max_kmh).toBeLessThan(40);
  });

  it('re-anchors after five jumps in a row (a real relocation) without adding the distance', () => {
    const { rec } = make();
    rec.start(META, T0);
    ride(rec, 10);
    for (let i = 0; i < 6; i++) rec.onOwnFix(fix(100_000 + i * 10), T0 + 11_000 + i * 1000);
    const log = rec.finish(1, T0 + 20_000)!;
    expect(log.km).toBeLessThan(0.3);
  });

  it('does not count stationary jitter as distance', () => {
    const { rec } = make();
    rec.start(META, T0);
    for (let i = 0; i < 60; i++) rec.onOwnFix(fix(i % 2 === 0 ? 0 : 1, { speed_mps: 0 }), T0 + i * 1000);
    const log = rec.finish(1, T0 + 60_000)!;
    expect(log.km).toBe(0);
  });

  it('counts hazards/signals and records events (one rolled, one arrived)', () => {
    const { rec } = make();
    rec.start(META, T0);
    ride(rec, 5);
    rec.countHazard();
    rec.countHazard();
    rec.countSignal();
    rec.addEvent('hazard', 'Pothole confirmed', T0 + 3000);
    rec.addEvent('rolled', 'Again', T0 + 3500); // ignored
    rec.addEvent('stop', 'Chai Point', T0 + 4000);
    rec.addEvent('arrived', 'Arrived ∙ Lonavala', T0 + 5000);
    rec.addEvent('arrived', 'Arrived twice', T0 + 5100);
    const log = rec.finish(2, T0 + 6000)!;
    expect(log.hazards_shared).toBe(2);
    expect(log.signals_sent).toBe(1);
    expect(log.events.map((e) => e.kind)).toEqual(['rolled', 'hazard', 'stop', 'arrived']);
    expect(log.events[0]).toEqual({ t_ms: T0, kind: 'rolled', text: 'Rolled out' });
    expect(log.events[3].text).toBe('Arrived ∙ Lonavala');
  });

  it('adds an arrived event on finish when none was recorded', () => {
    const { rec } = make();
    rec.start(META, T0);
    ride(rec, 5);
    const log = rec.finish(1, T0 + 6000)!;
    expect(log.events[log.events.length - 1]).toEqual({ t_ms: T0 + 6000, kind: 'arrived', text: 'Arrived ∙ Lonavala' });
  });

  it('start() for the ride already recording keeps the recording', () => {
    const { rec } = make();
    rec.start(META, T0);
    ride(rec, 20);
    rec.start(META, T0 + 99_000);
    const log = rec.finish(1, T0 + 21_000)!;
    expect(log.started_ms).toBe(T0);
    expect(log.km).toBeCloseTo(0.2, 2);
  });
});

describe('cohesion', () => {
  /** 100 s ride; `riderAt(i)` gives the other rider's northing for second i (null = not seen). */
  function cohesion(riderAt: (i: number) => { n: number; e?: number }[] | null) {
    const { rec } = make();
    rec.start(META, T0);
    for (let i = 0; i <= 100; i++) {
      const now = T0 + i * 1000;
      rec.onOwnFix(fix(i * 10), now);
      const o = riderAt(i);
      if (o) rec.onRiders(o.map((p, k) => other(p.n, p.e ?? 0, `o${k}`)), now);
    }
    return rec.finish(3, T0 + 100_000)!;
  }

  it('together the whole way (rider ~100 m behind): 100% and a ~100 m longest gap', () => {
    const log = cohesion((i) => [{ n: i * 10 - 100 }]);
    expect(log.together_pct).toBe(100);
    expect(log.longest_gap_m).toBeGreaterThanOrEqual(99);
    expect(log.longest_gap_m).toBeLessThanOrEqual(111);
  });

  it('a gap scenario: apart (> 500 m) for the last 39 of 100 s -> 61% together, longest gap = the real maximum', () => {
    // rider is 100 m behind for the first 60 s, then 800 m behind (seconds 61..100)
    const log = cohesion((i) => [{ n: i * 10 - (i <= 60 ? 100 : 800) }]);
    // an interval is credited with the state that held BEFORE it (own fix is applied first, then the riders), so 39 of 100 s are apart
    expect(log.together_pct).toBe(61);
    expect(log.longest_gap_m).toBeGreaterThanOrEqual(799);
    expect(log.longest_gap_m).toBeLessThanOrEqual(811);
  });

  it('exactly 500 m counts as together; beyond it does not', () => {
    const near = cohesion((i) => [{ n: i * 10 - 499 }]);
    const far = cohesion((i) => [{ n: i * 10 - 505 }]);
    expect(near.together_pct).toBe(100);
    expect(far.together_pct).toBe(0);
    expect(far.longest_gap_m).toBeGreaterThan(500);
  });

  it('uses the largest pairwise distance among all fresh riders, not just the distance to me', () => {
    // two riders 300 m ahead and 300 m behind me: each within 500 m of me but 600 m apart
    const log = cohesion((i) => [{ n: i * 10 + 300 }, { n: i * 10 - 300 }]);
    expect(log.together_pct).toBe(0);
    expect(log.longest_gap_m).toBeGreaterThan(590);
  });

  it('never seeing another rider: 0% and 0 m (the UI shows a dash)', () => {
    const log = cohesion(() => null);
    expect(log.together_pct).toBe(0);
    expect(log.longest_gap_m).toBe(0);
  });

  it('time with nobody fresh is not counted either way', () => {
    // seen together for the first 50 s, then nobody for 50 s
    const log = cohesion((i) => (i <= 50 ? [{ n: i * 10 - 100 }] : []));
    expect(log.together_pct).toBe(100);
  });

  it('credits at most 5 s per interval (a long silence is not "together")', () => {
    const { rec } = make();
    rec.start(META, T0);
    rec.onOwnFix(fix(0), T0);
    rec.onRiders([other(100)], T0);
    rec.onOwnFix(fix(10), T0 + 600_000); // 10 minutes later: only 5 s credited
    rec.onRiders([other(110)], T0 + 600_000);
    rec.onOwnFix(fix(20), T0 + 601_000);
    const log = rec.finish(2, T0 + 601_000)!;
    expect(log.together_pct).toBe(100);
  });

  it('ignores spoofed riders', () => {
    const { rec } = make();
    rec.start(META, T0);
    for (let i = 0; i <= 10; i++) {
      rec.onOwnFix(fix(i * 10), T0 + i * 1000);
      rec.onRiders([{ ...other(i * 10 + 5000), spoof_flag: true }], T0 + i * 1000);
    }
    const log = rec.finish(2, T0 + 10_000)!;
    expect(log.longest_gap_m).toBe(0);
    expect(log.together_pct).toBe(0);
  });
});

describe('persistence', () => {
  it('restores an in-progress recording of the same ride after an app restart', () => {
    const store = memory();
    const a = new RideRecorder(store);
    a.start(META, T0);
    for (let i = 0; i <= 60; i++) {
      a.onOwnFix(fix(i * 10), T0 + i * 1000);
      a.onRiders([other(i * 10 - 100)], T0 + i * 1000);
    }
    a.countHazard();
    a.addEvent('hazard', 'Pothole', T0 + 30_000);
    expect(store.map.size).toBe(1); // persisted

    // "restart": a brand new recorder over the same storage
    const b = new RideRecorder(store);
    expect(b.isRecording()).toBe(false);
    b.start(META, T0 + 90_000);
    expect(b.isRecording()).toBe(true);
    for (let i = 90; i <= 100; i++) b.onOwnFix(fix(i * 10), T0 + i * 1000);
    const log = b.finish(2, T0 + 100_000)!;
    expect(log.started_ms).toBe(T0); // the original start, not the restart
    expect(log.hazards_shared).toBe(1);
    expect(log.events.map((e) => e.kind)).toEqual(['rolled', 'hazard', 'arrived']);
    expect(log.km).toBeCloseTo(1.0, 1); // distance before and after the restart, straight line across the gap
    expect(log.together_pct).toBe(100);
    expect(store.map.size).toBe(0); // cleared on finish
  });

  it('discards a persisted recording of a different ride', () => {
    const store = memory();
    const a = new RideRecorder(store);
    a.start(META, T0);
    ride(a, 30);
    const b = new RideRecorder(store);
    b.start({ ...META, rideId: 'other' }, T0 + 50_000);
    const log = (b.onOwnFix(fix(0), T0 + 51_000), b.onOwnFix(fix(100), T0 + 61_000), b.finish(1, T0 + 62_000))!;
    expect(log.ride_id).toBe('other');
    expect(log.started_ms).toBe(T0 + 50_000);
    expect(log.km).toBeCloseTo(0.1, 2);
  });

  it('persists about every 10 s while fixes arrive, and reset() clears the disk', () => {
    const store = memory();
    const spy = jest.spyOn(store, 'set');
    const rec = new RideRecorder(store);
    rec.start(META, T0);
    const afterStart = spy.mock.calls.length;
    for (let i = 0; i <= 25; i++) rec.onOwnFix(fix(i * 10), T0 + i * 1000);
    expect(spy.mock.calls.length - afterStart).toBe(2); // at 10 s and 20 s
    rec.reset();
    expect(store.map.size).toBe(0);
    expect(rec.isRecording()).toBe(false);
  });

  it('survives corrupt storage and a storage that throws', () => {
    const bad = memory();
    bad.map.set('recording.v1', '{not json');
    const rec = new RideRecorder(bad);
    expect(() => rec.start(META, T0)).not.toThrow();
    expect(rec.isRecording()).toBe(true);
    const boom: RecorderStorage = { getString: () => { throw new Error('x'); }, set: () => { throw new Error('x'); }, delete: () => { throw new Error('x'); } };
    const r2 = new RideRecorder(boom);
    r2.start(META, T0);
    expect(() => ride(r2, 15)).not.toThrow();
    expect(r2.finish(1, T0 + 16_000)!.km).toBeGreaterThan(0.1);
  });

  it('works with no storage at all', () => {
    const rec = new RideRecorder(null);
    rec.start(META, T0);
    ride(rec, 10);
    expect(rec.finish(1, T0 + 11_000)!.km).toBeCloseTo(0.1, 2);
  });
});
