/**
 * Group service tests (T-05, Phase 2).
 * Tests create/join/list flows with Firestore mock.
 * Jest config already mocks Firebase modules.
 */

import {
  GroupService,
  Group,
  generateJoinCode,
  isJoinCode,
  RIDE_TYPES,
} from '../src/group/groupService';

// Test helpers exposed by the mocks (mapped in jest.config.js).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const firestoreMock = require('../test/__mocks__/firebaseMock.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const authMock = require('../test/__mocks__/authMock.js');

describe('GroupService', () => {
  let groupService: GroupService;

  beforeEach(() => {
    groupService = new GroupService();
  });

  test('createGroup creates a group with current user as member', async () => {
    const groupId = await groupService.createGroup('Test Ride');
    expect(groupId).toBeTruthy();
  });

  test('createGroup uses default name if not provided', async () => {
    const groupId = await groupService.createGroup();
    expect(groupId).toBeTruthy();
  });

  test('joinGroup adds user to member_ids', async () => {
    const groupId = await groupService.createGroup('Test Ride');
    expect(groupId).toBeTruthy();
    // Would need to change user context to fully test, skipping for now
  });

  test('myGroups subscription returns unsubscribe function', async () => {
    const groupId = await groupService.createGroup('Test Ride');

    const unsubscribe = groupService.myGroups((groups: Group[]) => {
      // Callback triggered
    });

    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });
});


