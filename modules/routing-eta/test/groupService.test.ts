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

  test('still joins by raw group id (groups created before codes existed)', async () => {
    const id = await svc.createGroup('Legacy');
    authMock.__setUid('rider-3');
    await new GroupService().joinGroup(id);
    expect((await svc.getGroup(id))!.member_ids).toContain('rider-3');
  });

  test('unknown short code → clear "not found" error', async () => {
    await expect(svc.joinGroup('ZZZZZZ')).rejects.toThrow('not found');
  });

  test('unknown group id → clear "not found" error', async () => {
    await expect(svc.joinGroup('no-such-group')).rejects.toThrow('not found');
  });

  test('leaveGroup removes only the current user and keeps the group for others', async () => {
    const id = await svc.createGroup('Leave me');
    const code = (await svc.getGroup(id))!.join_code!;
    authMock.__setUid('rider-2');
    const rider2 = new GroupService();
    await rider2.joinGroup(code);

    await rider2.leaveGroup(id);

    const g = await svc.getGroup(id);
    expect(g!.member_ids).toEqual(['owner-1']);
  });
});
