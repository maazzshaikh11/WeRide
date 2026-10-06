import type { Crew, Ride } from '../src/models/domain';
import type { HazardCluster } from '../src/models/hazardCluster';
import { routeResponseFromJson } from '../src/models/routeResponse';
import { INITIAL_DRAFT, PLAN_STOP_ID, usePlanDraftStore } from '../src/store/planDraftStore';
import { geocodeSearchStrict, geocodingAvailable, reverseGeocode } from '../src/utils/geocode';
import { hazardLabel, hlcMs, intelItems, intelSummary } from '../src/utils/intel';
import { flattenPath, pairsToPoints, pathLengthM, pathMidpoint, unflattenPath, distanceAlongPathKm, distanceToPathM, hazardsNearPath } from '../src/utils/routeGeo';
import { clampTime, clockLabel, clockParts, dayChips, headerLabel, startMsFor, ticketWhen, whenLabel, agoLabel } from '../src/utils/planWhen';
import { popularPlaces } from '../src/utils/popularPlaces';
import { buildPulse } from '../src/utils/pulse';
import { alternativesOf, buildOptions, durationLabel, hazardNote } from '../src/utils/routeOptions';
import { generateJoinCode, JOIN_CODE_ALPHABET } from '../src/utils/joinCode';
import { RoutingClient } from '@routing/client/routingClient';

describe('planWhen', () => {
  it('clock parts use the right AM/PM', () => {
    expect(clockParts(390)).toEqual({ hh: 6, mm: '30', ampm: 'AM' });
    expect(clockParts(300)).toEqual({ hh: 5, mm: '00', ampm: 'AM' });
    expect(clockParts(600)).toEqual({ hh: 10, mm: '00', ampm: 'AM' });
    expect(clockLabel(720)).toBe('12:00 PM');
    expect(clockLabel(0)).toBe('12:00 AM');
    expect(clockLabel(13 * 60 + 5)).toBe('1:05 PM');
  });
  it('clamps the roll-out time to 5:00-10:00', () => {
    expect(clampTime(100)).toBe(300);
    expect(clampTime(900)).toBe(600);
    expect(clampTime(400)).toBe(400);
  });
  it('day chips: Today, Tomorrow, then the next two dates by name (also across a month end)', () => {
    expect(dayChips(new Date(2025, 9, 16, 10)).map((c) => c.label)).toEqual(['Today', 'Tomorrow', 'Sat 18 Oct', 'Sun 19 Oct']);
    expect(dayChips(new Date(2025, 9, 30, 10)).map((c) => c.label)).toEqual(['Today', 'Tomorrow', 'Sat 1 Nov', 'Sun 2 Nov']);
    expect(dayChips(new Date(2025, 9, 16)).map((c) => c.offset)).toEqual([0, 1, 2, 3]);
  });
  it('startMsFor is local midnight + days + minutes', () => {
    const now = new Date(2025, 9, 16, 22, 40);
    expect(new Date(startMsFor(1, 390, now))).toEqual(new Date(2025, 9, 17, 6, 30));
    expect(new Date(startMsFor(0, 300, now))).toEqual(new Date(2025, 9, 16, 5, 0));
    expect(new Date(startMsFor(2, 600, new Date(2025, 11, 31)))).toEqual(new Date(2026, 0, 2, 10, 0));
  });
  it('labels', () => {
    const now = new Date(2025, 9, 11, 5, 41);
    expect(headerLabel(now)).toBe('SAT 11 OCT · 5:41 AM');
    expect(whenLabel(new Date(2025, 9, 12, 6, 30).getTime(), now)).toBe('Tomorrow · 6:30 AM');
    expect(whenLabel(new Date(2025, 9, 11, 18, 0).getTime(), now)).toBe('Today · 6:00 PM');
    expect(whenLabel(new Date(2025, 9, 18, 6, 0).getTime(), now)).toBe('Sat 18 Oct · 6:00 AM');
    expect(ticketWhen(new Date(2025, 9, 11, 6, 30).getTime())).toBe('Sat 11 Oct · 6:30 AM');
    expect(agoLabel(1000, 1000)).toBe('just now');
    expect(agoLabel(0, 40 * 60_000)).toBe('40 min ago');
    expect(agoLabel(0, 2 * 3_600_000)).toBe('2h ago');
    expect(agoLabel(0, 3 * 86_400_000)).toBe('3 d ago');
  });
});

