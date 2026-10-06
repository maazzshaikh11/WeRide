import type { Ride } from '../src/models/domain';
import { countdownLabel, pastDestinations, pickNextRide, upcomingRides, isUpcoming } from '../src/utils/rideHero';

const H = 3_600_000;
const NOW = 1_800_000_000_000;
let n = 0;
function ride(over: Partial<Ride>): Ride {
  n += 1;
  return {
    id: `r${n}`, name: `Ride ${n}`, created_by: 'u1', member_ids: ['u1'], crew_id: null, join_code: null, ride_type: null, pace: null,
    start_time_ms: null, status: 'planned', started_ms: null, finished_ms: null, meetup: null, ride_plan: null, invited_ids: [], created_ms: null,
    ...over,
  };
}

describe('pickNextRide', () => {
  it('is null with no rides', () => expect(pickNextRide([], NOW)).toBeNull());

  it('a live ride beats a meetup ride and a planned one', () => {
    const planned = ride({ start_time_ms: NOW + H });
    const meetup = ride({ status: 'meetup', start_time_ms: NOW + 2 * H });
    const live = ride({ status: 'live', started_ms: NOW - H });
    expect(pickNextRide([planned, meetup, live], NOW)).toBe(live);
  });

  it('with several live rides, the most recently started', () => {
    const a = ride({ status: 'live', started_ms: NOW - 3 * H });
    const b = ride({ status: 'live', started_ms: NOW - H });
    expect(pickNextRide([a, b], NOW)).toBe(b);
  });

  it('a meetup ride beats a nearer planned ride', () => {
    const planned = ride({ start_time_ms: NOW + H });
    const meetup = ride({ status: 'meetup', start_time_ms: NOW + 20 * H });
    expect(pickNextRide([planned, meetup], NOW)).toBe(meetup);
  });

  it('the nearest upcoming ride; one that started < 12 h ago still counts', () => {
    const far = ride({ start_time_ms: NOW + 30 * H });
    const near = ride({ start_time_ms: NOW + 2 * H });
    expect(pickNextRide([far, near], NOW)).toBe(near);
    const justStarted = ride({ start_time_ms: NOW - 1 * H });
    expect(pickNextRide([far, justStarted], NOW)).toBe(justStarted);
  });

  it('a planned ride that started more than 12 h ago, and unscheduled rides, are not upcoming', () => {
    expect(isUpcoming(ride({ start_time_ms: NOW - 13 * H }), NOW)).toBe(false);
    expect(isUpcoming(ride({ start_time_ms: NOW - 11 * H }), NOW)).toBe(true);
    expect(isUpcoming(ride({ start_time_ms: null }), NOW)).toBe(false);
    expect(pickNextRide([ride({ start_time_ms: NOW - 13 * H }), ride({})], NOW)).toBeNull();
  });

  it('finished: only within 24 h of ending and only with a log', () => {
    const fresh = ride({ status: 'finished', finished_ms: NOW - 2 * H });
    const old = ride({ status: 'finished', finished_ms: NOW - 25 * H });
    expect(pickNextRide([fresh], NOW, new Set())).toBeNull();
    expect(pickNextRide([fresh], NOW, new Set([fresh.id]))).toBe(fresh);
    expect(pickNextRide([fresh], NOW, [fresh.id])).toBe(fresh);
    expect(pickNextRide([old], NOW, new Set([old.id]))).toBeNull();
  });

  it('the most recent finished ride; upcoming still wins over finished', () => {
    const a = ride({ status: 'finished', finished_ms: NOW - 5 * H });
    const b = ride({ status: 'finished', finished_ms: NOW - 1 * H });
    expect(pickNextRide([a, b], NOW, [a.id, b.id])).toBe(b);
    const up = ride({ start_time_ms: NOW + 5 * H });
    expect(pickNextRide([a, b, up], NOW, [a.id, b.id])).toBe(up);
  });

  it('a finished ride falls back to started_ms / start_time_ms for when it ended', () => {
    const r = ride({ status: 'finished', started_ms: NOW - 3 * H });
    expect(pickNextRide([r], NOW, [r.id])).toBe(r);
  });
});

describe('upcomingRides', () => {
  it('lists the other upcoming rides soonest first, never the hero or live/finished ones', () => {
    const hero = ride({ start_time_ms: NOW + H });
    const a = ride({ start_time_ms: NOW + 48 * H });
    const b = ride({ start_time_ms: NOW + 24 * H });
    const live = ride({ status: 'live', started_ms: NOW });
    const done = ride({ status: 'finished', finished_ms: NOW - H, start_time_ms: NOW - 3 * H });
    expect(upcomingRides([hero, a, b, live, done], NOW, hero.id).map((r) => r.id)).toEqual([b.id, a.id]);
  });
});

describe('countdownLabel', () => {
  it.each([
    [49 * 60_000, 'IN 49 MIN'],
    [30_000, 'IN 1 MIN'],
    [60 * 60_000, 'IN 1H 00M'],
    [(3 * 60 + 5) * 60_000, 'IN 3H 05M'],
    [24 * H, 'IN 1 DAY'],
    [60 * H, 'IN 2 DAYS'],
    [0, 'NOW'],
    [-20 * 60_000, 'STARTED 20 MIN AGO'],
    [-3 * H, 'STARTED 3H AGO'],
  ])('start %i ms from now -> %s', (offset, label) => {
    expect(countdownLabel(NOW + offset, NOW)).toBe(label);
  });
});

describe('pastDestinations', () => {
  const dest = (label: string, lat = 18.5, lng = 73.8) => ({ start: null, stops: [], destination: { label, lat, lng } });
  it('distinct, newest first, only finished rides (and logs), limited', () => {
    const rides = [
      ride({ status: 'finished', finished_ms: NOW - 5 * H, ride_plan: dest('Lonavala, Maharashtra') }),
      ride({ status: 'finished', finished_ms: NOW - 1 * H, ride_plan: dest('Karjat, Maharashtra') }),
      ride({ status: 'finished', finished_ms: NOW - 9 * H, ride_plan: dest('lonavala, India') }),
      ride({ status: 'planned', start_time_ms: NOW + H, ride_plan: dest('Alibag') }),
    ];
    const logs = [{ destination: { label: 'Tamhini Ghat, Pune', lat: 1, lng: 2 }, ended_ms: NOW - 2 * H }];
    expect(pastDestinations(rides, logs).map((d) => d.short)).toEqual(['Karjat', 'Tamhini Ghat', 'Lonavala']);
    expect(pastDestinations(rides, logs, 2)).toHaveLength(2);
    expect(pastDestinations([], [])).toEqual([]);
  });
});
