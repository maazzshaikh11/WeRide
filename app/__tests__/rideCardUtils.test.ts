import { encodePolyline } from '../src/utils/polyline';
import { buildStaticMapUrl } from '../src/utils/staticMap';
import { projectSketch } from '../src/utils/routeSketch';
import {
  planPoints, planDistanceKm, rideBadge, sectionRides, createdMs, formatKm, shortPlace, RECENT_WINDOW_MS,
} from '../src/utils/rides';
import type { Group } from '@routing/group/groupService';

const NOW = Date.UTC(2026, 9, 5, 12, 0, 0);
const H = 3_600_000;
const plan = {
  start: { label: 'Pune, Maharashtra', lat: 18.5204, lng: 73.8567 },
  destination: { label: 'Lonavala, Maharashtra', lat: 18.7546, lng: 73.4062 },
  stops: [{ id: 's1', label: 'Chai Point', lat: 18.6, lng: 73.7, icon: '☕' }],
};
const g = (over: Partial<Group>): Group => ({
  id: 'g', name: 'Ride', created_by: 'u', member_ids: ['u'], created_at: null, active_ride_id: null, ...over,
});

describe('encodePolyline', () => {
  it("matches Google's documented example", () => {
    expect(
      encodePolyline([
        { lat: 38.5, lng: -120.2 },
        { lat: 40.7, lng: -120.95 },
        { lat: 43.252, lng: -126.453 },
      ]),
    ).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  });
  it('empty → empty string', () => expect(encodePolyline([])).toBe(''));
});

describe('buildStaticMapUrl', () => {
  const pts = [
    { lat: 18.5204, lng: 73.8567 },
    { lat: 18.6, lng: 73.7 },
    { lat: 18.7546, lng: 73.4062 },
  ];
  it('null without a token or points (caller falls back to the sketch)', () => {
    expect(buildStaticMapUrl({ points: pts, width: 400, height: 200, token: '' })).toBeNull();
    expect(buildStaticMapUrl({ points: [], width: 400, height: 200, token: 'pk.x' })).toBeNull();
    expect(buildStaticMapUrl({ points: [{ lat: 0, lng: 0 }], width: 400, height: 200, token: 'pk.x' })).toBeNull();
  });
  it('draws the ember path, green start pin, ember end pin and auto-frames', () => {
    const u = buildStaticMapUrl({ points: pts, width: 400, height: 200, token: 'pk.abc' })!;
    expect(u).toContain('/styles/v1/mapbox/dark-v11/static/');
    expect(u).toContain('path-4+FF4D00-1(');
    expect(u).toContain('pin-s+2FD180(73.85670,18.52040)');
    expect(u).toContain('pin-s+FF4D00(73.40620,18.75460)');
    expect(u).toContain('/auto/400x200@2x?padding=36&access_token=pk.abc');
  });
  it('same start and end → centred at zoom 14, no path, no auto-fit', () => {
    const u = buildStaticMapUrl({ points: [pts[0], { ...pts[0] }], width: 400, height: 200, token: 'pk.abc' })!;
    expect(u).not.toContain('path-');
    expect(u).toContain('/73.85670,18.52040,14/400x200@2x');
  });
  it('clamps size to the API limit', () => {
    expect(buildStaticMapUrl({ points: pts, width: 5000, height: 5000, token: 'pk.a' })).toContain('1280x1280@2x');
  });
});

describe('projectSketch', () => {
  it('null with no usable points', () => expect(projectSketch([], 300, 150)).toBeNull());
  it('keeps every dot inside the padded box and orders start/stop/end', () => {
    const s = projectSketch(
      [
        { lat: 18.5204, lng: 73.8567 },
        { lat: 18.6, lng: 73.7 },
        { lat: 18.7546, lng: 73.4062 },
      ],
      300,
      150,
      20,
    )!;
    expect(s.dots.map((d) => d.kind)).toEqual(['start', 'stop', 'end']);
    s.dots.forEach((d) => {
      expect(d.x).toBeGreaterThanOrEqual(19.9);
      expect(d.x).toBeLessThanOrEqual(280.1);
      expect(d.y).toBeGreaterThanOrEqual(19.9);
      expect(d.y).toBeLessThanOrEqual(130.1);
    });
    expect(s.segs).toHaveLength(2);
  });
  it('north is up and west is left', () => {
    const s = projectSketch([{ lat: 10, lng: 10 }, { lat: 11, lng: 9 }], 200, 200, 10)!;
    expect(s.dots[1].y).toBeLessThan(s.dots[0].y);
    expect(s.dots[1].x).toBeLessThan(s.dots[0].x);
  });
  it('a single point sits centred with no segments', () => {
    const s = projectSketch([{ lat: 18.5, lng: 73.8 }], 300, 150)!;
    expect(s.segs).toHaveLength(0);
    expect(s.dots[0]).toMatchObject({ x: 150, y: 75 });
  });
});