describe('route options', () => {
  const alt = (id: string, eta: number, km: number, safety: number, hz: number, label: any) => ({ route_id: id, path_points: [[19, 72.8], [19.1, 72.9]], distance_km: km, eta_minutes: eta, safety_score: safety, hazard_count: hz, label });
  it('titles, notes, deltas and the recommendation come from the real numbers', () => {
    const o = buildOptions([alt('a', 125, 84, 0.78, 2, 'Fastest'), alt('b', 132, 91, 0.91, 0, 'Safest'), alt('c', 150, 102, 0.8, 1, 'Alternative')]);
    expect(o.map((x) => x.title)).toEqual(['Fastest', 'Safest', 'Alternative']);
    expect(o.map((x) => x.safety)).toEqual([78, 91, 80]);
    expect(o[0].note).toBe('Passes 2 reported hazards');
    expect(o[1].note).toBe('No reported hazards on this route · +7 min');
    expect(o[2].note).toBe('Passes 1 reported hazard · +25 min');
    expect(o.map((x) => x.recommended)).toEqual([false, true, false]);
    expect(hazardNote(0)).toMatch(/No reported/);
  });
  it('a single option is "Your route" and never recommended; repeated alternatives are numbered', () => {
    expect(buildOptions([alt('a', 60, 40, 1, 0, 'Alternative')])).toMatchObject([{ title: 'Your route', recommended: false }]);
    expect(buildOptions([alt('a', 60, 40, 1, 0, 'Alternative'), alt('b', 60, 40, 1, 0, 'Alternative')]).map((x) => x.title)).toEqual(['Alternative 1', 'Alternative 2']);
  });
  it('alternativesOf falls back to the top-level route for an older server, and caps at three', () => {
    const base = { route_id: 'r', path_points: [[1, 2], [3, 4]], distance_km: 5, eta_minutes: 6, safety_score: 0.5, recalculated_at_hlc: 'x' };
    expect(alternativesOf(base)).toEqual([expect.objectContaining({ route_id: 'r', distance_km: 5, hazard_count: 0 })]);
    const four = [1, 2, 3, 4].map((i) => alt(String(i), i, i, 1, 0, 'Alternative'));
    expect(alternativesOf({ ...base, alternatives: four })).toHaveLength(3);
  });
  it('duration style is the demo\'s', () => {
    expect(durationLabel(125)).toBe('2h 05');
    expect(durationLabel(58.4)).toBe('58 min');
  });
  it('routeResponseFromJson parses `alternatives` additively and tolerates old servers', () => {
    const json = { route_id: 'r', path_points: [[1, 2], [3, 4]], distance_km: '5', eta_minutes: 6, safety_score: 0.5, recalculated_at_hlc: 'x' };
    expect(routeResponseFromJson(json).alternatives).toBeUndefined();
    const r = routeResponseFromJson({ ...json, alternatives: [{ route_id: 'a', path_points: [[1, 2]], distance_km: '5', eta_minutes: 6, safety_score: 0.9, hazard_count: '2', label: 'Safest' }, { route_id: 'b', path_points: [[1, 2]], distance_km: 1, eta_minutes: 1, safety_score: 1, label: 'Scenic' }, { nope: true }] });
    expect(r.alternatives).toEqual([
      { route_id: 'a', path_points: [[1, 2]], distance_km: 5, eta_minutes: 6, safety_score: 0.9, hazard_count: 2, label: 'Safest' },
      { route_id: 'b', path_points: [[1, 2]], distance_km: 1, eta_minutes: 1, safety_score: 1, hazard_count: 0, label: 'Alternative' },
    ]);
    expect(r.distance_km).toBe(5); // existing fields unchanged
  });
});

