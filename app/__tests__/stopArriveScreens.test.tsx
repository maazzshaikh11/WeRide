/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
/**
 * Stop and Arrive (the dark Road screens): all four palettes, real presence tiles, Next leg, SOS key, ready -> break over,
 * and Arrive's "Hold to end ride" order (finish -> save -> ride finished -> Recap).
 */
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaInsetsContext: require('react').createContext(null),
}));
const mockH: { ride?: (r: any) => void; presence?: (d: any[]) => void } = {};
const mockSetPresence = jest.fn().mockResolvedValue(undefined);
const mockSetStatus = jest.fn().mockResolvedValue(undefined);
const order: string[] = [];
jest.mock('../src/services/rideService', () => ({
  subscribeRide: (_id: string, cb: (r: any) => void) => { mockH.ride = cb; return jest.fn(); },
  subscribeRollCall: () => jest.fn(),
  subscribePresence: (_id: string, cb: (d: any[]) => void) => { mockH.presence = cb; return jest.fn(); },
  setPresence: (...a: unknown[]) => mockSetPresence(...a),
  setRideStatus: (...a: unknown[]) => { order.push('status'); return mockSetStatus(...a); },
  setRollCall: jest.fn(),
}));
const mockTrigger = jest.fn().mockResolvedValue(undefined);
jest.mock('../src/services/sosFlowService', () => ({ triggerSosFlow: (...a: unknown[]) => mockTrigger(...a), noteAnyFix: jest.fn() }));
const mockAddEvent = jest.fn();
const mockLog = { ride_id: 'r1', name: 'Run', km: 84, track: [], events: [] };
jest.mock('../src/services/rideRecorder', () => ({
  rideRecorder: {
    isRecording: jest.fn(() => true), rideId: jest.fn(() => 'r1'), start: jest.fn(), reset: jest.fn(),
    addEvent: (...a: unknown[]) => mockAddEvent(...a),
    snapshot: jest.fn(() => ({ km: 84, durationS: 7860, togetherPct: 92 })),
    finish: jest.fn(() => { order.push('finish'); return mockLog; }),
  },
}));
jest.mock('../src/services/rideLogService', () => ({ saveRideLog: jest.fn(() => { order.push('save'); return Promise.resolve(); }) }));
jest.mock('react-native-mmkv', () => ({ MMKV: jest.fn().mockImplementation(() => ({ getString: jest.fn(), set: jest.fn(), delete: jest.fn() })) }));
const mockReset = jest.fn();
jest.mock('../src/navigation/navigationRef', () => ({
  navigationRef: { isReady: () => true, getCurrentRoute: () => ({ name: 'Arrive' }), reset: (...a: unknown[]) => mockReset(...a) },
  navigateRoot: jest.fn(), resetRoot: jest.fn(),
}));

import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import StopScreen from '../src/screens/road/StopScreen';
import ArriveScreen, { END_HOLD_MS } from '../src/screens/road/ArriveScreen';
import { useAppStore } from '../src/store/appStore';
import { useProfileStore } from '../src/store/profileStore';
import { useOverlayStore } from '../src/store/overlayStore';
import { useRidePlanStore } from '../src/store/ridePlanStore';
import { useToastStore } from '../src/store/toastStore';
import { usePrefsStore } from '../src/store/prefsStore';
import { useCrewsStore } from '../src/store/crewsStore';
import { useRouteStore } from '@routing/client/routeStore';
import { resetRideFlow } from '../src/services/rideFlow';
import { DEFAULT_PREFS } from '../src/models/domain';
import { ThemeContext, buildTheme } from '../src/theme/ThemeProvider';
import { THEMES } from '../src/theme/palettes';

const ALL = [['demo', 'light'], ['demo', 'dark'], ['ember', 'light'], ['ember', 'dark']] as const;
const prof = (uid: string, name: string) => ({ uid, name, bike: '', style: 'Steady', stats: { km: 0, rides: 0, together_sum: 0 } }) as any;
const RIDE = {
  id: 'r1', name: 'Sunrise Ghat Run', created_by: 'lead', member_ids: ['me', 'lead', 'dev'], crew_id: null, join_code: null, ride_type: null, pace: null,
  start_time_ms: 1, status: 'live', started_ms: 1, finished_ms: null, meetup: null, ride_plan: { start: null, stops: [], destination: { label: 'Lonavala', lat: 18.75, lng: 73.4 } }, invited_ids: [], created_ms: 1,
};
const north = (m: number) => ({ lat: 18.5 + m / 111320, lng: 73.8 });
const PATH = [0, 2000, 4000].map((m) => [north(m).lat, north(m).lng]);

