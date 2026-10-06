/**
 * The SOS offline queue and the per-group SOS OR-Set open their storage through storageOpener, so the app can make
 * them encrypted at rest; with no opener (or a failing one) they fall back to plain MMKV and keep persisting.
 */
const mockPlainOpened: string[] = [];
jest.mock('react-native-mmkv', () => ({
  __esModule: true,
  MMKV: jest.fn().mockImplementation(({ id }: { id: string }) => {
    mockPlainOpened.push(id);
    const m: Record<string, string> = {};
    return { getString: (k: string) => m[k], set: (k: string, v: string) => { m[k] = v; }, delete: (k: string) => { delete m[k]; }, clearAll: () => Object.keys(m).forEach((k) => delete m[k]) };
  }),
}));

import { setStorageOpener } from '../src/crdt/storageOpener';
import { _resetQueueStorage, queueEnqueue, queuePeek, SOS_QUEUE } from '../src/crdt/localQueue';
import { createORSet, orSetAddWithTag, orSetLoad, orSetSave } from '../src/crdt/orSet';

const op = (id: string) => ({
  id, type: 'sos_event' as const, data: { sos_id: id, rider_id: 'r', group_id: 'g', lat: 1, lng: 2, created_at_hlc: '1:0:n' } as never,
  created_at_hlc: '1:0:n', retry_count: 0,
});

beforeEach(() => {
  mockPlainOpened.length = 0;
  setStorageOpener(null);
  _resetQueueStorage();
});
afterAll(() => setStorageOpener(null));

describe('storageOpener', () => {
  it('uses the injected (encrypted) opener for the offline queue and the OR-Set, by instance id', () => {
    const opened: string[] = [];
    const backing: Record<string, Record<string, string>> = {};
    setStorageOpener((id) => {
      opened.push(id);
      backing[id] = backing[id] ?? {};
      return { getString: (k: string) => backing[id][k], set: (k: string, v: string) => { backing[id][k] = v; }, delete: (k: string) => { delete backing[id][k]; }, clearAll: () => { backing[id] = {}; } };
    });
    queueEnqueue(SOS_QUEUE, op('s1') as never);
    expect(queuePeek(SOS_QUEUE)).toHaveLength(1);
    expect(opened).toContain('offline_queue');
    expect(backing.offline_queue[SOS_QUEUE]).toContain('s1');

    orSetSave(orSetAddWithTag(createORSet(), { sos_id: 's1', rider_id: 'r', group_id: 'g', lat: 1, lng: 2, created_at_hlc: '1:0:n' } as never, 'tag1'), 'sos_orset_g');
    expect(opened).toContain('sos_orset_g');
    expect(orSetLoad('sos_orset_g').adds.size).toBe(1);
    expect(backing.sos_orset_g.or_set).toContain('s1');
    expect(mockPlainOpened).toEqual([]); // nothing went to the plain constructor
  });

  it('falls back to plain MMKV when no opener is registered', () => {
    queueEnqueue(SOS_QUEUE, op('s2') as never);
    expect(queuePeek(SOS_QUEUE)).toHaveLength(1);
    expect(mockPlainOpened).toContain('offline_queue');
  });

  it('never loses an SOS when the opener throws: warns and uses plain MMKV', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    setStorageOpener(() => {
      throw new Error('keystore down');
    });
    queueEnqueue(SOS_QUEUE, op('s3') as never);
    expect(queuePeek(SOS_QUEUE).map((o) => o.id)).toEqual(['s3']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
