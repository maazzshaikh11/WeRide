/** crewService against a fake Firestore: create / join / leave / subscribe, the code rules and error mapping. */
const mockDb = {
  crews: new Map<string, any>(),
  groups: new Map<string, any>(),
  updates: [] as { path: string; data: any }[],
  sets: [] as { path: string; data: any }[],
  failWith: null as null | { code?: string; message?: string },
  snapshotHandler: null as null | { ok: (s: any) => void; err: (e: any) => void },
  lastWhere: [] as any[],
  autoId: 0,
};

jest.mock('@react-native-firebase/firestore', () => {
  const snapOf = (entries: [string, any][]) => ({
    empty: entries.length === 0,
    docs: entries.map(([id, data]) => ({ id, data: () => data })),
  });
  const coll = (name: 'crews' | 'groups') => {
    let filter: ((d: any) => boolean) | null = null;
    const api: any = {
      where: (field: string, op: string, value: any) => {
        mockDb.lastWhere.push([name, field, op, value]);
        filter = (d) => (op === '==' ? d[field] === value : op === 'array-contains' ? Array.isArray(d[field]) && d[field].includes(value) : true);
        return api;
      },
      limit: () => api,
      get: async () => {
        if (mockDb.failWith) throw mockDb.failWith;
        const all = [...mockDb[name].entries()].filter(([, d]) => !filter || filter(d));
        return snapOf(all as [string, any][]);
      },
      onSnapshot: (ok: any, err: any) => {
        mockDb.snapshotHandler = { ok, err };
        return jest.fn();
      },
      doc: () => {
        const id = `auto${++mockDb.autoId}`;
        return { id, set: async (data: any) => { if (mockDb.failWith) throw mockDb.failWith; mockDb.sets.push({ path: `${name}/${id}`, data }); mockDb[name].set(id, data); } };
      },
    };
    return api;
  };
  const firestore: any = jest.fn(() => ({
    collection: (n: any) => coll(n),
    doc: (path: string) => {
      const [c, id] = path.split('/') as ['crews' | 'groups', string];
      return {
        get: async () => ({ exists: mockDb[c].has(id), data: () => mockDb[c].get(id) }),
        update: async (data: any) => {
          if (mockDb.failWith) throw mockDb.failWith;
          mockDb.updates.push({ path, data });
        },
      };
    },
  }));
  firestore.FieldValue = {
    serverTimestamp: () => 'SERVER_TS',
    arrayUnion: (...a: any[]) => ({ union: a }),
    arrayRemove: (...a: any[]) => ({ remove: a }),
    delete: () => 'DELETE',
  };
  return { __esModule: true, default: firestore };
});

let mockUid: string | null = 'me';
jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: () => ({ currentUser: mockUid ? { uid: mockUid } : null }),
}));

import {
  CrewError, createCrew, crewFromDoc, findRideByCode, generateCrewCode, getCrew, getCrewNextRide, isCrewCode, joinCrewByCode, leaveCrew, sortCrews, subscribeMyCrews,
} from '../src/services/crewService';

beforeEach(() => {
  mockDb.crews.clear();
  mockDb.groups.clear();
  mockDb.updates.length = 0;
  mockDb.sets.length = 0;
  mockDb.lastWhere.length = 0;
  mockDb.failWith = null;
  mockDb.snapshotHandler = null;
  mockUid = 'me';
});

describe('codes', () => {
  it('isCrewCode: six characters from the ride-code alphabet, any case', () => {
    expect(isCrewCode('K7M2QX')).toBe(true);
    expect(isCrewCode(' k7m2qx ')).toBe(true);
    expect(isCrewCode('K7M2Q')).toBe(false);
    expect(isCrewCode('K7M2QXX')).toBe(false);
    expect(isCrewCode('K0M2QX')).toBe(false); // no zero
    expect(isCrewCode('KIM2QX')).toBe(false); // no I
    expect(isCrewCode('KLM2QX')).toBe(false); // no L
    expect(isCrewCode('K1M2QX')).toBe(false); // no one
    expect(isCrewCode('KOM2QX')).toBe(false); // no O
  });
  it('generateCrewCode always satisfies isCrewCode', () => {
    for (let i = 0; i < 200; i++) expect(isCrewCode(generateCrewCode())).toBe(true);
  });
});

