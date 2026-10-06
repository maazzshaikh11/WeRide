/** join_codes helpers: lookup parsing, the per-rider proof, and the "lost a race for the code" retry. */
const mockStore = new Map<string, any>();
const mockCommits: { fail?: any }[] = [];
let mockCommitFailures: any[] = [];
const mockCodes: string[] = [];

jest.mock('../src/utils/joinCode', () => {
  const actual = jest.requireActual('../src/utils/joinCode');
  return { ...actual, generateJoinCode: (r?: () => number) => (r ? actual.generateJoinCode(r) : mockCodes.shift() ?? 'ZZZZZZ') };
});
jest.mock('@react-native-firebase/firestore', () => {
  const firestore: any = jest.fn(() => ({
    doc: (path: string) => ({ path, get: async () => ({ exists: mockStore.has(path), data: () => mockStore.get(path) }) }),
    batch: () => {
      const ops: any[] = [];
      return {
        set: (ref: any, data: any) => ops.push([ref.path, data]),
        commit: async () => {
          const f = mockCommitFailures.shift();
          mockCommits.push({ fail: f });
          if (f) throw f;
          ops.forEach(([p, d]) => mockStore.set(p, d));
        },
      };
    },
  }));
  return { __esModule: true, default: firestore };
});

import { createWithJoinCode, joinProof, lookupJoinCode } from '../src/services/joinCodes';

beforeEach(() => {
  mockStore.clear();
  mockCommits.length = 0;
  mockCommitFailures = [];
  mockCodes.length = 0;
});

describe('joinProof', () => {
  it('binds the code to the rider, so one rider\'s stored proof is useless to another', () => {
    expect(joinProof('K7M2QX', 'u1')).toBe('K7M2QX:u1');
    expect(joinProof('K7M2QX', 'u2')).not.toBe(joinProof('K7M2QX', 'u1'));
  });
});

describe('lookupJoinCode', () => {
  it('returns the kind and target, or null for a missing / malformed code doc', async () => {
    mockStore.set('join_codes/AAAAAA', { kind: 'crew', target_id: 'c1' });
    mockStore.set('join_codes/BBBBBB', { kind: 'ride', target_id: 'g1' });
    mockStore.set('join_codes/CCCCCC', { kind: 'admin', target_id: 'x' });
    mockStore.set('join_codes/DDDDDD', { kind: 'crew' });
    expect(await lookupJoinCode('AAAAAA')).toEqual({ kind: 'crew', id: 'c1' });
    expect(await lookupJoinCode('BBBBBB')).toEqual({ kind: 'ride', id: 'g1' });
    expect(await lookupJoinCode('CCCCCC')).toBeNull();
    expect(await lookupJoinCode('DDDDDD')).toBeNull();
    expect(await lookupJoinCode('EEEEEE')).toBeNull();
  });
});

describe('createWithJoinCode', () => {
  it('writes target + code doc together and returns the code', async () => {
    mockCodes.push('QQQQQQ');
    const code = await createWithJoinCode('ride', 'groups/g1', (c) => ({ name: 'R', join_code: c }));
    expect(code).toBe('QQQQQQ');
    expect(mockStore.get('groups/g1')).toEqual({ name: 'R', join_code: 'QQQQQQ' });
    expect(mockStore.get('join_codes/QQQQQQ')).toEqual({ kind: 'ride', target_id: 'g1' });
  });
  it('lost a race for the code (batch refused): tries another code', async () => {
    mockCodes.push('AAAAAA', 'BBBBBB');
    mockCommitFailures = [{ code: 'permission-denied' }];
    const code = await createWithJoinCode('crew', 'crews/c1', (c) => ({ join_code: c }));
    expect(code).toBe('BBBBBB');
    expect(mockCommits).toHaveLength(2);
    expect(mockStore.has('join_codes/AAAAAA')).toBe(false);
  });
  it('any other error is not retried', async () => {
    mockCodes.push('AAAAAA', 'BBBBBB');
    mockCommitFailures = [{ code: 'unavailable' }];
    await expect(createWithJoinCode('crew', 'crews/c1', () => ({}))).rejects.toMatchObject({ code: 'unavailable' });
    expect(mockCommits).toHaveLength(1);
  });
  it('gives up after repeated refusals', async () => {
    mockCodes.push('A', 'B', 'C', 'D', 'E');
    mockCommitFailures = Array(5).fill({ code: 'permission-denied' });
    await expect(createWithJoinCode('crew', 'crews/c1', () => ({}))).rejects.toMatchObject({ code: 'permission-denied' });
    expect(mockCommits).toHaveLength(5);
  });
});