const mounted: ReactTestRenderer[] = [];
function mount(el: React.ReactElement, id: 'demo' | 'ember' = 'demo', scheme: 'light' | 'dark' = 'dark') {
  let t!: ReactTestRenderer;
  act(() => { t = create(<ThemeContext.Provider value={buildTheme(id, THEMES[id][scheme])}>{el}</ThemeContext.Provider>); });
  mounted.push(t);
  act(() => { mockH.ride?.(RIDE); });
  return t;
}
const texts = (t: ReactTestRenderer) => t.root.findAllByType(Text).map((n) => [n.props.children].flat(3).join(''));
const press = (t: ReactTestRenderer, label: string) => t.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
const tile = (t: ReactTestRenderer, u: string) => t.root.findAll((n) => n.props.testID === `tile-${u}` && typeof n.type === 'string')[0];
const presence = (docs: [string, string][]) => act(() => { mockH.presence?.(docs.map(([uid, state]) => ({ uid, state, updated_ms: 1 }))); });

beforeEach(() => {
  jest.clearAllMocks();
  order.length = 0;
  resetRideFlow();
  useAppStore.setState({ userId: 'me', groupId: 'r1' });
  useProfileStore.setState({ byId: { me: prof('me', 'Arjun'), lead: prof('lead', 'Meera Rao'), dev: prof('dev', 'Dev Patel') }, ensure: jest.fn() } as any);
  useOverlayStore.setState({ current: null });
  useToastStore.setState({ toasts: [] });
  useCrewsStore.setState({ crews: [] });
  usePrefsStore.setState({ prefs: { ...DEFAULT_PREFS, hold_ms: 1000 } });
  useRidePlanStore.setState({ start: null, stops: [{ id: 's1', label: 'Chai Point, Khopoli', lat: north(2000).lat, lng: north(2000).lng, icon: 'cup' }], destination: { label: 'Lonavala, MH', lat: north(4000).lat, lng: north(4000).lng } as any });
  useRouteStore.setState({ route: { route_id: 'x', path_points: PATH, distance_km: 4, eta_minutes: 40, safety_score: 1, recalculated_at_hlc: '0:0' } as any, lastValidLocation: { lat: north(2000).lat, lng: north(2000).lng } as any, activeClusters: [] });
});
afterEach(() => { mounted.splice(0).forEach((t) => act(() => t.unmount())); jest.useRealTimers(); });

