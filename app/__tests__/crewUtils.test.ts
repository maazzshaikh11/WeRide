import type { Ride } from '../src/models/domain';
import { qrMatrix, qrPath } from '../src/utils/qr';
import { clock12, formatDay, formatWhen, monthName, nextCrewRide, startsWithin24h, togetherPct, upcomingCrewRides } from '../src/utils/crewRides';
import { useCrewsStore } from '../src/store/crewsStore';

describe('qr', () => {
  it('encodes a crew code as a square matrix with the three finder patterns', () => {
    const m = qrMatrix('K7M2QX');
    const n = m.length;
    expect(n).toBeGreaterThanOrEqual(21);
    expect(m.every((r) => r.length === n)).toBe(true);
    for (let i = 0; i < 7; i++) {
      expect(m[0][i]).toBe(true); // top-left finder, top edge
      expect(m[0][n - 1 - i]).toBe(true); // top-right
      expect(m[n - 1][i]).toBe(true); // bottom-left
    }
    expect(m[n - 1][n - 1]).toBe(false);
  });
  it('is deterministic and differs per code', () => {
    expect(qrPath(qrMatrix('K7M2QX'))).toBe(qrPath(qrMatrix('K7M2QX')));
    expect(qrPath(qrMatrix('K7M2QX'))).not.toBe(qrPath(qrMatrix('K7M2QY')));
  });
  it('qrPath is one run-merged path of unit rows', () => {
    expect(qrPath([[true, true, false, true], [false, false, false, false]])).toBe('M0 0h2v1h-2zM3 0h1v1h-1z');
    expect(qrPath([])).toBe('');
  });
});

const T = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime();
const ride = (o: Partial<Ride>): Ride => ({
  id: 'r', name: 'Ride', created_by: 'x', member_ids: ['x'], crew_id: 'c1', join_code: null, ride_type: null, pace: null, start_time_ms: null,
  status: 'planned', started_ms: null, finished_ms: null, meetup: null, ride_plan: null, invited_ids: [], created_ms: null, ...o,
});

describe('crewRides', () => {
  const now = T(9, 18, 0); // Fri 9 Oct 2026, 18:00
  it('clock12 / formatWhen', () => {
    expect(clock12(T(10, 6, 30))).toBe('6:30 AM');
    expect(clock12(T(10, 0, 5))).toBe('12:05 AM');
    expect(clock12(T(10, 12, 0))).toBe('12:00 PM');
    expect(clock12(T(10, 19, 0))).toBe('7:00 PM');
    expect(formatWhen(T(9, 20, 0), now)).toBe('Today 8:00 PM');
    expect(formatWhen(T(10, 6, 30), now)).toBe('Tomorrow 6:30 AM');
    expect(formatWhen(T(13, 6, 30), now)).toBe('Tue 6:30 AM');
    expect(formatWhen(T(30, 6, 30), now)).toBe('30 Oct 6:30 AM');
    expect(formatDay(T(3, 8))).toBe('3 Oct');
  });
  it('monthName is null when the creation time is unknown', () => {
    expect(monthName(T(3, 8))).toBe('OCTOBER');
    expect(monthName(null)).toBeNull();
    expect(monthName(undefined)).toBeNull();
  });
  it("picks the crew's own next unfinished ride, soonest first", () => {
    const rides = [
      ride({ id: 'late', start_time_ms: T(20, 6) }),
      ride({ id: 'soon', start_time_ms: T(10, 6, 30) }),
      ride({ id: 'done', start_time_ms: T(9, 19), status: 'finished' }),
      ride({ id: 'old', start_time_ms: T(1, 6) }),
      ride({ id: 'other', crew_id: 'c2', start_time_ms: T(9, 19) }),
      ride({ id: 'untimed' }),
    ];
    expect(upcomingCrewRides(rides, 'c1', now).map((r) => r.id)).toEqual(['soon', 'late', 'untimed']);
    expect(nextCrewRide(rides, 'c1', now)?.id).toBe('soon');
    expect(nextCrewRide(rides, 'nobody', now)).toBeNull();
  });
  it('a live or meetup ride is always upcoming, even if its planned start passed', () => {
    expect(nextCrewRide([ride({ id: 'live', status: 'live', start_time_ms: T(1, 6) })], 'c1', now)?.id).toBe('live');
  });
  it('startsWithin24h', () => {
    expect(startsWithin24h(ride({ start_time_ms: T(10, 6, 30) }), now)).toBe(true);
    expect(startsWithin24h(ride({ start_time_ms: T(10, 18, 0) }), now)).toBe(true);
    expect(startsWithin24h(ride({ start_time_ms: T(10, 18, 1) }), now)).toBe(false);
    expect(startsWithin24h(ride({ start_time_ms: T(9, 17) }), now)).toBe(false);
    expect(startsWithin24h(ride({ start_time_ms: null }), now)).toBe(false);
    expect(startsWithin24h(null, now)).toBe(false);
  });
  it('togetherPct = together_sum / rides, null without rides', () => {
    expect(togetherPct({ km: 0, rides: 0, together_sum: 0 })).toBeNull();
    expect(togetherPct({ km: 10, rides: 4, together_sum: 380 })).toBe(95);
    expect(togetherPct({ km: 10, rides: 1, together_sum: 150 })).toBe(100);
  });
});

describe('crewsStore mute preference', () => {
  it('is per crew and local', () => {
    useCrewsStore.getState().setMuted('c1', true);
    expect(useCrewsStore.getState().muted).toEqual({ c1: true });
    useCrewsStore.getState().setMuted('c1', false);
    expect(useCrewsStore.getState().muted).toEqual({});
  });
});
