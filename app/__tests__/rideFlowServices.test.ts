/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
const mockUpdate = jest.fn().mockResolvedValue(undefined);
const mockGet = jest.fn();
jest.mock('@react-native-firebase/firestore', () => {
  const firestore: any = jest.fn(() => ({ collection: jest.fn(() => ({ doc: jest.fn(() => ({ update: mockUpdate, get: mockGet })) })) }));
  firestore.FieldValue = { arrayUnion: jest.fn((...a: unknown[]) => ({ union: a })) };
  return { __esModule: true, default: firestore };
});
const mockResolve = jest.fn().mockResolvedValue(undefined);
const mockSubmit = jest.fn().mockResolvedValue({ report: {}, queued: false });
const mockCluster = jest.fn().mockResolvedValue(undefined);
jest.mock('@hazard/services/hazardService', () => ({
  resolveHazard: (...a: unknown[]) => mockResolve(...a),
  submitHazardReport: (...a: unknown[]) => mockSubmit(...a),
  triggerClustering: (...a: unknown[]) => mockCluster(...a),
}));
const calls: string[] = [];
const mockFinish = jest.fn();
jest.mock('../src/services/rideRecorder', () => ({
  rideRecorder: {
    isRecording: jest.fn(() => false), rideId: jest.fn(() => null), start: jest.fn(() => calls.push('start')),
    finish: (...a: unknown[]) => { calls.push('finish'); return mockFinish(...a); }, reset: jest.fn(), addEvent: jest.fn(),
  },
}));
const mockSave = jest.fn();
jest.mock('../src/services/rideLogService', () => ({ saveRideLog: (...a: unknown[]) => { calls.push('save'); return mockSave(...a); } }));
const mockStore: { v: string | undefined } = { v: undefined };
jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({ getString: () => mockStore.v, set: (_k: string, v: string) => { mockStore.v = v; }, delete: jest.fn() })),
}));

import { GONE_VOTES_TO_RESOLVE, confirmStillThere, distinctVotes, shouldResolve, voteGone } from '../src/services/hazardConfirmService';
import { SAVE_GRACE_MS, finishOwnRide, isEndingOwnRide, markStopVisited, resetRideFlow, startRecorderOnce, visitedStopIds } from '../src/services/rideFlow';
import { flushPending, readPending } from '../src/services/pendingLogs';
import { rideRecorder } from '../src/services/rideRecorder';

const LOG = { ride_id: 'r1', name: 'Run', km: 10, track: [], events: [] } as any;

describe('gone votes (hazard confirm)', () => {
  beforeEach(() => { mockUpdate.mockClear(); mockGet.mockReset(); mockResolve.mockClear(); });
  it('resolves once two DIFFERENT riders voted gone', () => {
    expect(GONE_VOTES_TO_RESOLVE).toBe(2);
    expect(shouldResolve(['a'])).toBe(false);
    expect(shouldResolve(['a', 'a'])).toBe(false);
    expect(shouldResolve(['a', 'b'])).toBe(true);
    expect(distinctVotes(['a', 'a', '', 3, 'b'])).toEqual(['a', 'b']);
    expect(distinctVotes(undefined)).toEqual([]);
  });
  it('first vote: arrayUnion own uid, cluster stays', async () => {
    mockGet.mockResolvedValue({ data: () => ({ gone_votes: ['me'] }) });
    const r = await voteGone('h1', 'me');
    expect(mockUpdate).toHaveBeenCalledWith({ gone_votes: { union: ['me'] } });
    expect(r).toEqual({ votes: 1, resolved: false });
    expect(mockResolve).not.toHaveBeenCalled();
  });
  it('second distinct voter resolves the cluster', async () => {
    mockGet.mockResolvedValue({ data: () => ({ gone_votes: ['other', 'me'] }) });
    const r = await voteGone('h1', 'me');
    expect(r).toEqual({ votes: 2, resolved: true });
    expect(mockResolve).toHaveBeenCalledWith('h1');
  });
  it('still there = another report at the cluster spot, then clustering', async () => {
    const r = await confirmStillThere({ type: 'pothole', lat: 1, lng: 2, riderId: 'me', groupId: 'g', hlc: '5:0' });
    expect(mockSubmit).toHaveBeenCalledWith('pothole', 1, 2, 'me', 'g', '5:0');
    expect(mockCluster).toHaveBeenCalledWith('g');
    expect(r.queued).toBe(false);
  });
});

describe('finishOwnRide: finish -> save, offline-safe', () => {
  beforeEach(() => {
    calls.length = 0; mockStore.v = undefined; resetRideFlow(); mockSave.mockReset(); mockFinish.mockReset();
    (rideRecorder.start as jest.Mock).mockClear();
  });
  it('finishes the recording first, then saves; the log is queued first and dropped once saved', async () => {
    mockFinish.mockReturnValue(LOG);
    mockSave.mockResolvedValue(undefined);
    const r = await finishOwnRide('me', 'r1', 3);
    expect(calls).toEqual(['finish', 'save']);
    expect(mockFinish).toHaveBeenCalledWith(3, expect.any(Number));
    expect(r).toEqual({ log: LOG, saved: true });
    expect(readPending()).toEqual([]);
    expect(isEndingOwnRide('r1')).toBe(true);
  });
  it('a save that never resolves (offline) does not block: returns after the grace period with the log still queued', async () => {
    jest.useFakeTimers();
    mockFinish.mockReturnValue(LOG);
    mockSave.mockReturnValue(new Promise(() => undefined));
    const p = finishOwnRide('me', 'r1', 2);
    await jest.advanceTimersByTimeAsync(SAVE_GRACE_MS + 10);
    expect(await p).toEqual({ log: LOG, saved: false });
    expect(readPending()).toEqual([{ uid: 'me', log: LOG }]);
    jest.useRealTimers();
  });
  it('a save that throws keeps the log queued; the next launch saves it', async () => {
    mockFinish.mockReturnValue(LOG);
    mockSave.mockRejectedValueOnce(new Error('offline'));
    const r = await finishOwnRide('me', 'r1', 2);
    expect(r.saved).toBe(false);
    expect(readPending()).toHaveLength(1);
    mockSave.mockResolvedValue(undefined);
    expect(await flushPending('me')).toBe(1);
    expect(readPending()).toEqual([]);
    expect(await flushPending('me')).toBe(0);
  });
  it('nothing recorded (finish returns null): no save, no queue', async () => {
    mockFinish.mockReturnValue(null);
    expect(await finishOwnRide('me', 'r1', 1)).toEqual({ log: null, saved: false });
    expect(mockSave).not.toHaveBeenCalled();
  });
});

describe('recorder start once + visited stops', () => {
  it('starts only when this ride is not already being recorded', () => {
    const ride: any = { id: 'r1', name: 'Run', crew_id: null, ride_plan: null };
    expect(startRecorderOnce(ride)).toBe(true);
    (rideRecorder.isRecording as jest.Mock).mockReturnValue(true);
    (rideRecorder.rideId as jest.Mock).mockReturnValue('r1');
    expect(startRecorderOnce(ride)).toBe(false);
    expect(startRecorderOnce(null)).toBe(false);
  });
  it('remembers stops per ride', () => {
    resetRideFlow();
    markStopVisited('r1', 's1');
    markStopVisited('r2', 's9');
    expect([...visitedStopIds('r1')]).toEqual(['s1']);
  });
});
