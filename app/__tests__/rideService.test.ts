import type { Ride } from '../src/models/domain';

// ── a tiny Firestore: records writes, lets a test push snapshots ──
const mockCalls: { op: string; path: string; data?: any }[] = [];
const mockListeners: { path: string; where?: any[]; next: (snap: any) => void; error: (e: unknown) => void }[] = [];
let mockCodeTaken: string[] = [];
let mockUid: string | null = 'me';

function mockDoc(path: string) {
  return {
    path,
    // join_codes/{CODE}: "exists" when the test marked the code as taken
    get: jest.fn(async () => ({ exists: path.startsWith('join_codes/') && mockCodeTaken.includes(path.split('/')[1]), data: () => undefined })),
    set: jest.fn(async (data: any) => { mockCalls.push({ op: 'set', path, data }); }),
    update: jest.fn(async (data: any) => { mockCalls.push({ op: 'update', path, data }); }),
    onSnapshot: jest.fn((next: any, error: any) => { mockListeners.push({ path, next, error }); return jest.fn(); }),
  };
}
function mockCollection(path: string, wheres: any[] = []) {
  const q: any = {
    where: (f: string, op: string, v: unknown) => mockCollection(path, [...wheres, [f, op, v]]),
    limit: () => q,
    get: jest.fn(async () => ({ empty: !wheres.some((w) => w[0] === 'join_code' && mockCodeTaken.includes(w[2])) })),
    onSnapshot: jest.fn((next: any, error: any) => { mockListeners.push({ path, where: wheres, next, error }); return jest.fn(); }),
  };
  return q;
}
// The code generator is deterministic here (production uses the platform CSPRNG, see src/utils/joinCode.ts).
const mockCodes: string[] = [];
jest.mock('../src/utils/joinCode', () => {
  const actual = jest.requireActual('../src/utils/joinCode');
  return { ...actual, generateJoinCode: (r?: () => number) => (r ? actual.generateJoinCode(r) : mockCodes.shift() ?? actual.generateJoinCode(() => Math.random())) };
});

jest.mock('@react-native-firebase/firestore', () => {
  const mockBatch = () => {
    const ops: { path: string; data: any }[] = [];
    return {
      set: (ref: { path: string }, data: any) => { ops.push({ path: ref.path, data }); },
      commit: jest.fn(async () => { ops.forEach((o) => mockCalls.push({ op: 'set', path: o.path, data: o.data })); mockCalls.push({ op: 'commit', path: `${ops.length} writes` }); }),
    };
  };
  const firestore: any = jest.fn(() => ({ doc: (p: string) => mockDoc(p), collection: (p: string) => mockCollection(p), batch: mockBatch }));
  firestore.FieldValue = { serverTimestamp: () => 'SERVER_TS' };
  return { __esModule: true, default: firestore };
});
jest.mock('@react-native-firebase/auth', () => ({ __esModule: true, default: jest.fn(() => ({ get currentUser() { return mockUid ? { uid: mockUid } : null; } })) }));

import {
  createRide, presenceFromDoc, rideFromDoc, rollCallFromDoc, routeStatsOf, rsvpFromDoc, setPresence, setRideStatus, setRollCall,
  setRsvp, sortRides, subscribeMyRides, subscribePresence, subscribeRide, subscribeRollCall, subscribeRsvp, toMs,
} from '../src/services/rideService';

beforeEach(() => {
  mockCalls.length = 0;
  mockListeners.length = 0;
  mockCodeTaken = [];
  mockCodes.length = 0;
  mockUid = 'me';
});

