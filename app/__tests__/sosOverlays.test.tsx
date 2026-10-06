/**
 * The SOS overlays: SosSent (sent / queued / auto / drill, contacts, responders, cancel hold), Call112 (really dials),
 * CrashCountdown (15 s, I'm OK, send now, auto at zero) and SosIncoming (real name / distance / responders, I'm going,
 * sender cancels). Each renders under all four palettes.
 */
import React from 'react';
import { Linking, Platform, Text, Vibration } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SafeAreaInsetsContext: require('react').createContext(null),
}));
jest.mock('../src/services/rideService', () => ({ subscribeMyRides: jest.fn(() => jest.fn()) }));
const mockQueuePeek = jest.fn(() => [] as unknown[]);
jest.mock('@hazard/crdt/localQueue', () => ({ queuePeek: () => mockQueuePeek(), SOS_QUEUE: 'sos_queue' }));
jest.mock('@hazard/services/sosService', () => ({
  subscribeToSosEvents: jest.fn(() => jest.fn()),
  resolveSos: jest.fn(),
  triggerSosWithStatus: jest.fn(),
}));
const mockCancel = jest.fn();
const mockRespond = jest.fn();
const mockTriggerFlow = jest.fn();
let mockResponderCb: ((r: { uid: string; state: 'going' | 'arrived'; updated_ms: number }[]) => void) | null = null;
jest.mock('../src/services/sosFlowService', () => ({
  ...jest.requireActual('../src/services/sosFlowService'),
  cancelSos: (...a: unknown[]) => mockCancel(...a),
  respondToSos: (...a: unknown[]) => mockRespond(...a),
  triggerSosFlow: (...a: unknown[]) => mockTriggerFlow(...a),
  subscribeResponders: (_id: string, cb: typeof mockResponderCb) => {
    mockResponderCb = cb;
    return jest.fn();
  },
}));

import { useRouteStore } from '@routing/client/routeStore';
import SosSentOverlay from '../src/overlays/SosSentOverlay';
import Call112Overlay from '../src/overlays/Call112Overlay';
import CrashCountdownOverlay from '../src/overlays/CrashCountdownOverlay';
import SosIncomingOverlay from '../src/overlays/SosIncomingOverlay';
import { useSosEventsStore } from '../src/overlays/sosEventsStore';
import { useSosSessionStore } from '../src/services/sosFlowService';
import { useAppStore } from '../src/store/appStore';
import { OverlayState, useOverlayStore } from '../src/store/overlayStore';
import { usePrefsStore } from '../src/store/prefsStore';
import { useProfileStore } from '../src/store/profileStore';
import { useRidersStore } from '../src/store/ridersStore';
import { useRidesStore } from '../src/store/ridesStore';
import { useSessionStore } from '../src/store/sessionStore';
import { useToastStore } from '../src/store/toastStore';
import { DEFAULT_PREFS } from '../src/models/domain';
import { ThemeContext, buildTheme } from '../src/theme/ThemeProvider';
import { Plates, THEMES, ThemeId, Scheme } from '../src/theme/palettes';

const CASES: [ThemeId, Scheme][] = [['demo', 'dark'], ['demo', 'light'], ['ember', 'dark'], ['ember', 'light']];
const mounted: ReactTestRenderer[] = [];
function render(el: React.ReactElement, id: ThemeId = 'demo', scheme: Scheme = 'dark') {
  let t!: ReactTestRenderer;
  act(() => {
    t = create(<ThemeContext.Provider value={buildTheme(id, THEMES[id][scheme])}>{el}</ThemeContext.Provider>);
  });
  mounted.push(t);
  return t;
}
const texts = (t: ReactTestRenderer) => t.root.findAllByType(Text).map((n) => [n.props.children].flat(5).filter((c) => typeof c === 'string' || typeof c === 'number').join(''));
const has = (t: ReactTestRenderer, s: string | RegExp) => texts(t).some((x) => (typeof s === 'string' ? x === s : s.test(x)));
const byId = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => n.props.testID === id && typeof n.type !== 'string')[0] ?? t.root.findAll((n) => n.props.testID === id)[0];
const exists = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => n.props.testID === id).length > 0;
const press = (t: ReactTestRenderer, id: string) => act(() => { t.root.findAll((n) => n.props.testID === id && typeof n.props.onPress === 'function')[0].props.onPress({}); });
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const flat = (s: unknown) => Object.assign({}, ...([] as unknown[]).concat(s ?? []).flat(4).filter(Boolean)) as Record<string, any>;

