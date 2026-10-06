/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories need require */
/**
 * Perms: three cards, in-app explainer + real OS request, statuses read on mount, denial toast, Continue gating.
 */
import React from 'react';
import { AppState } from 'react-native';
import { act } from 'react-test-renderer';
import { THEMES } from '../src/theme/palettes';
import { useToastStore } from '../src/store/toastStore';
import { ALL_PALETTES, byLabel, byTestId, hasText, hasTestId, hostStyles, isDisabled, mountAsync, pressId, unmountAll } from './onboardingTestUtils';

type Status = 'granted' | 'denied' | 'blocked' | 'undetermined';
const mockStatus: Record<string, Status> = {};
const mockGet = jest.fn(async (k: string) => mockStatus[k]);
const mockRequest = jest.fn();
const mockAlways = jest.fn();
const mockSettings = jest.fn();
jest.mock('../src/services/permissionsService', () => ({
  getPermissionStatus: (k: string) => mockGet(k),
  requestPermission: (...a: unknown[]) => mockRequest(...a),
  hasAlwaysLocation: () => mockAlways(),
  openSystemSettings: () => mockSettings(),
}));
jest.mock('react-native-safe-area-context', () => require('./onboardingTestUtils').safeAreaMock());

import PermsScreen, { PERM_CARDS, PERM_TOASTS } from '../src/screens/onboarding/PermsScreen';

const nav = () => ({ navigate: jest.fn(), goBack: jest.fn() });
const render = (n = nav(), id: 'demo' | 'ember' = 'demo', scheme: 'light' | 'dark' = 'light') => mountAsync(<PermsScreen navigation={n} />, id, scheme);
const toasts = () => useToastStore.getState().toasts;

beforeEach(() => {
  Object.assign(mockStatus, { location: 'undetermined', notifications: 'undetermined', microphone: 'undetermined' });
  mockGet.mockClear();
  mockRequest.mockReset().mockResolvedValue('granted');
  mockAlways.mockReset().mockResolvedValue(true);
  mockSettings.mockReset();
  useToastStore.setState({ toasts: [] });
});
afterEach(unmountAll);

