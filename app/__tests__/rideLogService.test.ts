/**
 * rideLogService against an in-memory Firestore fake; userService.bumpStats is mocked.
 */
const mockStore = new Map<string, any>();

jest.mock('@react-native-firebase/firestore', () => {
  const docRef = (path: string) => ({
    get: jest.fn(async () => ({ exists: mockStore.has(path), data: () => mockStore.get(path) })),
    set: jest.fn(async (data: any, opts?: any) => {
      mockStore.set(path, opts?.merge ? { ...(mockStore.get(path) ?? {}), ...data } : data);
    }),
    update: jest.fn(async (data: any) => {
      if (!mockStore.has(path)) throw new Error('not-found');
      mockStore.set(path, { ...mockStore.get(path), ...data });
    }),
  });
  const collectionRef = (path: string) => {
    const q: any = {
      orderBy: jest.fn(() => q),
      limit: jest.fn(() => q),
      onSnapshot: jest.fn((cb: any, err: any) => {
        const l = { path, cb, err };
        (global as any).__listeners.push(l);
        const docs = [...mockStore.entries()].filter(([k]) => k.startsWith(`${path}/`)).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v }));
        cb({ docs });
        return jest.fn();
      }),
    };
    return q;
  };
  (global as any).__listeners = [];
  const firestore: any = jest.fn(() => ({ doc: jest.fn(docRef), collection: jest.fn(collectionRef) }));
  return { __esModule: true, default: firestore };
});
jest.mock('../src/services/userService', () => ({ bumpStats: jest.fn(async () => undefined) }));

import { MAX_TRACK_POINTS, RideLog } from '../src/models/domain';
import { bumpStats } from '../src/services/userService';
import { getRideLog, logFromDoc, logToDoc, sanitizeTrack, saveRideLog, setRouteRating, subscribeRideLogs } from '../src/services/rideLogService';
import { useRideLogsStore } from '../src/store/rideLogsStore';

const LOG: RideLog = {
  ride_id: 'r1', crew_id: 'c1', name: 'Marine Drive Sunrise', started_ms: 1_700_000_000_000, ended_ms: 1_700_003_480_000,
  km: 28.4, duration_s: 3480, avg_kmh: 29.4, max_kmh: 61.2, together_pct: 96, longest_gap_m: 410, riders: 5, hazards_shared: 1, signals_sent: 3,
  track: [19, 72.8, 19.01, 72.81, 19.02, 72.82], events: [{ t_ms: 1_700_000_000_000, kind: 'rolled', text: 'Rolled out' }], rating: null,
  start: { label: 'Gateway', lat: 19, lng: 72.8 }, destination: { label: 'Worli', lat: 19.02, lng: 72.82 },
};

beforeEach(() => {
  mockStore.clear();
  (bumpStats as jest.Mock).mockClear();
  (global as any).__listeners.length = 0;
  useRideLogsStore.getState().clear();
});