const fix = (o: Record<string, unknown> = {}) => ({
  rider_id: 'me', group_id: 'g1', timestamp_hlc: '1:0', lat: 18.9718, lng: 73.3902, speed_mps: 0, heading_deg: 0,
  spoof_flag: false, nis_score: 0, accuracy_m: 4.2, ...o,
});
const SENT: OverlayState = { kind: 'sos-sent', sosId: 'sos-1', groupId: 'g1' };
const session = (o: Record<string, unknown> = {}) => ({ sosId: 'sos-1', groupId: 'g1', drill: false, auto: false, startedMs: new Date(2025, 9, 11, 18, 43, 12).getTime(), fix: { lat: 18.9718, lng: 73.3902, accuracy_m: 4.2 }, queued: false, ...o });

beforeEach(() => {
  jest.clearAllMocks();
  mockResponderCb = null;
  mockQueuePeek.mockReturnValue([]);
  useSessionStore.setState({ uid: 'me', authKnown: true });
  useAppStore.setState({ userId: 'me', groupId: 'g1' });
  useOverlayStore.setState({ current: null });
  useToastStore.setState({ toasts: [] });
  useSosSessionStore.setState({ session: session() as never });
  useSosEventsStore.setState({ events: [] });
  useRouteStore.setState({ lastValidLocation: fix() as never, currentLocation: null });
  useRidersStore.setState({ riders: new Map(), connected: true });
  useRidesStore.setState({ rides: [{ id: 'g1', member_ids: ['me', 'u2', 'u3'] } as never], loaded: true });
  useProfileStore.setState({ me: { uid: 'me', name: 'Arjun', bike: 'Duke 390', style: 'Steady', stats: { km: 0, rides: 0, together_sum: 0 } }, byId: {} });
  usePrefsStore.setState({ prefs: { ...DEFAULT_PREFS, hold_ms: 1500 }, contacts: [] });
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
});
afterEach(() => {
  mounted.splice(0).forEach((t) => act(() => t.unmount()));
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('SosSentOverlay', () => {
  it.each(CASES)('renders the sent state with the real result (%s %s)', (id, scheme) => {
    usePrefsStore.setState({ contacts: [{ id: 'c1', name: 'Mom', number: '+919800000000' }] });
    const t = render(<SosSentOverlay state={SENT} />, id, scheme);
    expect(has(t, 'SOS SENT')).toBe(true);
    expect(has(t, 'HELP IS COMING')).toBe(true);
    expect(has(t, '6:43:12 ∙ 18.9718° N 73.3902° E ∙ ±4 m')).toBe(true);
    expect(has(t, 'Crew alerted')).toBe(true);
    expect(has(t, 'Sent to 2 crew')).toBe(true); // 3 ride members - me
    expect(has(t, 'Live location on')).toBe(true);
    expect(has(t, 'Your crew sees you move')).toBe(true);
    expect(has(t, 'Finding the nearest rider')).toBe(true);
    expect(exists(t, 'sos-offline-plate')).toBe(false);
    expect(flat(byId(t, 'overlay-SosSent').props.style).backgroundColor).toBe(Plates.red.bg);
  });

  it('queued (no signal): SOS SAVED, the yellow queued plate, "Queued on this phone"', () => {
    useSosSessionStore.setState({ session: session({ queued: true }) as never });
    const t = render(<SosSentOverlay state={SENT} />);
    expect(has(t, 'SOS SAVED')).toBe(true);
    expect(has(t, 'NO SIGNAL ∙ QUEUED')).toBe(true);
    expect(has(t, 'Queued on this phone')).toBe(true);
    expect(has(t, /Saved on this phone/)).toBe(true);
    expect(has(t, 'Sent to 2 crew')).toBe(false);
  });

  it('queued: compact rows and the 30 pt button stack leave room for all four rows above Call 112', () => {
    useSosSessionStore.setState({ session: session({ queued: true }) as never });
    usePrefsStore.setState({ contacts: [{ id: 'c1', name: 'Mom', number: '+919800000000' }] });
    const t = render(<SosSentOverlay state={SENT} />);
    for (const id of ['sos-row-crew', 'sos-text-c1', 'sos-row-live', 'sos-row-responder']) {
      expect(exists(t, id)).toBe(true);
      expect(flat(t.root.findAll((n) => n.props.testID === id && typeof n.type === 'string')[0].props.style).paddingVertical).toBe(10);
    }
    const stack = t.root.findAll((n) => typeof n.type === 'string' && flat(n.props.style).bottom === 30 && flat(n.props.style).gap === 10);
    expect(stack.length).toBeGreaterThan(0);
    expect(exists(t, 'sos-call112')).toBe(true);
  });

  it('a queued SOS that leaves the queue flips to SOS SENT with a "Signal back" toast', () => {
    jest.useFakeTimers();
    useSosSessionStore.setState({ session: session({ queued: true }) as never });
    mockQueuePeek.mockReturnValue([{ type: 'sos_event', data: { sos_id: 'sos-1' } }]);
    const t = render(<SosSentOverlay state={SENT} />);
    act(() => { jest.advanceTimersByTime(1600); });
    expect(has(t, 'SOS SAVED')).toBe(true); // still waiting
    mockQueuePeek.mockReturnValue([]);
    act(() => { jest.advanceTimersByTime(1600); });
    expect(has(t, 'SOS SENT')).toBe(true);
    expect(has(t, 'Signal back ∙ SOS delivered')).toBe(true);
    expect(useSosSessionStore.getState().session?.queued).toBe(false);
  });

  it('crash auto-send header', () => {
    useSosSessionStore.setState({ session: session({ auto: true }) as never });
    const t = render(<SosSentOverlay state={{ ...SENT, auto: true }} />);
    expect(has(t, 'CRASH DETECTED ∙ SENT AUTOMATICALLY')).toBe(true);
  });

  it('no GPS fix: says so honestly', () => {
    useSosSessionStore.setState({ session: session({ fix: null }) as never });
    const t = render(<SosSentOverlay state={SENT} />);
    expect(has(t, '6:43:12 ∙ No GPS fix yet')).toBe(true);
  });

  it('no emergency contacts: "Add an emergency contact in Me"', () => {
    const t = render(<SosSentOverlay state={SENT} />);
    expect(has(t, 'Add an emergency contact in Me')).toBe(true);
  });

  it('one "Text <name>" row per real contact; tapping opens the SMS composer with the location text', () => {
    usePrefsStore.setState({ contacts: [{ id: 'c1', name: 'Mom', number: '+919800000000' }, { id: 'c2', name: 'Dad', number: '9811111111' }] });
    const t = render(<SosSentOverlay state={SENT} />);
    expect(has(t, 'Text Mom')).toBe(true);
    expect(has(t, 'Text Dad')).toBe(true);
    expect(has(t, '+919800000000')).toBe(true);
    expect(has(t, 'Opens your messages — we can’t send SMS for you')).toBe(true);
    press(t, 'sos-text-c1');
    const url = (Linking.openURL as jest.Mock).mock.calls[0][0] as string;
    expect(url.startsWith('sms:+919800000000?body=')).toBe(true);
    expect(decodeURIComponent(url.split('?body=')[1])).toBe('Arjun needs help. Live location: https://maps.google.com/?q=18.9718,73.3902 — sent by WeRide SOS.');
  });

  it('SMS composer failing to open is reported, not swallowed', async () => {
    usePrefsStore.setState({ contacts: [{ id: 'c1', name: 'Mom', number: '+919800000000' }] });
    (Linking.openURL as jest.Mock).mockRejectedValue(new Error('no app'));
    const t = render(<SosSentOverlay state={SENT} />);
    press(t, 'sos-text-c1');
    await flush();
    expect(has(t, 'Couldn’t open your messages')).toBe(true);
  });

  it('responders: "Meera is coming to you" with her REAL distance and "N also responding"', () => {
    useProfileStore.setState({ byId: { u2: { uid: 'u2', name: 'Meera', bike: '', style: 'Steady', stats: { km: 0, rides: 0, together_sum: 0 } } } as never });
    useRidersStore.setState({
      riders: new Map([['u2', { location: fix({ rider_id: 'u2', lat: 18.9718, lng: 73.4082, speed_mps: 0 }), receivedAt: 0, markerState: 'live' }]]) as never,
    });
    const t = render(<SosSentOverlay state={SENT} />);
    expect(has(t, 'Finding the nearest rider')).toBe(true);
    act(() => mockResponderCb!([{ uid: 'u2', state: 'going', updated_ms: 1 }, { uid: 'u3', state: 'going', updated_ms: 2 }]));
    expect(has(t, 'Meera is coming to you')).toBe(true);
    expect(has(t, '1.9 km ∙ 1 also responding')).toBe(true);
    act(() => mockResponderCb!([{ uid: 'u2', state: 'arrived', updated_ms: 3 }]));
    expect(has(t, 'Meera is with you')).toBe(true);
  });

  it('live location row waits for tracking: no fix yet shows "Starting…"', () => {
    useRouteStore.setState({ lastValidLocation: null, currentLocation: null });
    const t = render(<SosSentOverlay state={SENT} />);
    expect(has(t, 'Starting…')).toBe(true);
  });

  it('Call 112 opens the call screen and remembers this one to come back to', () => {
    const t = render(<SosSentOverlay state={SENT} />);
    press(t, 'sos-call112');
    expect(useOverlayStore.getState().current).toEqual({ kind: 'call112', back: SENT });
  });

  it('"I\'m OK": early release does nothing but explain; a full 2 s hold cancels the real SOS, shows the green plate, then closes', async () => {
    jest.useFakeTimers();
    mockCancel.mockResolvedValue(undefined);
    useOverlayStore.setState({ current: SENT });
    const t = render(<SosSentOverlay state={SENT} />);
    const hold = () => t.root.findAll((n) => n.props.testID === 'sos-cancel-hold' && typeof n.props.onPressIn === 'function')[0];
    expect(has(t, 'I’m OK ∙ hold 2 s to cancel')).toBe(true);
    act(() => hold().props.onPressIn({}));
    act(() => { jest.advanceTimersByTime(900); });
    act(() => hold().props.onPressOut({}));
    expect(has(t, /Hold 2 s to cancel/)).toBe(true);
    act(() => { jest.advanceTimersByTime(2500); });
    expect(mockCancel).not.toHaveBeenCalled();

    act(() => hold().props.onPressIn({}));
    await act(async () => { jest.advanceTimersByTime(2050); });
    expect(mockCancel).toHaveBeenCalledWith('sos-1', 'g1');
    expect(has(t, 'SOS CANCELLED')).toBe(true);
    expect(has(t, 'Your crew was told: false alarm.')).toBe(true);
    expect(useOverlayStore.getState().current).not.toBeNull();
    act(() => { jest.advanceTimersByTime(1800); });
    expect(useOverlayStore.getState().current).toBeNull();
  });

  it('cancelling a queued SOS says it is saved on the phone', async () => {
    jest.useFakeTimers();
    mockCancel.mockResolvedValue(undefined);
    useSosSessionStore.setState({ session: session({ queued: true }) as never });
    const t = render(<SosSentOverlay state={SENT} />);
    const hold = t.root.findAll((n) => n.props.testID === 'sos-cancel-hold' && typeof n.props.onPressIn === 'function')[0];
    act(() => hold.props.onPressIn({}));
    await act(async () => { jest.advanceTimersByTime(2050); });
    expect(has(t, /Saved on this phone\. Your crew is told when you have signal/)).toBe(true);
  });

  it('a failed cancel keeps the SOS screen and tells the rider', async () => {
    jest.useFakeTimers();
    mockCancel.mockRejectedValue(new Error('x'));
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const t = render(<SosSentOverlay state={SENT} />);
    const hold = t.root.findAll((n) => n.props.testID === 'sos-cancel-hold' && typeof n.props.onPressIn === 'function')[0];
    act(() => hold.props.onPressIn({}));
    await act(async () => { jest.advanceTimersByTime(2050); });
    expect(has(t, 'SOS SENT')).toBe(true);
    expect(useToastStore.getState().toasts[0]).toMatchObject({ variant: 'error' });
  });

  describe('drill', () => {
    const DRILL: OverlayState = { kind: 'sos-sent', groupId: 'g1', drill: true };
    beforeEach(() => useSosSessionStore.setState({ session: session({ sosId: undefined, drill: true }) as never }));

    it.each(CASES)('banner, PRACTICE, nothing is sent (%s %s)', (id, scheme) => {
      const t = render(<SosSentOverlay state={DRILL} />, id, scheme);
      expect(exists(t, 'sos-drill-banner')).toBe(true);
      expect(has(t, 'DRILL ∙ NOBODY IS ALERTED')).toBe(true);
      expect(has(t, 'PRACTICE')).toBe(true);
      expect(has(t, 'Crew would be alerted')).toBe(true);
      expect(has(t, 'End drill')).toBe(true);
      expect(exists(t, 'sos-cancel-hold')).toBe(false);
      expect(mockResponderCb).toBeNull(); // no responders watched for a drill
    });

    it('End drill shows "Drill complete" with the time taken, cancels nothing, then closes', () => {
      jest.useFakeTimers();
      useOverlayStore.setState({ current: DRILL });
      const t = render(<SosSentOverlay state={DRILL} />);
      press(t, 'sos-end-drill');
      expect(has(t, 'DRILL COMPLETE')).toBe(true);
      expect(has(t, 'Time to send: 1.5 s. Nobody was alerted.')).toBe(true);
      expect(mockCancel).not.toHaveBeenCalled();
      act(() => { jest.advanceTimersByTime(1800); });
      expect(useOverlayStore.getState().current).toBeNull();
    });
  });

  it('ignores other overlay kinds', () => {
    const t = render(<SosSentOverlay state={{ kind: 'crash' }} />);
    expect(t.toJSON()).toBeNull();
  });
});

describe('Call112Overlay', () => {
  it.each(CASES)('dials 112 on mount and shows the call screen (%s %s)', (id, scheme) => {
    const t = render(<Call112Overlay state={{ kind: 'call112' }} />, id, scheme);
    expect(Linking.openURL).toHaveBeenCalledWith('tel:112');
    expect(has(t, 'Calling 112')).toBe(true);
    expect(has(t, '112')).toBe(true);
    expect(has(t, 'End call')).toBe(true);
    expect(has(t, 'You are at 18.9718° N 73.3902° E')).toBe(true);
    expect(byId(t, 'call112-end').props.accessibilityLabel).toBe('End call');
  });

  it('tapping the 112 disc dials again', () => {
    const t = render(<Call112Overlay state={{ kind: 'call112' }} />);
    press(t, 'call112-dial');
    expect(Linking.openURL).toHaveBeenCalledTimes(2);
  });

  it('a dialler that will not open is said out loud', async () => {
    (Linking.openURL as jest.Mock).mockRejectedValue(new Error('no dialler'));
    const t = render(<Call112Overlay state={{ kind: 'call112' }} />);
    await flush();
    expect(has(t, 'Couldn’t open the dialler. Dial 112 yourself.')).toBe(true);
  });

  it('End call returns to the screen it was opened from', () => {
    useOverlayStore.setState({ current: { kind: 'call112', back: SENT } });
    const t = render(<Call112Overlay state={{ kind: 'call112', back: SENT }} />);
    press(t, 'call112-end');
    expect(useOverlayStore.getState().current).toEqual(SENT);
  });

  it('End call with nowhere to go back to just closes', () => {
    useOverlayStore.setState({ current: { kind: 'call112' } });
    const t = render(<Call112Overlay state={{ kind: 'call112' }} />);
    press(t, 'call112-end');
    expect(useOverlayStore.getState().current).toBeNull();
  });

  it('without a fix there is no coordinates line', () => {
    useRouteStore.setState({ lastValidLocation: null, currentLocation: null });
    const t = render(<Call112Overlay state={{ kind: 'call112' }} />);
    expect(exists(t, 'call112-where')).toBe(false);
  });
});

describe('CrashCountdownOverlay', () => {
  const CRASH: OverlayState = { kind: 'crash' };
  beforeEach(() => jest.useFakeTimers());

  it.each(CASES)('yellow "Are you OK?" with a 15 s countdown (%s %s)', (id, scheme) => {
    const t = render(<CrashCountdownOverlay state={CRASH} />, id, scheme);
    expect(has(t, 'HARD IMPACT DETECTED')).toBe(true);
    expect(has(t, 'Are you\nOK?')).toBe(true);
    expect(has(t, '15')).toBe(true);
    expect(has(t, 'SOS sends itself when this hits zero.')).toBe(true);
    expect(flat(byId(t, 'overlay-CrashCountdown').props.style).backgroundColor).toBe(Plates.yellow.bg);
    expect(byId(t, 'crash-ok').props.accessibilityLabel).toMatch(/I’m OK/);
    expect(byId(t, 'crash-sos').props.accessibilityLabel).toBe('Send SOS now');
  });

  it('counts down once a second', () => {
    const t = render(<CrashCountdownOverlay state={CRASH} />);
    act(() => { jest.advanceTimersByTime(3000); });
    expect(has(t, '12')).toBe(true);
    expect(mockTriggerFlow).not.toHaveBeenCalled();
  });

  it('I\'m OK: closes, nothing is sent, and the toast says the crew was never alerted', () => {
    useOverlayStore.setState({ current: CRASH });
    const t = render(<CrashCountdownOverlay state={CRASH} />);
    act(() => { jest.advanceTimersByTime(4000); });
    press(t, 'crash-ok');
    expect(useOverlayStore.getState().current).toBeNull();
    expect(useToastStore.getState().toasts[0]).toMatchObject({ message: 'Glad you’re OK ∙ Crew was never alerted', variant: 'success' });
    act(() => { jest.advanceTimersByTime(30_000); });
    expect(mockTriggerFlow).not.toHaveBeenCalled();
  });

  it('Send SOS now sends straight away (not flagged automatic) and stops the countdown', () => {
    mockTriggerFlow.mockResolvedValue(undefined);
    const t = render(<CrashCountdownOverlay state={CRASH} />);
    act(() => { jest.advanceTimersByTime(2000); });
    press(t, 'crash-sos');
    expect(mockTriggerFlow).toHaveBeenCalledWith('g1', { auto: false });
    act(() => { jest.advanceTimersByTime(30_000); });
    expect(mockTriggerFlow).toHaveBeenCalledTimes(1);
    expect(has(t, 'Sending your SOS…')).toBe(true);
  });

  it('at zero the SOS sends itself, flagged automatic, exactly once', () => {
    mockTriggerFlow.mockResolvedValue(undefined);
    render(<CrashCountdownOverlay state={CRASH} />);
    act(() => { jest.advanceTimersByTime(14_000); });
    expect(mockTriggerFlow).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(1100); });
    expect(mockTriggerFlow).toHaveBeenCalledWith('g1', { auto: true });
    act(() => { jest.advanceTimersByTime(20_000); });
    expect(mockTriggerFlow).toHaveBeenCalledTimes(1);
  });

  it('ticks with a haptic each second', () => {
    const original = Platform.OS;
    (Platform as { OS: string }).OS = 'android';
    const vibrate = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => undefined);
    render(<CrashCountdownOverlay state={CRASH} />);
    vibrate.mockClear();
    act(() => { jest.advanceTimersByTime(3000); });
    expect(vibrate).toHaveBeenCalledTimes(3);
    (Platform as { OS: string }).OS = original;
  });

  it('without a ride there is nobody to alert: it closes and says so', () => {
    useAppStore.setState({ groupId: null });
    useOverlayStore.setState({ current: CRASH });
    const t = render(<CrashCountdownOverlay state={CRASH} />);
    press(t, 'crash-sos');
    expect(mockTriggerFlow).not.toHaveBeenCalled();
    expect(useOverlayStore.getState().current).toBeNull();
    expect(useToastStore.getState().toasts[0].variant).toBe('warn');
  });
});

