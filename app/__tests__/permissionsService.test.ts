/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories need require */
/**
 * permissionsService: Android PermissionsAndroid flows, iOS geolocation/messaging/webrtc flows, blocked handling.
 */
import { Linking, PermissionsAndroid, Platform } from 'react-native';

const mockHasPermission = jest.fn();
const mockRequestPermission = jest.fn();
jest.mock('@react-native-firebase/messaging', () => ({
  __esModule: true,
  default: () => ({ hasPermission: (...a: unknown[]) => mockHasPermission(...a), requestPermission: (...a: unknown[]) => mockRequestPermission(...a) }),
}));

const mockStop = jest.fn();
const mockGetUserMedia = jest.fn();
jest.mock('react-native-webrtc', () => ({ mediaDevices: { getUserMedia: (...a: unknown[]) => mockGetUserMedia(...a) } }), { virtual: true });

const mockGetProviderState = jest.fn();
jest.mock('react-native-background-geolocation', () => ({ __esModule: true, default: { getProviderState: (...a: unknown[]) => mockGetProviderState(...a) } }), { virtual: true });

import {
  __resetPermissionMemory, getPermissionStatus, hasAlwaysLocation, openSystemSettings, requestPermission,
} from '../src/services/permissionsService';

const Geo = require('react-native-geolocation-service');
const R = PermissionsAndroid.RESULTS;
const P = PermissionsAndroid.PERMISSIONS;
const BG = 'android.permission.ACCESS_BACKGROUND_LOCATION';
const NOTIF = 'android.permission.POST_NOTIFICATIONS';

function setPlatform(os: 'android' | 'ios', version: number | string = os === 'android' ? 34 : '17.0') {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
  Object.defineProperty(Platform, 'Version', { configurable: true, get: () => version });
}

let granted: Set<string>;
let checkSpy: jest.SpyInstance;
let requestSpy: jest.SpyInstance;
let multiSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  __resetPermissionMemory();
  granted = new Set();
  checkSpy = jest.spyOn(PermissionsAndroid, 'check').mockImplementation(async (p: any) => granted.has(p));
  requestSpy = jest.spyOn(PermissionsAndroid, 'request').mockImplementation(async (p: any) => { granted.add(p); return R.GRANTED; });
  multiSpy = jest.spyOn(PermissionsAndroid, 'requestMultiple').mockImplementation(async (ps: any) => {
    const out: any = {};
    ps.forEach((p: string) => { granted.add(p); out[p] = R.GRANTED; });
    return out;
  });
});
afterEach(() => {
  checkSpy.mockRestore();
  requestSpy.mockRestore();
  multiSpy.mockRestore();
});