describe('routeGeo', () => {
  const path = [{ lat: 19.0, lng: 72.8 }, { lat: 19.0, lng: 72.9 }, { lat: 19.0, lng: 73.0 }];
  it('distance to the path is measured to the segment, not just the vertices', () => {
    expect(distanceToPathM({ lat: 19.0, lng: 72.85 }, path)).toBeLessThan(1);
    const off = distanceToPathM({ lat: 19.001, lng: 72.85 }, path); // ~111 m north of the line
    expect(off).toBeGreaterThan(105);
    expect(off).toBeLessThan(118);
    expect(distanceToPathM({ lat: 19, lng: 72.85 }, [])).toBe(Infinity);
  });
  it('hazardsNearPath keeps clusters on the route', () => {
    const near = { centroid_lat: 19.0005, centroid_lng: 72.85 };
    const far = { centroid_lat: 19.1, centroid_lng: 72.85 };
    expect(hazardsNearPath(path, [near, far])).toEqual([near]);
    expect(hazardsNearPath([], [near])).toEqual([]);
  });
  it('midpoint is halfway by distance and length adds up', () => {
    const m = pathMidpoint(path)!;
    expect(m.lng).toBeCloseTo(72.9, 3);
    expect(pathLengthM(path)).toBeGreaterThan(20_000);
    expect(pathMidpoint([])).toBeNull();
    expect(pathMidpoint([path[0]])).toEqual(path[0]);
  });
  it('distance along the route', () => {
    const total = pathLengthM(path) / 1000;
    expect(distanceAlongPathKm(path, { lat: 19.0, lng: 72.9 })).toBeCloseTo(total / 2, 1);
    expect(distanceAlongPathKm([path[0]], path[1])).toBeNull();
  });
  it('flatten keeps first/last, caps the size and round-trips', () => {
    const long = Array.from({ length: 1000 }, (_, i) => ({ lat: 19 + i * 0.001, lng: 72 + i * 0.001 }));
    const flat = flattenPath(long, 150);
    expect(flat).toHaveLength(300);
    expect(flat.slice(0, 2)).toEqual([19, 72]);
    expect(flat.slice(-2)).toEqual([19.999, 72.999]);
    expect(unflattenPath(flat)).toHaveLength(150);
    expect(flattenPath([], 10)).toEqual([]);
    expect(flattenPath(path, 150)).toHaveLength(6);
    expect(unflattenPath('x')).toEqual([]);
    expect(pairsToPoints([[1, 2], [3]])).toEqual([{ lat: 1, lng: 2 }]);
  });
});

describe('intel', () => {
  const cluster = (id: string, type: any, n: number, lat = 19, lng = 72.85, hlc = '1700000000000:0'): HazardCluster => ({
    cluster_id: id, group_id: 'g', hazard_type: type, centroid_lat: lat, centroid_lng: lng, polygon_points: [], report_count: n, hazard_score: 1, created_at_hlc: hlc, status: 'active',
  });
  const path = [{ lat: 19.0, lng: 72.8 }, { lat: 19.0, lng: 72.9 }];
  it('summary counts real clusters and falls back honestly', () => {
    expect(intelSummary([], null)).toMatchObject({ title: 'No hazards reported on your route' });
    expect(intelSummary([], 0.91).body).toBe('Route safety score 91.');
    expect(intelSummary([cluster('a', 'pothole', 3)], null)).toEqual({ title: '1 hazard on your route', body: 'Pothole (3 reports).' });
    const s = intelSummary([cluster('a', 'pothole', 3), cluster('b', 'oil_spill', 1), cluster('c', 'debris', 2)], null);
    expect(s.title).toBe('3 hazards on your route');
    expect(s.body).toBe('Pothole (3 reports), Oil on the road (1 report) and 1 more.');
  });
  it('rail items: nearest first, km along the route only when there is one, safety last', () => {
    const items = intelItems([cluster('b', 'oil_spill', 1, 19, 72.88), cluster('a', 'pothole', 3, 19, 72.82)], path, 1700000000000 + 40 * 60_000, 0.91);
    expect(items.map((i) => i.key)).toEqual(['a', 'b', 'safety']);
    expect(items[0]).toMatchObject({ tone: 'pri', title: expect.stringMatching(/^Pothole · km \d+$/), sub: '3 reports · first reported 40 min ago' });
    expect(items[1].tone).toBe('bad');
    expect(items[2]).toMatchObject({ tone: 'ok', title: 'Route safety score 91' });
    const noPath = intelItems([cluster('a', 'pothole', 2)], [], 1, null);
    expect(noPath).toEqual([expect.objectContaining({ title: 'Pothole', sub: expect.stringContaining('2 reports') })]);
  });
  it('hlc and labels', () => {
    expect(hlcMs('1700000000000:3')).toBe(1700000000000);
    expect(hlcMs('1700000000000-3')).toBe(1700000000000);
    expect(hlcMs('abc')).toBeNull();
    expect(hlcMs('5:0')).toBeNull();
    expect(hazardLabel('oil_spill')).toBe('Oil on the road');
    expect(hazardLabel('mystery')).toBe('Hazard');
  });
});