describe('rideFromDoc', () => {
  it('maps a full document', () => {
    const r = rideFromDoc('g1', {
      name: ' Lonavala Run ', created_by: 'me', member_ids: ['me', 'u2', 7], crew_id: 'c1', join_code: 'K7M2QX', ride_type: 'Casual', pace: 'Spirited',
      start_time_ms: 1_800_000_000_000, status: 'meetup', started_ms: 5, finished_ms: 9,
      meetup: { label: 'Bandra Fort', lat: 19, lng: 72.8 }, invited_ids: ['u2'], created_at: { toMillis: () => 123 },
      ride_plan: {
        start: { label: 'Bandra Fort', lat: 19, lng: 72.8 }, destination: { label: 'Lonavala', lat: 18.75, lng: 73.4 },
        stops: [{ id: 's1', label: 'Fuel', lat: 18.9, lng: 73, icon: '⛽' }, { label: 'bad' }],
        route: { distance_km: 84.2, eta_minutes: 125, safety_score: 0.91, path: [19, 72.8, 18.75, 73.4] },
      },
    });
    expect(r).toMatchObject({
      id: 'g1', name: 'Lonavala Run', created_by: 'me', member_ids: ['me', 'u2'], crew_id: 'c1', join_code: 'K7M2QX', ride_type: 'Casual', pace: 'Spirited',
      start_time_ms: 1_800_000_000_000, status: 'meetup', started_ms: 5, finished_ms: 9, invited_ids: ['u2'], created_ms: 123,
      meetup: { label: 'Bandra Fort', lat: 19, lng: 72.8 },
    });
    expect(r.ride_plan?.stops).toEqual([{ id: 's1', label: 'Fuel', lat: 18.9, lng: 73, icon: '⛽' }]);
    expect(routeStatsOf(r)).toEqual({ distance_km: 84.2, eta_minutes: 125, safety_score: 0.91, path: [{ lat: 19, lng: 72.8 }, { lat: 18.75, lng: 73.4 }] });
  });

  it('a legacy group (no status, crew, pace…) loads as a planned ride', () => {
    const legacy = rideFromDoc('old', {
      name: 'Ride to Pune', created_by: 'u1', member_ids: ['u1'], active_ride_id: null, join_code: 'ABCDEF',
      created_at: { seconds: 1_700_000_000 },
      ride_plan: { start: null, destination: { label: 'Pune', lat: 18.5, lng: 73.8 }, stops: [] },
    });
    expect(legacy).toMatchObject({
      status: 'planned', crew_id: null, pace: null, ride_type: null, start_time_ms: null, started_ms: null, finished_ms: null, meetup: null, invited_ids: [], created_ms: 1_700_000_000_000,
    });
    expect(legacy.ride_plan?.destination?.label).toBe('Pune');
    expect(routeStatsOf(legacy)).toBeNull();
  });

  it('never throws on junk', () => {
    expect(rideFromDoc('x', undefined)).toMatchObject({ id: 'x', name: 'Ride', status: 'planned', member_ids: [], ride_plan: null });
    const r = rideFromDoc('x', { status: 'exploded', pace: 'Reckless', start_time_ms: 'soon', meetup: { lat: 'a', lng: 1 }, member_ids: 'me', ride_plan: 'plan', created_at: 'garbage' });
    expect(r).toMatchObject({ status: 'planned', pace: null, start_time_ms: null, meetup: null, member_ids: [], ride_plan: null, created_ms: null });
  });

  it('toMs understands timestamps, numbers and dates', () => {
    expect(toMs({ toMillis: () => 5 })).toBe(5);
    expect(toMs({ seconds: 2 })).toBe(2000);
    expect(toMs(7)).toBe(7);
    expect(toMs(new Date(9))).toBe(9);
    expect(toMs(null)).toBeNull();
    expect(toMs('nope')).toBeNull();
  });
});

describe('subdocument converters', () => {
  it('keep only valid states', () => {
    expect(rsvpFromDoc('u', { status: 'going', updated_ms: 4 })).toEqual({ uid: 'u', status: 'going', updated_ms: 4 });
    expect(rsvpFromDoc('u', { status: 'definitely' })).toBeNull();
    expect(rollCallFromDoc('u', { state: 'ready' })).toEqual({ uid: 'u', state: 'ready', updated_ms: 0 });
    expect(rollCallFromDoc('u', { state: 1 })).toBeNull();
    expect(presenceFromDoc('u', { state: 'fuel', updated_ms: 3 })).toEqual({ uid: 'u', state: 'fuel', updated_ms: 3 });
    expect(presenceFromDoc('u', undefined)).toBeNull();
  });
});