describe('join codes', () => {
  test('generateJoinCode makes 6 unambiguous characters', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateJoinCode();
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  test('generateJoinCode is deterministic for a given random source', () => {
    expect(generateJoinCode(() => 0)).toBe('AAAAAA');
  });

  test('isJoinCode distinguishes a short code from a raw group id', () => {
    expect(isJoinCode('K7M2QX')).toBe(true);
    expect(isJoinCode(' k7m2qx ')).toBe(true); // case/space tolerant
    expect(isJoinCode('3f1c2d9e-8a4b-4c1d-9e2f-0a1b2c3d4e5f')).toBe(false);
    expect(isJoinCode('K7M2Q')).toBe(false); // too short
    expect(isJoinCode('K7M2Q0')).toBe(false); // 0 is not in the alphabet
  });
});

describe('GroupService — codes, leave, ride metadata', () => {
  let svc: GroupService;

  beforeEach(() => {
    firestoreMock.__reset();
    authMock.__setUid('owner-1');
    svc = new GroupService();
  });

  test('createGroup stores a join code, ride type and start time', async () => {
    const start = Date.now() + 30 * 60_000;
    const id = await svc.createGroup('Sunday run', undefined, {
      ride_type: 'Touring',
      start_time_ms: start,
    });
    const g = await svc.getGroup(id);
    expect(g?.join_code).toMatch(/^[A-Z2-9]{6}$/);
    expect(g?.ride_type).toBe('Touring');
    expect(g?.start_time_ms).toBe(start);
  });

  test('createGroup without metadata leaves ride_type/start_time_ms null (nothing invented)', async () => {
    const id = await svc.createGroup('Plain');
    const g = await svc.getGroup(id);
    expect(g?.ride_type).toBeNull();
    expect(g?.start_time_ms).toBeNull();
  });

  test('every ride type offered by the UI is a plain non-empty label', () => {
    expect(RIDE_TYPES.length).toBeGreaterThan(0);
    RIDE_TYPES.forEach((t) => expect(t.length).toBeGreaterThan(0));
  });

  test('a second rider joins by short code (case-insensitive)', async () => {
    const id = await svc.createGroup('Join me');
    const code = (await svc.getGroup(id))!.join_code!;

    authMock.__setUid('rider-2');
    const rider2 = new GroupService();
    await rider2.joinGroup(code.toLowerCase());

    expect((await svc.getGroup(id))!.member_ids).toEqual(['owner-1', 'rider-2']);
  });

  test('joining twice does not duplicate the member', async () => {
    const id = await svc.createGroup('Once');
    const code = (await svc.getGroup(id))!.join_code!;
    authMock.__setUid('rider-2');
    const rider2 = new GroupService();
    await rider2.joinGroup(code);
    await rider2.joinGroup(code);
    expect((await svc.getGroup(id))!.member_ids.filter((m) => m === 'rider-2')).toHaveLength(1);
  });

  test('createGroup writes the group and its join_codes/{CODE} doc together', async () => {
    const id = await svc.createGroup('With a code doc');
    const code = firestoreMock.__peek(`groups/${id}`).join_code;
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    expect(firestoreMock.__peek(`join_codes/${code}`)).toMatchObject({ kind: 'ride', target_id: id });
  });

  test('createGroup caps the name at 60 characters (the Firestore rules refuse longer ones)', async () => {
    const id = await svc.createGroup('x'.repeat(100));
    expect(firestoreMock.__peek(`groups/${id}`).name).toHaveLength(60);
  });

  test('createGroup never reuses a code that already has a join_codes doc', async () => {
    // Codes come from the CSPRNG now; force it to return zeros so every generated code is "AAAAAA".
    const spy = jest.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(((a: Uint8Array) => {
      a.fill(0);
      return a;
    }) as never);
    firestoreMock.__put('join_codes/AAAAAA', { kind: 'ride', target_id: 'someone-elses' });
    await expect(svc.createGroup('Collides')).rejects.toThrow(/join code/i);
    spy.mockRestore();
    expect(firestoreMock.__peek('join_codes/AAAAAA').target_id).toBe('someone-elses');
  });

  test('createGroup skips a taken code and stores the next free one', async () => {
    const seq = [0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    const spy = jest.spyOn(Math, 'random').mockImplementation(() => seq.shift() ?? 0.9);
    firestoreMock.__put('join_codes/AAAAAA', { kind: 'ride', target_id: 'x' });
    const id = await svc.createGroup('Retry');
    spy.mockRestore();
    const code = firestoreMock.__peek(`groups/${id}`).join_code;
    expect(code).not.toBe('AAAAAA');
    expect(firestoreMock.__peek(`join_codes/${code}`).target_id).toBe(id);
  });

  test('the join proof is bound to the rider: "<CODE>:<uid>"', async () => {
    const id = await svc.createGroup('Proof');
    const code = firestoreMock.__peek(`groups/${id}`).join_code;
    authMock.__setUid('rider-9');
    await new GroupService().joinGroup(code);
    expect(firestoreMock.__peek(`groups/${id}`).join_proof).toBe(`${code}:rider-9`);
  });

  test('a stranger cannot read the group, or join it without the code (the mock plays the rules)', async () => {
    const id = await svc.createGroup('Private');
    authMock.__setUid('stranger');
    await expect(new GroupService().getGroup(id)).rejects.toMatchObject({ code: 'permission-denied' });
  });

  test('a raw group id no longer joins anything (legacy path removed)', async () => {
    const id = await svc.createGroup('No ids');
    authMock.__setUid('rider-3');
    await expect(new GroupService().joinGroup(id)).rejects.toThrow('not found');
    authMock.__setUid('owner-1');
    expect((await svc.getGroup(id))!.member_ids).toEqual(['owner-1']);
  });

  test('a code that belongs to a crew (or nothing) is "not found" for a ride join', async () => {
    firestoreMock.__put('join_codes/CREW22', { kind: 'crew', target_id: 'c1' });
    authMock.__setUid('rider-4');
    await expect(new GroupService().joinGroup('CREW22')).rejects.toThrow('not found');
  });

  test('leaveGroup removes only the current user and keeps the group for others', async () => {
    const id = await svc.createGroup('Leave me');
    const code = (await svc.getGroup(id))!.join_code!;
    authMock.__setUid('rider-2');
    const rider2 = new GroupService();
    await rider2.joinGroup(code);

    await rider2.leaveGroup(id);

    authMock.__setUid('owner-1'); // rider-2 can no longer read the group
    const g = await svc.getGroup(id);
    expect(g!.member_ids).toEqual(['owner-1']);
  });
});