describe('pulse', () => {
  it('newest first, never the rider themself, real names, limited', () => {
    const items = buildPulse(
      {
        rsvp: [{ uid: 'me', status: 'going', updated_ms: 50 }, { uid: 'u1', status: 'going', updated_ms: 10 }, { uid: 'u2', status: 'no', updated_ms: 30 }],
        rollCall: [{ uid: 'u1', state: 'ready', updated_ms: 40 }],
        presence: [{ uid: 'u3', state: 'fuel', updated_ms: 20 }, { uid: 'u3', state: 'riding', updated_ms: 0 }],
      },
      (u) => ({ u1: 'Meera', u2: 'Dev', u3: 'Kabir' } as Record<string, string>)[u] ?? u,
      'me',
    );
    expect(items.map((i) => i.text)).toEqual(['Meera is ready', 'Dev can’t make it', 'Kabir is fuelling up', 'Meera confirmed']);
    expect(buildPulse({ rsvp: [], rollCall: [], presence: [] }, (u) => u, 'me')).toEqual([]);
    expect(buildPulse({ rsvp: [1, 2, 3, 4, 5, 6].map((i) => ({ uid: `u${i}`, status: 'going' as const, updated_ms: i })), rollCall: [], presence: [] }, (u) => u, null, 3)).toHaveLength(3);
  });
});

describe('popularPlaces', () => {
  const crews = [{ id: 'c1', name: 'Ghat Ghosts', member_ids: ['me'], roles: {}, created_by: 'me', join_code: 'AAAAAA', created_ms: 1 }] as Crew[];
  const r = (over: Partial<Ride>): Ride => ({
    id: 'x', name: 'n', created_by: 'me', member_ids: ['me'], crew_id: 'c1', join_code: null, ride_type: null, pace: null, start_time_ms: 1, status: 'planned', started_ms: null, finished_ms: null, meetup: null, invited_ids: [], created_ms: null,
    ride_plan: { start: null, stops: [], destination: { label: 'Lonavala, India', lat: 18.75, lng: 73.4 } }, ...over,
  });
  it('only rides in the rider\'s crews, grouped by destination, most-ridden first', () => {
    const out = popularPlaces(
      [r({ id: '1' }), r({ id: '2' }), r({ id: '3', ride_plan: { start: null, stops: [], destination: { label: 'Karjat', lat: 18.9, lng: 73.3 } } }), r({ id: '4', crew_id: 'zzz' }), r({ id: '5', crew_id: null })],
      crews,
      { lat: 19, lng: 72.8 },
    );
    expect(out.map((p) => [p.short, p.rides, p.crewName])).toEqual([['Lonavala', 2, 'Ghat Ghosts'], ['Karjat', 1, 'Ghat Ghosts']]);
    expect(out[0].kmFromStart).toBeGreaterThan(50);
    expect(popularPlaces([r({})], crews, null)[0].kmFromStart).toBeNull();
    expect(popularPlaces([], crews, null)).toEqual([]);
  });
});

describe('planDraftStore', () => {
  const alt = (id: string) => ({ route_id: id, path_points: [[1, 2], [3, 4]], distance_km: 1, eta_minutes: 1, safety_score: 1, hazard_count: 0, label: 'Alternative' as const });
  beforeEach(() => usePlanDraftStore.getState().reset());
  it('starts like the demo: tomorrow, 6:30, Steady', () => {
    const s = usePlanDraftStore.getState();
    expect(s).toMatchObject({ dayOffset: 1, timeMin: 390, pace: 'Steady', crewId: null, invitees: [], stops: [], options: [], route: null });
  });
  it('choosing an option sets the route; changing the destination clears routes and stops', () => {
    const st = usePlanDraftStore.getState();
    st.setOptions([alt('a'), alt('b')], 0);
    st.chooseOption(1);
    expect(usePlanDraftStore.getState()).toMatchObject({ chosenOption: 1, route: { route_id: 'b' } });
    usePlanDraftStore.getState().setStopFlag('fuel', true, { id: PLAN_STOP_ID.fuel, label: 'Shell', lat: 1, lng: 2, icon: '⛽' });
    expect(usePlanDraftStore.getState()).toMatchObject({ fuel: true, stops: [{ id: 'plan-fuel' }] });
    usePlanDraftStore.getState().setDestination({ label: 'X', lat: 1, lng: 1 });
    expect(usePlanDraftStore.getState()).toMatchObject({ options: [], route: null, fuel: false, stops: [] });
  });
  it('the time stepper clamps at 5:00 and 10:00', () => {
    const st = usePlanDraftStore.getState();
    for (let i = 0; i < 30; i++) st.stepTime(-15);
    expect(usePlanDraftStore.getState().timeMin).toBe(300);
    for (let i = 0; i < 40; i++) usePlanDraftStore.getState().stepTime(15);
    expect(usePlanDraftStore.getState().timeMin).toBe(600);
  });
  it('invitees toggle; setCrew marks the choice; both stop kinds coexist and clear independently', () => {
    const st = usePlanDraftStore.getState();
    st.setCrew('c1', ['u1', 'u2']);
    st.toggleInvitee('u1');
    expect(usePlanDraftStore.getState()).toMatchObject({ crewId: 'c1', crewTouched: true, invitees: ['u2'] });
    usePlanDraftStore.getState().toggleInvitee('u1');
    expect(usePlanDraftStore.getState().invitees).toEqual(['u2', 'u1']);
    usePlanDraftStore.getState().setCrew('c2', [], false);
    expect(usePlanDraftStore.getState().crewTouched).toBe(false);
    usePlanDraftStore.getState().setStopFlag('fuel', true, { id: 'plan-fuel', label: 'a', lat: 1, lng: 1, icon: '' });
    usePlanDraftStore.getState().setStopFlag('chai', true, { id: 'plan-chai', label: 'b', lat: 1, lng: 1, icon: '' });
    usePlanDraftStore.getState().setStopFlag('fuel', false);
    expect(usePlanDraftStore.getState().stops.map((s) => s.id)).toEqual(['plan-chai']);
  });
  it('prefill starts a fresh plan pointing at a destination', () => {
    usePlanDraftStore.getState().setPace('Spirited');
    usePlanDraftStore.getState().prefill({ label: 'Karjat', lat: 1, lng: 2 });
    expect(usePlanDraftStore.getState()).toMatchObject({ ...INITIAL_DRAFT, destination: { label: 'Karjat', lat: 1, lng: 2 } });
  });
});