describe('sortRides', () => {
  it('newest activity first (start time, else created)', () => {
    const mk = (id: string, start: number | null, created: number | null) => ({ ...rideFromDoc(id, {}), start_time_ms: start, created_ms: created } as Ride);
    expect(sortRides([mk('a', 1, null), mk('b', null, 5), mk('c', 3, 9)]).map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('writes', () => {
  it('createRide writes a planned ride with the creator and the invitees as members', async () => {
    const id = await createRide({
      name: 'Lonavala Run', crewId: 'c1', start: { label: 'Bandra', lat: 19, lng: 72.8 }, destination: { label: 'Lonavala', lat: 18.75, lng: 73.4 },
      stops: [{ id: 'plan-fuel', label: 'Shell', lat: 18.9, lng: 73, icon: '⛽' }], startTimeMs: 1_800_000_000_000, pace: 'Steady', invitedIds: ['u2', 'me', 'u2', 'u3'],
      route: { distanceKm: 84, etaMinutes: 125, safetyScore: 0.9, path: [{ lat: 19, lng: 72.8 }, { lat: 18.75, lng: 73.4 }] },
    });
    expect(typeof id).toBe('string');
    const w = mockCalls.find((c) => c.op === 'set' && c.path.startsWith('groups/'))!;
    expect(w.path).toBe(`groups/${id}`);
    expect(w.data).toMatchObject({
      name: 'Lonavala Run', created_by: 'me', member_ids: ['me', 'u2', 'u3'], invited_ids: ['u2', 'u3'], crew_id: 'c1', pace: 'Steady', status: 'planned',
      start_time_ms: 1_800_000_000_000, created_at: 'SERVER_TS', active_ride_id: null,
      meetup: { label: 'Bandra', lat: 19, lng: 72.8 },
      ride_plan: {
        start: { label: 'Bandra', lat: 19, lng: 72.8 }, destination: { label: 'Lonavala', lat: 18.75, lng: 73.4 },
        stops: [{ id: 'plan-fuel', label: 'Shell', lat: 18.9, lng: 73, icon: '⛽' }],
        route: { distance_km: 84, eta_minutes: 125, safety_score: 0.9, path: [19, 72.8, 18.75, 73.4] },
      },
    });
    expect(w.data.join_code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    // the ride and its join_codes/{CODE} doc go out in ONE batch (the rules verify the target in the same batch)
    expect(mockCalls.filter((c) => c.op === 'commit')).toHaveLength(1);
    expect(mockCalls.find((c) => c.path === `join_codes/${w.data.join_code}`)).toMatchObject({ op: 'set', data: { kind: 'ride', target_id: id } });
    // Firestore rejects undefined: optional fields that are unset are simply absent
    expect('ride_type' in w.data).toBe(false);
  });

  it('createRide for a solo ride omits crew_id and still lists only the creator', async () => {
    await createRide({ name: 'Solo Run', crewId: null, start: null, destination: { label: 'X', lat: 1, lng: 2 }, stops: [], startTimeMs: 5 });
    const d = mockCalls.find((c) => c.op === 'set' && c.path.startsWith('groups/'))!.data;
    expect(d.member_ids).toEqual(['me']);
    expect('crew_id' in d).toBe(false);
    expect('meetup' in d).toBe(false);
    expect(d.ride_plan.start).toBeNull();
    expect('route' in d.ride_plan).toBe(false);
  });

  it('createRide needs a signed-in rider', async () => {
    mockUid = null;
    await expect(createRide({ name: 'x', crewId: null, start: null, destination: { label: 'X', lat: 1, lng: 2 }, stops: [], startTimeMs: 5 })).rejects.toThrow(/sign in/i);
    expect(mockCalls).toHaveLength(0);
  });

  it('createRide never reuses a join code that is already taken (checked in join_codes, never by querying rides)', async () => {
    mockCodes.push('AAAAAA', 'BBBBBB');
    mockCodeTaken = ['AAAAAA'];
    const id = await createRide({ name: 'x', crewId: null, start: null, destination: { label: 'X', lat: 1, lng: 2 }, stops: [], startTimeMs: 5 });
    expect(mockCalls.find((c) => c.path === `groups/${id}`)!.data.join_code).toBe('BBBBBB');
    expect(mockCalls.some((c) => c.path === 'join_codes/AAAAAA')).toBe(false);
    expect(mockListeners).toHaveLength(0);
  });

  it('createRide gives up with a clear error when every code it tries is taken, writing nothing', async () => {
    mockCodes.push(...Array(10).fill('AAAAAA'));
    mockCodeTaken = ['AAAAAA'];
    await expect(createRide({ name: 'x', crewId: null, start: null, destination: { label: 'X', lat: 1, lng: 2 }, stops: [], startTimeMs: 5 })).rejects.toThrow(/join code/i);
    expect(mockCalls).toHaveLength(0);
  });

  it('createRide keeps the name and place labels inside the limits the Firestore rules enforce', async () => {
    const id = await createRide({ name: 'N'.repeat(200), crewId: null, start: { label: 'S'.repeat(300), lat: 1, lng: 2 }, destination: { label: 'D'.repeat(300), lat: 1, lng: 2 }, stops: [], startTimeMs: 5 });
    const d = mockCalls.find((c) => c.path === `groups/${id}`)!.data;
    expect(d.name).toHaveLength(60);
    expect(d.ride_plan.start.label).toHaveLength(120);
    expect(d.ride_plan.destination.label).toHaveLength(120);
    expect(d.meetup.label).toHaveLength(120);
  });

  it('setRideStatus stamps started_ms / finished_ms only where they apply', async () => {
    const spy = jest.spyOn(Date, 'now').mockReturnValue(777);
    await setRideStatus('g1', 'meetup');
    await setRideStatus('g1', 'live');
    await setRideStatus('g1', 'finished');
    spy.mockRestore();
    expect(mockCalls.map((c) => [c.op, c.path, c.data])).toEqual([
      ['update', 'groups/g1', { status: 'meetup' }],
      ['update', 'groups/g1', { status: 'live', started_ms: 777 }],
      ['update', 'groups/g1', { status: 'finished', finished_ms: 777 }],
    ]);
  });

  it('rsvp / roll call / presence write the rider\'s own doc', async () => {
    const spy = jest.spyOn(Date, 'now').mockReturnValue(42);
    await setRsvp('g1', 'me', 'going');
    await setRollCall('g1', 'me', 'ready');
    await setPresence('g1', 'me', 'fuel');
    spy.mockRestore();
    expect(mockCalls.map((c) => [c.path, c.data])).toEqual([
      ['groups/g1/rsvp/me', { status: 'going', updated_ms: 42 }],
      ['groups/g1/roll_call/me', { state: 'ready', updated_ms: 42 }],
      ['groups/g1/presence/me', { state: 'fuel', updated_ms: 42 }],
    ]);
  });
});

describe('subscriptions', () => {
  const snap = (docs: { id: string; data: any }[]) => ({ docs: docs.map((d) => ({ id: d.id, data: () => d.data })) });

  it('subscribeMyRides queries member_ids array-contains uid and delivers converted, sorted rides', () => {
    const got: Ride[][] = [];
    const errs: unknown[] = [];
    const stop = subscribeMyRides('me', (r) => got.push(r), (e) => errs.push(e));
    expect(typeof stop).toBe('function');
    const l = mockListeners[0];
    expect(l.path).toBe('groups');
    expect(l.where).toEqual([['member_ids', 'array-contains', 'me']]);
    l.next(snap([{ id: 'a', data: { name: 'A', start_time_ms: 1 } }, { id: 'b', data: { name: 'B', start_time_ms: 9, status: 'live' } }]));
    expect(got[0].map((r) => [r.id, r.status])).toEqual([['b', 'live'], ['a', 'planned']]);
    l.error(new Error('permission-denied'));
    expect(errs).toHaveLength(1);
  });

  it('subscribeRide delivers null for a missing ride', () => {
    const got: (Ride | null)[] = [];
    subscribeRide('g1', (r) => got.push(r));
    const l = mockListeners[0];
    expect(l.path).toBe('groups/g1');
    l.next({ exists: false });
    l.next({ exists: true, id: 'g1', data: () => ({ name: 'Hi' }) });
    expect(got[0]).toBeNull();
    expect(got[1]?.name).toBe('Hi');
  });

  it('rsvp / roll call / presence subscriptions drop invalid docs', () => {
    const rsvp: any[] = [];
    const roll: any[] = [];
    const pres: any[] = [];
    subscribeRsvp('g1', (d) => rsvp.push(d));
    subscribeRollCall('g1', (d) => roll.push(d));
    subscribePresence('g1', (d) => pres.push(d));
    expect(mockListeners.map((l) => l.path)).toEqual(['groups/g1/rsvp', 'groups/g1/roll_call', 'groups/g1/presence']);
    mockListeners[0].next(snap([{ id: 'u1', data: { status: 'going', updated_ms: 1 } }, { id: 'u2', data: { status: '??' } }]));
    mockListeners[1].next(snap([{ id: 'u1', data: { state: 'ready', updated_ms: 2 } }]));
    mockListeners[2].next(snap([{ id: 'u1', data: { state: 'arrived', updated_ms: 3 } }]));
    expect(rsvp[0]).toEqual([{ uid: 'u1', status: 'going', updated_ms: 1 }]);
    expect(roll[0]).toEqual([{ uid: 'u1', state: 'ready', updated_ms: 2 }]);
    expect(pres[0]).toEqual([{ uid: 'u1', state: 'arrived', updated_ms: 3 }]);
  });
});