describe('StopScreen', () => {
  const stop = (extra: object = {}) => <StopScreen route={{ params: { groupId: 'r1', stopId: 's1', ...extra } }} />;

  it.each(ALL)('%s/%s: dark Road screen with the stop plate, crew tiles, SOS key and the ready button', (id, scheme) => {
    const t = mount(stop(), id, scheme);
    presence([['lead', 'ready'], ['dev', 'fuel']]);
    const tx = texts(t);
    expect(tx).toContain('Chai Point'.toUpperCase());
    expect(tx).toContain('CREW ∙ 1 OF 3 READY TO ROLL');
    expect(tile(t, 'lead').props.accessibilityLabel).toBe('Meera Rao, ✓ ready');
    expect(tile(t, 'dev').props.accessibilityLabel).toBe('Dev Patel, fuelling');
    expect(tile(t, 'me').props.accessibilityLabel).toBe('You, on a break');
    expect(press(t, 'I am ready to roll')).toBeDefined();
    expect(t.root.findAll((n) => n.props.testID === 'sos-key').length).toBeGreaterThan(0);
    const root = t.root.findAll((n) => n.props.testID === 'screen-Stop' && typeof n.type === 'string')[0];
    expect(StyleSheet.flatten(root.props.style).backgroundColor).toBe(THEMES[id][scheme].road.bg);
  });

  it('the SOS / ready row sits 30 pt from the bottom (demo .ctls bottom:30), 26 in glove mode', () => {
    const bottomOf = () => {
      const t = mount(stop());
      const row = t.root.findAll((n) => typeof n.type === 'string' && StyleSheet.flatten(n.props.style)?.position === 'absolute' && StyleSheet.flatten(n.props.style)?.flexDirection === 'row')[0];
      return StyleSheet.flatten(row.props.style).bottom;
    };
    expect(bottomOf()).toBe(30);
    usePrefsStore.setState({ prefs: { ...usePrefsStore.getState().prefs, glove: true } } as any);
    expect(bottomOf()).toBe(26);
    usePrefsStore.setState({ prefs: { ...usePrefsStore.getState().prefs, glove: false } } as any);
  });

  it('writes presence "stopped" on arrival, records the stop, and shows the break timer', () => {
    jest.useFakeTimers();
    const t = mount(stop());
    expect(mockSetPresence).toHaveBeenCalledWith('r1', 'me', 'stopped');
    expect(mockAddEvent).toHaveBeenCalledWith('stop', 'Stopped at Chai Point');
    const timer = () => t.root.findAll((n) => n.props.testID === 'break-timer' && typeof n.type === 'string')[0].props.children;
    expect(timer()).toBe('00:00');
    act(() => { jest.advanceTimersByTime(65_000); });
    expect(timer()).toBe('01:05');
  });

  it('Next leg: real distance and time, and hazards on the leg; nothing invented', () => {
    useRouteStore.setState({ activeClusters: [{ cluster_id: 'h', hazard_type: 'oil_spill', centroid_lat: north(3000).lat, centroid_lng: north(3000).lng, report_count: 2, status: 'active' } as any] });
    useRidePlanStore.setState({ stops: [] });
    const t = mount(stop({ stopId: undefined }));
    const tx = texts(t);
    expect(tx).toContain('Next leg ∙ Lonavala');
    expect(tx.some((x) => /^4\.0 km ∙ 40 min$/.test(x))).toBe(true);
    expect(tx).toContain('1 hazard on the way');
    expect(tx.some((x) => /Oil at km|Dry/.test(x))).toBe(false);
  });

  it('I’m ready writes presence ready; tapping again goes back to a break; fuelling chip writes fuel', () => {
    const t = mount(stop());
    act(() => press(t, 'I am ready to roll').props.onPress());
    expect(mockSetPresence).toHaveBeenLastCalledWith('r1', 'me', 'ready');
    presence([['me', 'ready']]);
    act(() => press(t, 'Ready. Tap to cancel').props.onPress());
    expect(mockSetPresence).toHaveBeenLastCalledWith('r1', 'me', 'stopped');
    act(() => t.root.findAll((n) => n.props.testID === 'chip-fuel' && typeof n.props.onPress === 'function')[0].props.onPress());
    expect(mockSetPresence).toHaveBeenLastCalledWith('r1', 'me', 'fuel');
  });

  it('everybody ready -> the break-over countdown (rollout overlay, back to Live)', () => {
    jest.useFakeTimers();
    mount(stop());
    presence([['me', 'ready'], ['lead', 'ready'], ['dev', 'ready']]);
    expect(useOverlayStore.getState().current).toBeNull();
    act(() => { jest.advanceTimersByTime(800); });
    expect(useOverlayStore.getState().current).toEqual({ kind: 'rollout', groupId: 'r1', next: 'Live' });
  });

  it('not everybody ready: no roll-out; the lead ready sees "Roll out" and rolls on by hand', () => {
    jest.useFakeTimers();
    useAppStore.setState({ userId: 'lead' });
    const t = mount(stop());
    presence([['lead', 'ready'], ['me', 'ready']]);
    act(() => { jest.advanceTimersByTime(2000); });
    expect(useOverlayStore.getState().current).toBeNull();
    act(() => press(t, 'Roll out').props.onPress());
    expect(useOverlayStore.getState().current).toMatchObject({ kind: 'rollout', next: 'Live' });
  });

  it('the lead rolling on (ready -> riding) takes the riders who are ready', () => {
    jest.useFakeTimers();
    mount(stop());
    presence([['me', 'ready'], ['lead', 'ready']]);
    presence([['me', 'ready'], ['lead', 'riding']]);
    act(() => { jest.advanceTimersByTime(800); });
    expect(useOverlayStore.getState().current).toMatchObject({ kind: 'rollout', next: 'Live' });
  });

  it('the SOS key goes through triggerSosFlow(groupId)', () => {
    jest.useFakeTimers();
    const t = mount(stop());
    const key = t.root.findAll((n) => n.props.testID === 'sos-key' && typeof n.props.onPressIn === 'function')[0];
    act(() => key.props.onPressIn({}));
    act(() => { jest.advanceTimersByTime(1100); });
    expect(mockTrigger).toHaveBeenCalledWith('r1');
  });
});