describe('SosIncomingOverlay', () => {
  const NOW = 1_800_000_000_000;
  const INC: OverlayState = { kind: 'sos-incoming', sosId: 'sos-9', riderId: 'kab', groupId: 'g1', lat: 18.9718, lng: 73.3902 - 0.0126, startedMs: NOW - 8000 };
  const kabir = { uid: 'kab', name: 'Kabir', bike: 'Himalayan 411', style: 'Steady', stats: { km: 0, rides: 0, together_sum: 0 } };
  const meera = { uid: 'u2', name: 'Meera', bike: 'Duke 390', style: 'Steady', stats: { km: 0, rides: 0, together_sum: 0 } };
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    useProfileStore.setState({ byId: { kab: kabir, u2: meera } as never, ensure: jest.fn(() => Promise.resolve()) } as never);
    // I am riding east at 12 m/s, Kabir is ~1.3 km west of me = behind me.
    useRouteStore.setState({ lastValidLocation: fix({ lat: 18.9718, lng: 73.3902, heading_deg: 90, speed_mps: 12 }) as never });
    useSosEventsStore.setState({ events: [{ sos_id: 'sos-9', rider_id: 'kab', group_id: 'g1', lat: 18.9718, lng: 73.3776, created_at_hlc: `${NOW}:0` }] });
  });

  it.each(CASES)('red screen with the real name, bike and distance behind you (%s %s)', (id, scheme) => {
    const t = render(<SosIncomingOverlay state={INC} />, id, scheme);
    expect(has(t, 'KABIR\nNEEDS HELP')).toBe(true);
    expect(has(t, 'SOS ∙ 8 S AGO')).toBe(true);
    expect(has(t, '1.3 km behind you')).toBe(true);
    expect(has(t, ' ∙ Himalayan 411')).toBe(true);
    expect(exists(t, 'sosin-map')).toBe(true);
    expect(has(t, 'No one has responded yet')).toBe(true);
    expect(has(t, 'I’m going')).toBe(true);
    expect(has(t, 'Call 112')).toBe(true);
    expect(flat(byId(t, 'overlay-SosIncoming').props.style).backgroundColor).toBe(Plates.red.bg);
  });

  it('never offers to call the rider (numbers are private)', () => {
    const t = render(<SosIncomingOverlay state={INC} />);
    expect(texts(t).some((x) => /Call Kabir/i.test(x))).toBe(false);
  });

  it('"ahead of you" when he is in front; "away" when I am not moving; honest when his location is unknown', () => {
    useRouteStore.setState({ lastValidLocation: fix({ lat: 18.9718, lng: 73.3902, heading_deg: 270, speed_mps: 12 }) as never });
    let t = render(<SosIncomingOverlay state={INC} />);
    expect(texts(t).some((x) => /ahead of you/.test(x))).toBe(true);
    useRouteStore.setState({ lastValidLocation: fix({ speed_mps: 0 }) as never });
    t = render(<SosIncomingOverlay state={INC} />);
    expect(texts(t).some((x) => /^1\.3 km away/.test(x))).toBe(true);
    t = render(<SosIncomingOverlay state={{ ...INC, lat: 0, lng: 0 } as OverlayState} />);
    expect(has(t, /Location not shared yet/)).toBe(true);
    expect(exists(t, 'sosin-map')).toBe(false);
  });

  it('unknown rider name is never invented', () => {
    useProfileStore.setState({ byId: {} });
    const t = render(<SosIncomingOverlay state={INC} />);
    expect(has(t, 'RIDER KAB\nNEEDS HELP')).toBe(true);
  });

  it('lists the real responders with distances', () => {
    useRidersStore.setState({
      riders: new Map([['u2', { location: fix({ rider_id: 'u2', lat: 18.9718, lng: 73.3776 + 0.0054 }), receivedAt: 0, markerState: 'live' }]]) as never,
    });
    const t = render(<SosIncomingOverlay state={INC} />);
    act(() => mockResponderCb!([{ uid: 'u2', state: 'going', updated_ms: 1 }]));
    expect(has(t, 'Meera')).toBe(true);
    expect(texts(t).some((x) => /^570 m ∙ responding$/.test(x))).toBe(true);
    expect(has(t, 'No one has responded yet')).toBe(false);
  });

  it('"I\'m going" writes responders/me=going, shows my row, then "I\'m with Kabir" writes arrived and closes', async () => {
    mockRespond.mockResolvedValue(undefined);
    useOverlayStore.setState({ current: INC });
    const t = render(<SosIncomingOverlay state={INC} />);
    press(t, 'sosin-going');
    await act(async () => { await Promise.resolve(); });
    expect(mockRespond).toHaveBeenCalledWith('sos-9', 'me', 'going');
    expect(exists(t, 'sosin-you')).toBe(true);
    expect(has(t, 'You')).toBe(true);
    expect(texts(t).some((x) => /^1\.3 km ∙ going$/.test(x))).toBe(true);
    expect(has(t, 'Crew sees you responding')).toBe(true);
    // the toast sits above the buttons, not over the headline at the top
    const toast = flat(t.root.findAll((n) => n.props.testID === 'overlay-toast')[0].props.style);
    expect(toast.top).toBeUndefined();
    expect(toast.bottom).toBe(30 + 150 + 12);
    expect(has(t, 'I’m with Kabir')).toBe(true);
    expect(exists(t, 'sosin-going')).toBe(false);

    press(t, 'sosin-arrived');
    expect(mockRespond).toHaveBeenLastCalledWith('sos-9', 'me', 'arrived');
    expect(useOverlayStore.getState().current).toBeNull();
  });

  it('a failed "I\'m going" write rolls back and says so', async () => {
    mockRespond.mockRejectedValue(new Error('offline'));
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const t = render(<SosIncomingOverlay state={INC} />);
    press(t, 'sosin-going');
    await flush();
    expect(exists(t, 'sosin-going')).toBe(true);
    expect(has(t, 'Couldn’t tell the crew. Try again.')).toBe(true);
  });

  it('Call 112 opens the call screen and remembers this one', () => {
    const t = render(<SosIncomingOverlay state={INC} />);
    press(t, 'sosin-call112');
    expect(useOverlayStore.getState().current).toEqual({ kind: 'call112', back: INC });
  });

  it('"Not now" closes it', () => {
    useOverlayStore.setState({ current: INC });
    const t = render(<SosIncomingOverlay state={INC} />);
    press(t, 'sosin-dismiss');
    expect(useOverlayStore.getState().current).toBeNull();
  });

  it('when the sender resolves the SOS: closes with the green "False alarm" toast', () => {
    useOverlayStore.setState({ current: INC });
    render(<SosIncomingOverlay state={INC} />);
    expect(useOverlayStore.getState().current).not.toBeNull();
    act(() => useSosEventsStore.setState({ events: [] }));
    expect(useOverlayStore.getState().current).toBeNull();
    expect(useToastStore.getState().toasts[0]).toMatchObject({ message: 'Kabir cancelled the SOS — False alarm', variant: 'success' });
  });

  it('does NOT close just because the event list had not synced yet (never seen active)', () => {
    useSosEventsStore.setState({ events: [] });
    useOverlayStore.setState({ current: INC });
    render(<SosIncomingOverlay state={INC} />);
    expect(useOverlayStore.getState().current).toEqual(INC);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});

describe('OverlayToast placement', () => {
  it('sits below the status bar by default, or above the bottom edge when asked', () => {
    const T = require('../src/overlays/OverlayToast').default; // eslint-disable-line @typescript-eslint/no-require-imports
    const top = render(<T toast={{ message: 'Hi', tone: 'black' }} />);
    expect(flat(top.root.findAll((n) => n.props.testID === 'overlay-toast')[0].props.style).top).toBeGreaterThan(0);
    const bottom = render(<T toast={{ message: 'Hi', tone: 'black' }} bottom={192} />);
    const st = flat(bottom.root.findAll((n) => n.props.testID === 'overlay-toast')[0].props.style);
    expect(st.bottom).toBe(192);
    expect(st.top).toBeUndefined();
    expect(render(<T toast={null} />).toJSON()).toBeNull();
  });
});