describe('Android', () => {
  beforeEach(() => setPlatform('android', 34));

  it('location: undetermined until FINE or COARSE is granted', async () => {
    expect(await getPermissionStatus('location')).toBe('undetermined');
    granted.add(P.ACCESS_COARSE_LOCATION);
    expect(await getPermissionStatus('location')).toBe('granted');
  });

  it('requests FINE+COARSE, then BACKGROUND for always', async () => {
    const status = await requestPermission('location', { always: true });
    expect(status).toBe('granted');
    expect(multiSpy).toHaveBeenCalledWith([P.ACCESS_FINE_LOCATION, P.ACCESS_COARSE_LOCATION]);
    expect(requestSpy).toHaveBeenCalledWith(BG);
    expect(await hasAlwaysLocation()).toBe(true);
  });

  it('does not ask for background when only "while using" was wanted', async () => {
    expect(await requestPermission('location', { always: false })).toBe('granted');
    expect(requestSpy).not.toHaveBeenCalledWith(BG);
    expect(await hasAlwaysLocation()).toBe(false);
  });

  it('a declined background request still leaves location granted (foreground)', async () => {
    requestSpy.mockResolvedValue(R.DENIED);
    expect(await requestPermission('location', { always: true })).toBe('granted');
    expect(await hasAlwaysLocation()).toBe(false);
  });

  it('background is not requested before Android 10 and counts as always', async () => {
    setPlatform('android', 28);
    expect(await requestPermission('location', { always: true })).toBe('granted');
    expect(requestSpy).not.toHaveBeenCalled();
    expect(await hasAlwaysLocation()).toBe(true);
  });

  it('a refused location request is denied; never-ask-again is blocked and remembered', async () => {
    multiSpy.mockResolvedValue({ [P.ACCESS_FINE_LOCATION]: R.DENIED, [P.ACCESS_COARSE_LOCATION]: R.DENIED });
    expect(await requestPermission('location')).toBe('denied');
    expect(await getPermissionStatus('location')).toBe('denied');
    multiSpy.mockResolvedValue({ [P.ACCESS_FINE_LOCATION]: R.NEVER_ASK_AGAIN, [P.ACCESS_COARSE_LOCATION]: R.NEVER_ASK_AGAIN });
    expect(await requestPermission('location')).toBe('blocked');
    expect(await getPermissionStatus('location')).toBe('blocked');
  });

  it('notifications: POST_NOTIFICATIONS on API 33+, always granted below', async () => {
    expect(await getPermissionStatus('notifications')).toBe('undetermined');
    expect(await requestPermission('notifications')).toBe('granted');
    expect(requestSpy).toHaveBeenCalledWith(NOTIF);
    expect(await getPermissionStatus('notifications')).toBe('granted');
    setPlatform('android', 31);
    granted.clear();
    expect(await getPermissionStatus('notifications')).toBe('granted');
    requestSpy.mockClear();
    expect(await requestPermission('notifications')).toBe('granted');
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('microphone: RECORD_AUDIO, denial and never-ask-again', async () => {
    requestSpy.mockResolvedValueOnce(R.DENIED);
    expect(await requestPermission('microphone')).toBe('denied');
    requestSpy.mockResolvedValueOnce(R.NEVER_ASK_AGAIN);
    expect(await requestPermission('microphone')).toBe('blocked');
    expect(await getPermissionStatus('microphone')).toBe('blocked');
    requestSpy.mockResolvedValueOnce(R.GRANTED);
    expect(await requestPermission('microphone')).toBe('granted');
    expect(requestSpy).toHaveBeenLastCalledWith(P.RECORD_AUDIO);
  });

  it('a throwing OS request is reported as denied, never thrown', async () => {
    requestSpy.mockRejectedValue(new Error('activity gone'));
    await expect(requestPermission('microphone')).resolves.toBe('denied');
  });
});

describe('iOS', () => {
  beforeEach(() => setPlatform('ios'));

  it('location: requests always / whenInUse through geolocation-service', async () => {
    Geo.requestAuthorization.mockResolvedValueOnce('granted');
    expect(await requestPermission('location', { always: true })).toBe('granted');
    expect(Geo.requestAuthorization).toHaveBeenLastCalledWith('always');
    Geo.requestAuthorization.mockResolvedValueOnce('granted');
    await requestPermission('location', { always: false });
    expect(Geo.requestAuthorization).toHaveBeenLastCalledWith('whenInUse');
    Geo.requestAuthorization.mockResolvedValueOnce('denied');
    expect(await requestPermission('location')).toBe('blocked');
    Geo.requestAuthorization.mockResolvedValueOnce('restricted');
    expect(await requestPermission('location')).toBe('blocked');
  });

  it('location status comes from the provider state without prompting', async () => {
    mockGetProviderState.mockResolvedValue({ status: 3 });
    expect(await getPermissionStatus('location')).toBe('granted');
    expect(await hasAlwaysLocation()).toBe(true);
    mockGetProviderState.mockResolvedValue({ status: 4 });
    expect(await getPermissionStatus('location')).toBe('granted');
    expect(await hasAlwaysLocation()).toBe(false);
    mockGetProviderState.mockResolvedValue({ status: 2 });
    expect(await getPermissionStatus('location')).toBe('blocked');
    mockGetProviderState.mockResolvedValue({ status: 0 });
    expect(await getPermissionStatus('location')).toBe('undetermined');
    expect(Geo.requestAuthorization).not.toHaveBeenCalled();
  });

  it('notifications map messaging authorization statuses', async () => {
    mockHasPermission.mockResolvedValueOnce(-1);
    expect(await getPermissionStatus('notifications')).toBe('undetermined');
    mockHasPermission.mockResolvedValueOnce(0);
    expect(await getPermissionStatus('notifications')).toBe('blocked');
    mockHasPermission.mockResolvedValueOnce(2);
    expect(await getPermissionStatus('notifications')).toBe('granted');
    mockRequestPermission.mockResolvedValueOnce(1);
    expect(await requestPermission('notifications')).toBe('granted');
    mockRequestPermission.mockResolvedValueOnce(0);
    expect(await requestPermission('notifications')).toBe('blocked');
    mockHasPermission.mockRejectedValueOnce(new Error('x'));
    expect(await getPermissionStatus('notifications')).toBe('undetermined');
  });

  it('microphone: getUserMedia({audio:true}) then the tracks are stopped', async () => {
    mockGetUserMedia.mockResolvedValue({ getTracks: () => [{ stop: mockStop }, { stop: mockStop }] });
    expect(await getPermissionStatus('microphone')).toBe('undetermined');
    expect(await requestPermission('microphone')).toBe('granted');
    expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(mockStop).toHaveBeenCalledTimes(2);
    expect(await getPermissionStatus('microphone')).toBe('granted');
  });

  it('a refused microphone is blocked', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('NotAllowedError'));
    expect(await requestPermission('microphone')).toBe('blocked');
    expect(await getPermissionStatus('microphone')).toBe('blocked');
  });
});

describe('openSystemSettings', () => {
  it('opens the OS settings page and swallows failures', async () => {
    const spy = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await openSystemSettings();
    expect(spy).toHaveBeenCalled();
    spy.mockRejectedValue(new Error('no'));
    await expect(openSystemSettings()).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