describe('ArriveScreen', () => {
  const arrive = () => <ArriveScreen route={{ params: { groupId: 'r1' } }} />;
  const endBtn = (t: ReactTestRenderer) => t.root.findAll((n) => n.props.testID === 'end-ride' && typeof n.props.onPressIn === 'function')[0];

  it.each(ALL)('%s/%s: green plate, "Everyone home.", tiles, real stats and the end-ride button', (id, scheme) => {
    const t = mount(arrive(), id, scheme);
    presence([['lead', 'arrived']]);
    const tx = texts(t);
    expect(tx).toContain('ARRIVED');
    expect(tx.some((x) => /^Lonavala ∙ \d{1,2}:\d\d$/.test(x))).toBe(true);
    expect(tx).toContain('Everyone');
    expect(tx).toContain('home.');
    expect(tile(t, 'lead').props.accessibilityLabel).toBe('Meera Rao, ✓ home');
    expect(tile(t, 'dev').props.accessibilityLabel).toBe('Dev Patel, riding in…');
    expect(tile(t, 'me').props.accessibilityLabel).toBe('You, ✓ home');
    expect(tx.some((x) => /^84/.test(x))).toBe(true);
    expect(tx).toContain('2h 11m');
    expect(tx).toContain('92%');
    expect(tx).toContain('HOLD TO END RIDE'.charAt(0) + 'old to end ride');
    const root = t.root.findAll((n) => n.props.testID === 'screen-Arrive' && typeof n.type === 'string')[0];
    expect(StyleSheet.flatten(root.props.style).backgroundColor).toBe(THEMES[id][scheme].road.bg);
  });

  it('the end-ride button sits 30 pt from the bottom like the demo', () => {
    const t = mount(arrive());
    const wrap = t.root.findAll((n) => typeof n.type === 'string' && StyleSheet.flatten(n.props.style)?.position === 'absolute' && StyleSheet.flatten(n.props.style)?.left === 14 && StyleSheet.flatten(n.props.style)?.bottom !== undefined)[0];
    expect(StyleSheet.flatten(wrap.props.style).bottom).toBe(30);
  });

  it('writes presence "arrived" on mount', () => {
    mount(arrive());
    expect(mockSetPresence).toHaveBeenCalledWith('r1', 'me', 'arrived');
  });

  it('unknown stats show "—", never a made-up number', () => {
    const { rideRecorder } = require('../src/services/rideRecorder');
    rideRecorder.snapshot.mockReturnValue(null);
    const t = mount(arrive());
    expect(texts(t).filter((x) => x === '—').length).toBe(3);
    rideRecorder.snapshot.mockReturnValue({ km: 84, durationS: 7860, togetherPct: 92 });
  });

  it('an early release only nudges ("Hold to end the ride"); nothing is finished', () => {
    jest.useFakeTimers();
    const t = mount(arrive());
    act(() => endBtn(t).props.onPressIn({}));
    act(() => { jest.advanceTimersByTime(END_HOLD_MS - 300); });
    act(() => endBtn(t).props.onPressOut({}));
    expect(order).toEqual([]);
    expect(useToastStore.getState().toasts.map((x) => x.message)).toContain('Hold to end the ride');
  });

  it('holding 1 s: finish the recording -> save the log -> ride finished -> Garage + Recap, toast', async () => {
    jest.useFakeTimers();
    const t = mount(arrive());
    act(() => endBtn(t).props.onPressIn({}));
    await act(async () => { jest.advanceTimersByTime(END_HOLD_MS + 5); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(order).toEqual(['finish', 'save', 'status']);
    expect(mockSetStatus).toHaveBeenCalledWith('r1', 'finished');
    expect(mockReset).toHaveBeenCalledWith({ index: 1, routes: [{ name: 'GarageTabs' }, { name: 'Recap', params: { rideId: 'r1' } }] });
    expect(useToastStore.getState().toasts.map((x) => x.message)).toContain('Ride saved to your log');
  });

  it('offline (save never resolves): still ends, the log stays queued and the toast says so', async () => {
    jest.useFakeTimers();
    const { saveRideLog } = require('../src/services/rideLogService');
    saveRideLog.mockImplementationOnce(() => { order.push('save'); return new Promise(() => undefined); });
    const t = mount(arrive());
    act(() => endBtn(t).props.onPressIn({}));
    await act(async () => { jest.advanceTimersByTime(END_HOLD_MS + 5); });
    await act(async () => { await jest.advanceTimersByTimeAsync(3000); });
    expect(mockSetStatus).toHaveBeenCalledWith('r1', 'finished');
    expect(mockReset).toHaveBeenCalled();
    expect(useToastStore.getState().toasts.map((x) => x.message).join('|')).toMatch(/saved on this phone/i);
  });
});