describe('PermsScreen', () => {
  it.each(ALL_PALETTES)('%s/%s: palette, step 4 of 5, three cards with the demo copy', async (id, scheme) => {
    const t = await render(nav(), id, scheme);
    const p = THEMES[id][scheme];
    expect(hostStyles(t).some((s) => s.flex === 1 && s.backgroundColor === p.bg)).toBe(true);
    expect(byTestId(t, 'stepper').props.accessibilityLabel).toBe('Step 4 of 5');
    expect(hasText(t, 'Three permissions.')).toBe(true);
    expect(hasText(t, "Here's why.")).toBe(true);
    for (const c of PERM_CARDS) {
      expect(hasText(t, c.title)).toBe(true);
      expect(hasText(t, c.body)).toBe(true);
      expect(hasTestId(t, `perm-card-${c.kind}`)).toBe(true);
    }
    expect(PERM_CARDS.map((c) => c.title)).toEqual(['Location, always', 'Notifications', 'Microphone']);
    expect(hasText(t, 'OPTIONAL')).toBe(true);
    // dark "Allow" buttons: ink fill
    expect(hostStyles(t).filter((s) => s.backgroundColor === p.ink && s.height === 44)).toHaveLength(3);
  });

  it('reads every status on mount, so a returning rider sees the truth', async () => {
    Object.assign(mockStatus, { location: 'granted', notifications: 'granted', microphone: 'denied' });
    const t = await render();
    expect(mockGet.mock.calls.map((c) => c[0]).sort()).toEqual(['location', 'microphone', 'notifications']);
    expect(hasText(t, 'Allowed')).toBe(true);
    expect(byLabel(t, 'Location, always: allowed')).toBeDefined();
    expect(byLabel(t, 'Allow Microphone')).toBeDefined();
    expect(isDisabled(byTestId(t, 'perms-continue'))).toBe(false);
  });

  it('Continue is disabled until location AND notifications are granted (microphone is optional)', async () => {
    Object.assign(mockStatus, { location: 'granted' });
    const t = await render();
    expect(isDisabled(byTestId(t, 'perms-continue'))).toBe(true);
    Object.assign(mockStatus, { notifications: 'granted' });
    const t2 = await render();
    expect(isDisabled(byTestId(t2, 'perms-continue'))).toBe(false);
  });

  it('Continue opens Contact', async () => {
    Object.assign(mockStatus, { location: 'granted', notifications: 'granted' });
    const n = nav();
    const t = await render(n);
    await pressId(t, 'perms-continue');
    expect(n.navigate).toHaveBeenCalledWith('Contact');
  });

  it('Allow shows the in-app explainer first; the OS is not asked until a choice is made', async () => {
    const t = await render();
    await pressId(t, 'perm-btn-location');
    expect(hasTestId(t, 'perm-explainer')).toBe(true);
    expect(hasText(t, 'Allow WeRide to use your location?')).toBe(true);
    expect(hasText(t, 'Crew tracking works best with “Always”. You can change this in Settings.')).toBe(true);
    expect(hasTestId(t, 'explainer-always')).toBe(true);
    expect(hasTestId(t, 'explainer-while')).toBe(true);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('"Allow Always" makes the real OS request with always, then shows Allowed', async () => {
    const t = await render();
    await pressId(t, 'perm-btn-location');
    await pressId(t, 'explainer-always');
    expect(mockRequest).toHaveBeenCalledWith('location', { always: true });
    expect(hasTestId(t, 'perm-explainer')).toBe(false);
    expect(byLabel(t, 'Location, always: allowed')).toBeDefined();
    expect(toasts()).toHaveLength(0);
  });

  it('"Allow While Using" requests foreground only and shows the yellow downgrade toast', async () => {
    mockAlways.mockResolvedValue(false);
    const t = await render();
    await pressId(t, 'perm-btn-location');
    await pressId(t, 'explainer-while');
    expect(mockRequest).toHaveBeenCalledWith('location', { always: false });
    expect(toasts()).toEqual([expect.objectContaining({ message: PERM_TOASTS.whileUsing, variant: 'warn' })]);
    expect(byLabel(t, 'Location, always: allowed')).toBeDefined();
  });

  it('granting "Always" that the OS only half-gave also warns that the crew loses you when the screen locks', async () => {
    mockAlways.mockResolvedValue(false);
    const t = await render();
    await pressId(t, 'perm-btn-location');
    await pressId(t, 'explainer-always');
    expect(toasts()[0].message).toContain('While using');
  });

  it('notifications and microphone use a plain Allow explainer and the real request', async () => {
    const t = await render();
    await pressId(t, 'perm-btn-notifications');
    expect(hasText(t, 'WeRide would like to send you notifications')).toBe(true);
    expect(hasTestId(t, 'explainer-while')).toBe(false);
    await pressId(t, 'explainer-allow');
    expect(mockRequest).toHaveBeenCalledWith('notifications', { always: false });
    await pressId(t, 'perm-btn-microphone');
    expect(hasText(t, 'Used only while you hold the talk button.')).toBe(true);
    await pressId(t, 'explainer-allow');
    expect(mockRequest).toHaveBeenLastCalledWith('microphone', { always: false });
  });

  it('declining the explainer shows the demo toast and asks the OS nothing', async () => {
    const t = await render();
    await pressId(t, 'perm-btn-notifications');
    await pressId(t, 'explainer-no');
    expect(mockRequest).not.toHaveBeenCalled();
    expect(toasts()).toEqual([expect.objectContaining({ message: PERM_TOASTS.denied.notifications, variant: 'warn' })]);
    await pressId(t, 'perm-btn-microphone');
    await pressId(t, 'explainer-no');
    expect(toasts()[1].message).toBe(PERM_TOASTS.denied.microphone);
    expect(PERM_TOASTS.denied.microphone).toContain('Voice stays off');
  });

  it('an OS refusal shows the yellow toast and the card stays Allow', async () => {
    mockRequest.mockResolvedValue('denied');
    const t = await render();
    await pressId(t, 'perm-btn-location');
    await pressId(t, 'explainer-always');
    expect(toasts()[0]).toEqual(expect.objectContaining({ variant: 'warn', message: PERM_TOASTS.denied.location }));
    expect(byLabel(t, 'Allow Location, always')).toBeDefined();
    expect(isDisabled(byTestId(t, 'perms-continue'))).toBe(true);
  });

  it('a permission the OS will not ask for again sends the rider to system Settings', async () => {
    mockStatus.notifications = 'blocked';
    const t = await render();
    expect(hasText(t, 'Open settings')).toBe(true);
    await pressId(t, 'perm-btn-notifications');
    expect(mockSettings).toHaveBeenCalled();
    expect(mockRequest).not.toHaveBeenCalled();
    expect(hasTestId(t, 'perm-explainer')).toBe(false);
  });

  it('an allowed card does nothing when pressed', async () => {
    mockStatus.location = 'granted';
    const t = await render();
    await pressId(t, 'perm-btn-location');
    expect(hasTestId(t, 'perm-explainer')).toBe(false);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('re-reads the statuses when the app returns to the front (back from Settings)', async () => {
    let cb: (s: string) => void = () => undefined;
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, fn: (s: string) => void) => {
      cb = fn;
      return { remove: jest.fn() };
    }) as never);
    mockStatus.notifications = 'blocked';
    const t = await render();
    expect(hasText(t, 'Open settings')).toBe(true);
    mockStatus.notifications = 'granted';
    await act(async () => { cb('active'); });
    expect(hasText(t, 'Open settings')).toBe(false);
    expect(byLabel(t, 'Notifications: allowed')).toBeDefined();
    spy.mockRestore();
  });

  it('the allowed card icon turns into a check on the accent fill', async () => {
    mockStatus.location = 'granted';
    const t = await render();
    expect(hostStyles(t).some((s) => s.backgroundColor === THEMES.demo.light.pri && s.width === 42)).toBe(true);
  });

  it('back goes back', async () => {
    const n = nav();
    const t = await render(n);
    await act(async () => { byLabel(t, 'Back').props.onPress(); });
    expect(n.goBack).toHaveBeenCalled();
  });
});