describe('geocode additions', () => {
  const mockFetch = jest.fn();
  beforeEach(() => { mockFetch.mockReset(); (globalThis as any).fetch = mockFetch; });
  it('knows whether a token is configured', () => {
    expect(geocodingAvailable('pk.x')).toBe(true);
    expect(geocodingAvailable('')).toBe(false);
    expect(geocodingAvailable(undefined)).toBe(false);
  });
  it('proximity biases results to a point (lng,lat order)', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ features: [] }) });
    await geocodeSearchStrict('fuel station', 5, { proximity: { lat: 18.9, lng: 73.1 } });
    expect(mockFetch.mock.calls[0][0]).toContain('proximity=73.1,18.9');
    await geocodeSearchStrict('fuel station');
    expect(mockFetch.mock.calls[1][0]).not.toContain('proximity');
  });
  it('reverseGeocode returns a short place name, or null on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ features: [{ text: 'Bandra West', place_name: 'Bandra West, Mumbai' }] }) });
    await expect(reverseGeocode(19.05, 72.83, 'pk.t')).resolves.toBe('Bandra West');
    expect(mockFetch.mock.calls[0][0]).toContain('/72.83,19.05.json');
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ features: [] }) });
    await expect(reverseGeocode(1, 2, 'pk.t')).resolves.toBeNull();
    mockFetch.mockRejectedValueOnce(new Error('offline'));
    await expect(reverseGeocode(1, 2, 'pk.t')).resolves.toBeNull();
    await expect(reverseGeocode(1, 2, '')).resolves.toBeNull(); // no token: no request
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(reverseGeocode(1, 2, 'pk.t')).resolves.toBeNull();
  });
});

describe('joinCode', () => {
  it('six characters from the code alphabet, deterministic with a seeded random', () => {
    expect(generateJoinCode()).toMatch(new RegExp(`^[${JOIN_CODE_ALPHABET}]{6}$`));
    expect(generateJoinCode(() => 0)).toBe('AAAAAA');
    expect(JOIN_CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });
});

describe('RoutingClient + alternatives', () => {
  it('requestRoute returns the parsed `alternatives` next to the unchanged top-level route', async () => {
    const body = {
      route_id: 'a', path_points: [[1, 2], [3, 4]], distance_km: 5, eta_minutes: 6, safety_score: 0.5, recalculated_at_hlc: '1:0',
      alternatives: [{ route_id: 'a', path_points: [[1, 2], [3, 4]], distance_km: 5, eta_minutes: 6, safety_score: 0.5, hazard_count: 1, label: 'Fastest' }],
    };
    const f = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body });
    (globalThis as any).fetch = f;
    const r = await new RoutingClient({ baseUrl: 'http://x' }).requestRoute({ group_id: 'g', origin: { lat: 1, lng: 2 }, destination: { lat: 3, lng: 4 } });
    expect(f.mock.calls[0][0]).toBe('http://x/route');
    expect(r.route_id).toBe('a');
    expect(r.alternatives).toEqual([expect.objectContaining({ route_id: 'a', hazard_count: 1, label: 'Fastest' })]);
  });
});