describe('crewFromDoc', () => {
  it('reads a full doc (timestamp -> ms, codes upper-cased, only valid roles)', () => {
    const c = crewFromDoc('c1', { name: ' Ghat Ghosts ', created_by: 'me', member_ids: ['me', 'a', 'a'], roles: { me: 'lead', a: 'sweep', b: 'boss' }, join_code: 'k7m2qx', created_at: { toMillis: () => 1000 } });
    expect(c).toEqual({ id: 'c1', name: 'Ghat Ghosts', created_by: 'me', member_ids: ['me', 'a'], roles: { me: 'lead', a: 'sweep' }, join_code: 'K7M2QX', created_ms: 1000 });
  });
  it('is tolerant of a bare or odd doc and never invents riders', () => {
    expect(crewFromDoc('c', undefined)).toEqual({ id: 'c', name: 'Crew', created_by: '', member_ids: [], roles: {}, join_code: '', created_ms: null });
    expect(crewFromDoc('c', { name: 4, member_ids: 'x', roles: 'y', created_at: 'soon' }).member_ids).toEqual([]);
    expect(crewFromDoc('c', { created_at: { seconds: 5 } }).created_ms).toBe(5000);
  });
});

describe('createCrew', () => {
  it('writes the crew with the creator as member and lead, plus a fresh code', async () => {
    const crew = await createCrew('  Tuesday   Throttle ');
    expect(crew.name).toBe('Tuesday Throttle');
    expect(isCrewCode(crew.join_code)).toBe(true);
    expect(crew.member_ids).toEqual(['me']);
    expect(crew.roles).toEqual({ me: 'lead' });
    expect(mockDb.sets).toHaveLength(1);
    expect(mockDb.sets[0].data).toMatchObject({ name: 'Tuesday Throttle', created_by: 'me', member_ids: ['me'], roles: { me: 'lead' }, join_code: crew.join_code, created_at: 'SERVER_TS' });
    expect(mockDb.sets[0].path).toBe(`crews/${crew.id}`);
  });
  it('rejects names shorter than 2 or longer than 22 without touching Firestore', async () => {
    await expect(createCrew('A')).rejects.toMatchObject({ kind: 'bad-name' });
    await expect(createCrew(' '.repeat(5))).rejects.toMatchObject({ kind: 'bad-name' });
    await expect(createCrew('x'.repeat(23))).rejects.toMatchObject({ kind: 'bad-name' });
    expect(mockDb.sets).toHaveLength(0);
    await expect(createCrew('ab')).resolves.toBeTruthy();
    await expect(createCrew('x'.repeat(22))).resolves.toBeTruthy();
  });
  it('checks for a code collision and retries with another code', async () => {
    const seq = [0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    const rnd = jest.spyOn(Math, 'random').mockImplementation(() => seq.shift() ?? 0.9);
    mockDb.crews.set('other', { join_code: 'AAAAAA' });
    const crew = await createCrew('Fresh');
    rnd.mockRestore();
    expect(crew.join_code).not.toBe('AAAAAA');
    expect(mockDb.lastWhere.filter((w) => w[0] === 'crews' && w[1] === 'join_code').length).toBeGreaterThanOrEqual(2);
  });
  it('signed out -> CrewError signed-out; offline -> network', async () => {
    mockUid = null;
    await expect(createCrew('Name')).rejects.toMatchObject({ kind: 'signed-out' });
    mockUid = 'me';
    mockDb.failWith = { code: 'unavailable' };
    await expect(createCrew('Name')).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('joinCrewByCode', () => {
  beforeEach(() => {
    mockDb.crews.set('c1', { name: 'Ghat Ghosts', created_by: 'meera', member_ids: ['meera'], roles: { meera: 'lead' }, join_code: 'GHST72' });
  });
  it('adds me with arrayUnion and returns the crew with me in it', async () => {
    const crew = await joinCrewByCode('ghst72');
    expect(crew.member_ids).toEqual(['meera', 'me']);
    expect(mockDb.updates).toEqual([{ path: 'crews/c1', data: { member_ids: { union: ['me'] } } }]);
  });
  it('already a member: resolves without writing', async () => {
    mockDb.crews.get('c1').member_ids.push('me');
    const crew = await joinCrewByCode('GHST72');
    expect(crew.id).toBe('c1');
    expect(mockDb.updates).toHaveLength(0);
  });
  it('unknown code -> not-found; malformed -> bad-code', async () => {
    await expect(joinCrewByCode('K4N9TZ')).rejects.toMatchObject({ kind: 'not-found' });
    await expect(joinCrewByCode('K4N9')).rejects.toMatchObject({ kind: 'bad-code' });
    await expect(joinCrewByCode('K4N9TZ')).rejects.toBeInstanceOf(CrewError);
    expect(mockDb.updates).toHaveLength(0);
  });
  it('offline -> network', async () => {
    mockDb.failWith = { code: 'unavailable' };
    await expect(joinCrewByCode('GHST72')).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('leaveCrew / getCrew / subscribeMyCrews', () => {
  it('removes me from member_ids and from roles in one update', async () => {
    await leaveCrew('c1');
    expect(mockDb.updates).toEqual([{ path: 'crews/c1', data: { member_ids: { remove: ['me'] }, 'roles.me': 'DELETE' } }]);
  });
  it('getCrew returns a crew or null', async () => {
    mockDb.crews.set('c1', { name: 'A' });
    expect((await getCrew('c1'))?.name).toBe('A');
    expect(await getCrew('nope')).toBeNull();
  });
  it('subscribeMyCrews queries by membership, newest first, and reports errors', () => {
    const onCrews = jest.fn();
    const onError = jest.fn();
    const unsub = subscribeMyCrews('me', onCrews, onError);
    expect(typeof unsub).toBe('function');
    expect(mockDb.lastWhere).toContainEqual(['crews', 'member_ids', 'array-contains', 'me']);
    mockDb.snapshotHandler!.ok({
      docs: [
        { id: 'old', data: () => ({ name: 'Old', created_at: { toMillis: () => 10 }, member_ids: ['me'] }) },
        { id: 'new', data: () => ({ name: 'New', created_at: { toMillis: () => 20 }, member_ids: ['me'] }) },
      ],
    });
    expect(onCrews.mock.calls[0][0].map((c: any) => c.id)).toEqual(['new', 'old']);
    mockDb.snapshotHandler!.err(new Error('x'));
    expect(onError).toHaveBeenCalled();
  });
  it('sortCrews puts a crew whose server timestamp is still pending first', () => {
    const mk = (id: string, ms: number | null) => ({ id, name: id, created_by: '', member_ids: [], roles: {}, join_code: '', created_ms: ms });
    expect(sortCrews([mk('a', 5), mk('p', null), mk('b', 9)]).map((c) => c.id)).toEqual(['p', 'b', 'a']);
  });
});

describe('ride lookups for Join', () => {
  it('findRideByCode finds a ride code and ignores malformed input', async () => {
    mockDb.groups.set('g1', { name: 'Sunrise Run', join_code: 'RYDE22', member_ids: ['x'], start_time_ms: 99 });
    expect(await findRideByCode('ryde22')).toEqual({ id: 'g1', name: 'Sunrise Run', member_ids: ['x'], start_time_ms: 99 });
    expect(await findRideByCode('K4N9TZ')).toBeNull();
    expect(await findRideByCode('abc')).toBeNull();
  });
  it('getCrewNextRide picks the soonest unfinished ride, ignoring finished and long-past ones', async () => {
    const now = 1_000_000_000;
    mockDb.groups.set('past', { crew_id: 'c1', name: 'Past', start_time_ms: now - 10 * 3_600_000, status: 'planned' });
    mockDb.groups.set('done', { crew_id: 'c1', name: 'Done', start_time_ms: now + 1000, status: 'finished' });
    mockDb.groups.set('later', { crew_id: 'c1', name: 'Later', start_time_ms: now + 5 * 3_600_000, status: 'planned' });
    mockDb.groups.set('soon', { crew_id: 'c1', name: 'Soon', start_time_ms: now + 3_600_000, status: 'planned' });
    mockDb.groups.set('other', { crew_id: 'c2', name: 'Other', start_time_ms: now + 10, status: 'planned' });
    expect((await getCrewNextRide('c1', now))?.id).toBe('soon');
    expect(await getCrewNextRide('none', now)).toBeNull();
  });
});