describe('ride helpers', () => {
  it('planPoints orders start, stops, destination and drops unusable ones', () => {
    expect(planPoints({ ride_plan: plan }).map((p) => p.label)).toEqual(['Pune, Maharashtra', 'Chai Point', 'Lonavala, Maharashtra']);
    expect(planPoints({ ride_plan: { start: null, destination: plan.destination, stops: [] } })).toHaveLength(1);
    expect(planPoints({ ride_plan: null })).toEqual([]);
  });
  it('planDistanceKm sums straight-line legs; null with < 2 points', () => {
    const km = planDistanceKm({ ride_plan: plan })!;
    expect(km).toBeGreaterThan(50);
    expect(km).toBeLessThan(70);
    expect(planDistanceKm({ ride_plan: { start: null, destination: plan.destination, stops: [] } })).toBeNull();
  });
  it('rideBadge reflects the schedule only', () => {
    expect(rideBadge({ start_time_ms: null }, NOW)).toEqual({ label: 'Planned', tone: 'dim' });
    expect(rideBadge({ start_time_ms: NOW + H }, NOW)).toEqual({ label: 'Upcoming', tone: 'ice' });
    expect(rideBadge({ start_time_ms: NOW - H }, NOW)).toEqual({ label: 'Started', tone: 'go' });
    expect(rideBadge({ start_time_ms: NOW - RECENT_WINDOW_MS - 1 }, NOW)).toEqual({ label: 'Past', tone: 'dim' });
  });
  it('sectionRides: soonest scheduled is up next; unscheduled newest first; old ones are earlier', () => {
    const soon = g({ id: 'soon', start_time_ms: NOW + H });
    const later = g({ id: 'later', start_time_ms: NOW + 30 * H });
    const old = g({ id: 'old', start_time_ms: NOW - 40 * H });
    const olderUnsched = g({ id: 'u1', created_at: { toMillis: () => 1000 } });
    const newerUnsched = g({ id: 'u2', created_at: { toMillis: () => 2000 } });
    const r = sectionRides([later, olderUnsched, old, newerUnsched, soon], NOW);
    expect(r.upNext?.id).toBe('soon');
    expect(r.rides.map((x) => x.id)).toEqual(['later', 'u2', 'u1']);
    expect(r.earlier.map((x) => x.id)).toEqual(['old']);
  });
  it('sectionRides with nothing scheduled has no up-next', () => {
    expect(sectionRides([g({ id: 'a' })], NOW)).toMatchObject({ upNext: null, rides: [{ id: 'a' }], earlier: [] });
    expect(sectionRides([], NOW)).toEqual({ upNext: null, rides: [], earlier: [] });
  });
  it('createdMs understands Firestore timestamps, seconds objects, Dates and null', () => {
    expect(createdMs({ created_at: { toMillis: () => 5 } })).toBe(5);
    expect(createdMs({ created_at: { seconds: 2 } })).toBe(2000);
    expect(createdMs({ created_at: new Date(7) })).toBe(7);
    expect(createdMs({ created_at: null })).toBe(0);
  });
  it('formatKm / shortPlace', () => {
    expect(formatKm(4.26)).toBe('4.3');
    expect(formatKm(58.4)).toBe('58');
    expect(shortPlace('Pune, Maharashtra, India')).toBe('Pune');
    expect(shortPlace('  ')).toBeNull();
    expect(shortPlace(undefined)).toBeNull();
  });
});

import { greetingFor, dayLabel, timeOfDay, startLabel } from '../src/utils/rides';

describe('date/time labels', () => {
  it('greeting follows the hour', () => {
    const at = (h: number) => greetingFor(new Date(2026, 9, 5, h, 0));
    expect([at(3), at(9), at(13), at(18), at(22)]).toEqual([
      'Good night', 'Good morning', 'Good afternoon', 'Good evening', 'Good night',
    ]);
  });
  it('12-hour clock edge cases', () => {
    expect(timeOfDay(new Date(2026, 9, 5, 0, 5))).toBe('12:05 AM');
    expect(timeOfDay(new Date(2026, 9, 5, 12, 0))).toBe('12:00 PM');
    expect(timeOfDay(new Date(2026, 9, 5, 18, 30))).toBe('6:30 PM');
  });
  it('day and start labels (Oct 5 2026 is a Monday)', () => {
    expect(dayLabel(new Date(2026, 9, 5))).toBe('MON, OCT 5');
    expect(startLabel(new Date(2026, 9, 5, 6, 0).getTime())).toBe('MON, OCT 5 · 6:00 AM');
    expect(startLabel(null)).toBeNull();
  });
});