describe('saveRideLog', () => {
  it('writes users/{uid}/ride_logs/{ride_id} and bumps the stats the first time', async () => {
    await saveRideLog('u1', LOG);
    const doc = mockStore.get('users/u1/ride_logs/r1');
    expect(doc.name).toBe('Marine Drive Sunrise');
    expect(doc.km).toBe(28.4);
    expect(doc.track).toEqual(LOG.track);
    expect(doc.stats_counted).toBe(true);
    expect('rating' in doc).toBe(false);
    expect(bumpStats).toHaveBeenCalledTimes(1);
    expect(bumpStats).toHaveBeenCalledWith('u1', { km: 28.4, togetherPct: 96 });
  });

  it('is idempotent: saving the same ride id again updates the log but does not bump again', async () => {
    await saveRideLog('u1', LOG);
    await saveRideLog('u1', { ...LOG, km: 30 });
    expect(mockStore.get('users/u1/ride_logs/r1').km).toBe(30);
    expect(bumpStats).toHaveBeenCalledTimes(1);
  });

  it('a different ride id bumps again', async () => {
    await saveRideLog('u1', LOG);
    await saveRideLog('u1', { ...LOG, ride_id: 'r2' });
    expect(bumpStats).toHaveBeenCalledTimes(2);
  });

  it('re-saving does not clear an existing rating', async () => {
    await saveRideLog('u1', LOG);
    await setRouteRating('u1', 'r1', 'smooth');
    await saveRideLog('u1', LOG);
    expect(mockStore.get('users/u1/ride_logs/r1').rating).toBe('smooth');
  });

  it('retries the stats bump if an earlier bump failed', async () => {
    (bumpStats as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await expect(saveRideLog('u1', LOG)).rejects.toThrow('offline');
    expect(mockStore.get('users/u1/ride_logs/r1').stats_counted).toBe(false);
    await saveRideLog('u1', LOG);
    expect(bumpStats).toHaveBeenCalledTimes(2);
    expect(mockStore.get('users/u1/ride_logs/r1').stats_counted).toBe(true);
  });

  it('never writes undefined/NaN and keeps the track flat and <= MAX_TRACK_POINTS', async () => {
    const big = Array.from({ length: 5000 * 2 }, (_, i) => (i % 2 ? 72.8 : 19 + i * 1e-6));
    await saveRideLog('u1', { ...LOG, track: big, avg_kmh: NaN, name: '  ' } as RideLog);
    const doc = mockStore.get('users/u1/ride_logs/r1');
    expect(doc.track.length).toBeLessThanOrEqual(MAX_TRACK_POINTS * 2);
    expect(doc.track.every((n: unknown) => typeof n === 'number')).toBe(true);
    expect(doc.avg_kmh).toBe(0);
    expect(doc.name).toBe('Ride');
    expect(Object.values(doc).includes(undefined)).toBe(false);
  });
});

describe('reading', () => {
  it('getRideLog returns the log, or null when it does not exist', async () => {
    await saveRideLog('u1', LOG);
    expect((await getRideLog('u1', 'r1'))?.name).toBe('Marine Drive Sunrise');
    expect(await getRideLog('u1', 'nope')).toBeNull();
  });

  it('subscribeRideLogs converts documents (tolerantly) and reports errors', () => {
    mockStore.set('users/u1/ride_logs/a', { name: 'A', started_ms: 5, km: '12', track: [1, 2, 'x', 4, 5], events: [{ t_ms: 1, kind: 'wat', text: 'x' }, { t_ms: 2, kind: 'hazard', text: 'h' }] });
    const got: RideLog[][] = [];
    const onError = jest.fn();
    subscribeRideLogs('u1', (l) => got.push(l), onError);
    expect(got[0]).toHaveLength(1);
    expect(got[0][0].ride_id).toBe('a');
    expect(got[0][0].km).toBe(12);
    expect(got[0][0].track).toEqual([1, 2]);
    expect(got[0][0].events).toEqual([{ t_ms: 2, kind: 'hazard', text: 'h' }]);
    (global as any).__listeners[0].err(new Error('denied'));
    expect(onError).toHaveBeenCalled();
  });
});

describe('setRouteRating', () => {
  it('writes only the log own rating', async () => {
    await saveRideLog('u1', LOG);
    await setRouteRating('u1', 'r1', 'rough');
    expect(mockStore.get('users/u1/ride_logs/r1').rating).toBe('rough');
    expect([...mockStore.keys()]).toEqual(['users/u1/ride_logs/r1']);
  });
  it('rejects for a log that does not exist (never creates a partial one)', async () => {
    await expect(setRouteRating('u1', 'ghost', 'mixed')).rejects.toThrow();
    expect(mockStore.has('users/u1/ride_logs/ghost')).toBe(false);
  });
});

describe('converters', () => {
  it('logFromDoc defaults everything and clamps', () => {
    const l = logFromDoc('z', { together_pct: 250, riders: 0, rating: 'meh', start: { lat: 'x' }, destination: { label: 'D', lat: 1, lng: 2 }, track: 'nope', events: 5 });
    expect(l).toMatchObject({ ride_id: 'z', name: 'Ride', together_pct: 100, riders: 1, rating: null, start: null, track: [], events: [], crew_id: null });
    expect(l.destination).toEqual({ label: 'D', lat: 1, lng: 2 });
    expect(logFromDoc('q', undefined).km).toBe(0);
  });
  it('sanitizeTrack drops invalid pairs, accepts [{lat,lng}], decimates', () => {
    expect(sanitizeTrack([1, 2, NaN, 3, 4, 5, 95, 0])).toEqual([1, 2, 4, 5]);
    expect(sanitizeTrack([{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }, { lat: 'a' }])).toEqual([1, 2, 3, 4]);
    expect(sanitizeTrack(Array.from({ length: 4000 }, (_, i) => (i % 2 ? 10 : i / 100))).length).toBeLessThanOrEqual(MAX_TRACK_POINTS * 2);
  });
  it('logToDoc omits a null rating', () => {
    expect('rating' in logToDoc(LOG)).toBe(false);
    expect(logToDoc({ ...LOG, rating: 'mixed' }).rating).toBe('mixed');
  });
});

describe('rideLogsStore', () => {
  it('shares one listener between watchers and closes it with the last', () => {
    mockStore.set('users/u1/ride_logs/a', { name: 'A', started_ms: 5, km: 1 });
    const un1 = useRideLogsStore.getState().watch('u1');
    const un2 = useRideLogsStore.getState().watch('u1');
    expect((global as any).__listeners).toHaveLength(1);
    expect(useRideLogsStore.getState().loaded).toBe(true);
    expect(useRideLogsStore.getState().logs.map((l) => l.ride_id)).toEqual(['a']);
    un1();
    un1(); // double release is harmless
    un2();
    // a later watch re-subscribes
    useRideLogsStore.getState().watch('u1');
    expect((global as any).__listeners).toHaveLength(2);
  });
  it('flags an error', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    useRideLogsStore.getState().watch('u1');
    (global as any).__listeners[0].err(new Error('denied'));
    expect(useRideLogsStore.getState().error).toBe(true);
    expect(useRideLogsStore.getState().loaded).toBe(true);
  });
});
