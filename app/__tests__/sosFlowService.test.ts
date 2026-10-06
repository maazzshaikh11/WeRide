/**
 * sosFlowService: sent vs queued (the real service's result), the no-fix path, drill sends nothing,
 * position fallbacks, cancel, responders, and the one-at-a-time guard.
 */
const mockTrigger = jest.fn();
const mockResolve = jest.fn();
jest.mock('@hazard/services/sosService', () => ({
  triggerSosWithStatus: (...a: unknown[]) => mockTrigger(...a),
  resolveSos: (...a: unknown[]) => mockResolve(...a),
}));

const mockSet = jest.fn();
const mockOnSnapshot = jest.fn();
const mockCollection = jest.fn();
const mockDoc = jest.fn();
jest.mock('@react-native-firebase/firestore', () => ({
  __esModule: true,
  default: () => ({
    doc: (...a: unknown[]) => (mockDoc(...a), { set: (...b: unknown[]) => mockSet(...b) }),
    collection: (...a: unknown[]) => (mockCollection(...a), { onSnapshot: (...b: unknown[]) => mockOnSnapshot(...b) }),
  }),
}));

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore no type declarations for this package in the app context
import Geolocation from 'react-native-geolocation-service';
import { useRouteStore } from '@routing/client/routeStore';
import {
  bestKnownFix, cancelSos, noteAnyFix, respondToSos, sendSos, subscribeResponders, triggerSosFlow, useSosSessionStore,
} from '../src/services/sosFlowService';
import { useAppStore } from '../src/store/appStore';
import { useOverlayStore } from '../src/store/overlayStore';
import { useSessionStore } from '../src/store/sessionStore';
import { useToastStore } from '../src/store/toastStore';

const fix = (o: Record<string, unknown> = {}) => ({
  rider_id: 'me', group_id: 'g1', timestamp_hlc: '1:0', lat: 18.9718, lng: 73.3902, speed_mps: 0, heading_deg: 0,
  spoof_flag: false, nis_score: 0, accuracy_m: 4, ...o,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  noteAnyFix(null);
  useRouteStore.setState({ lastValidLocation: null, currentLocation: null });
  useSessionStore.setState({ uid: 'me', authKnown: true });
  useAppStore.setState({ userId: 'me', groupId: 'g1' });
  useOverlayStore.setState({ current: null });
  useToastStore.setState({ toasts: [] });
  useSosSessionStore.setState({ session: null });
  mockTrigger.mockResolvedValue({ sosId: 'sos-1', queued: false });
  (Geolocation.getCurrentPosition as jest.Mock).mockImplementation((_ok: unknown, err: (e: unknown) => void) => err({ code: 2 }));
});

describe('bestKnownFix', () => {
  it('prefers the last valid fix, with its accuracy', async () => {
    useRouteStore.setState({ lastValidLocation: fix() as never, currentLocation: fix({ lat: 1, lng: 2 }) as never });
    noteAnyFix({ lat: 5, lng: 6 });
    expect(await bestKnownFix()).toEqual({ lat: 18.9718, lng: 73.3902, accuracy_m: 4 });
  });
  it('falls back to the last fix of any quality, then the current location', async () => {
    noteAnyFix({ lat: 5, lng: 6, accuracy_m: 300 });
    expect(await bestKnownFix()).toMatchObject({ lat: 5, lng: 6, accuracy_m: 300 });
    noteAnyFix(null);
    useRouteStore.setState({ currentLocation: fix({ lat: 7, lng: 8, accuracy_m: 90 }) as never });
    expect(await bestKnownFix()).toMatchObject({ lat: 7, lng: 8, accuracy_m: 90 });
  });
  it('last resort: the OS position; none at all -> null', async () => {
    (Geolocation.getCurrentPosition as jest.Mock).mockImplementation((ok: (p: unknown) => void) => ok({ coords: { latitude: 11, longitude: 12, accuracy: 25 } }));
    expect(await bestKnownFix()).toEqual({ lat: 11, lng: 12, accuracy_m: 25 });
    (Geolocation.getCurrentPosition as jest.Mock).mockImplementation((_ok: unknown, err: () => void) => err());
    expect(await bestKnownFix()).toBeNull();
  });
  it('a (0,0) placeholder is not a fix', async () => {
    useRouteStore.setState({ lastValidLocation: fix({ lat: 0, lng: 0 }) as never });
    expect(await bestKnownFix()).toBeNull();
  });
  it('gives up on a silent OS after 3 s', async () => {
    jest.useFakeTimers();
    (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(() => undefined);
    const p = bestKnownFix();
    await jest.advanceTimersByTimeAsync(3100);
    expect(await p).toBeNull();
  });
});

describe('sendSos', () => {
  it('online: calls the real service with my uid, the ride and the position, and reports queued=false', async () => {
    useRouteStore.setState({ lastValidLocation: fix() as never });
    const res = await sendSos({ groupId: 'g1' });
    expect(mockTrigger).toHaveBeenCalledWith('me', 'g1', 18.9718, 73.3902);
    expect(res).toEqual({ sosId: 'sos-1', queued: false });
    expect(useSosSessionStore.getState().session).toMatchObject({ sosId: 'sos-1', queued: false, drill: false, auto: false, fix: { lat: 18.9718, lng: 73.3902, accuracy_m: 4 } });
  });
  it('offline: the service says queued and the result carries it', async () => {
    mockTrigger.mockResolvedValue({ sosId: 'sos-2', queued: true });
    useRouteStore.setState({ lastValidLocation: fix() as never });
    expect(await sendSos({ groupId: 'g1', auto: true })).toEqual({ sosId: 'sos-2', queued: true });
    expect(useSosSessionStore.getState().session).toMatchObject({ queued: true, auto: true });
  });
  it('no position at all: still sends/queues (at 0,0 = "no GPS fix yet") and the session says fix: null', async () => {
    const res = await sendSos({ groupId: 'g1' });
    expect(mockTrigger).toHaveBeenCalledWith('me', 'g1', 0, 0);
    expect(res?.sosId).toBe('sos-1');
    expect(useSosSessionStore.getState().session?.fix).toBeNull();
  });
  it('drill sends nothing', async () => {
    useRouteStore.setState({ lastValidLocation: fix() as never });
    expect(await sendSos({ groupId: 'g1', drill: true })).toBeNull();
    expect(mockTrigger).not.toHaveBeenCalled();
    expect(useSosSessionStore.getState().session).toMatchObject({ drill: true, fix: { lat: 18.9718 } });
    expect(useSosSessionStore.getState().session?.sosId).toBeUndefined();
  });
  it('null when it could not even be saved, or when signed out', async () => {
    mockTrigger.mockRejectedValue(new Error('disk full'));
    const err = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await sendSos({ groupId: 'g1' })).toBeNull();
    err.mockRestore();
    useSessionStore.setState({ uid: null });
    useAppStore.setState({ userId: null });
    mockTrigger.mockClear();
    expect(await sendSos({ groupId: 'g1' })).toBeNull();
    expect(mockTrigger).not.toHaveBeenCalled();
  });
});

describe('triggerSosFlow', () => {
  it('sends, then raises the red overlay with the real sos id', async () => {
    useRouteStore.setState({ lastValidLocation: fix() as never });
    await triggerSosFlow('g1');
    expect(mockTrigger).toHaveBeenCalledTimes(1);
    expect(useOverlayStore.getState().current).toEqual({ kind: 'sos-sent', sosId: 'sos-1', groupId: 'g1', drill: false, auto: false });
  });
  it('auto flag is passed to the overlay', async () => {
    await triggerSosFlow('g1', { auto: true });
    expect(useOverlayStore.getState().current).toMatchObject({ kind: 'sos-sent', auto: true, drill: false });
  });
  it('drill: nothing sent, overlay raised with drill', async () => {
    await triggerSosFlow('g1', { drill: true });
    expect(mockTrigger).not.toHaveBeenCalled();
    expect(useOverlayStore.getState().current).toEqual({ kind: 'sos-sent', sosId: undefined, groupId: 'g1', drill: true, auto: false });
  });
  it('if it cannot be saved: red toast, no "SOS SENT" screen', async () => {
    mockTrigger.mockRejectedValue(new Error('boom'));
    const err = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await triggerSosFlow('g1');
    err.mockRestore();
    expect(useOverlayStore.getState().current).toBeNull();
    expect(useToastStore.getState().toasts[0]).toMatchObject({ variant: 'error' });
    expect(useToastStore.getState().toasts[0].message).toMatch(/112/);
  });
  it('one SOS at a time: a second call while the SOS screen is up is ignored', async () => {
    await triggerSosFlow('g1');
    await triggerSosFlow('g1');
    expect(mockTrigger).toHaveBeenCalledTimes(1);
  });
  it('one SOS at a time: two simultaneous calls send once', async () => {
    await Promise.all([triggerSosFlow('g1'), triggerSosFlow('g1')]);
    expect(mockTrigger).toHaveBeenCalledTimes(1);
  });
});

describe('cancel + responders', () => {
  it('cancelSos resolves through the real service', async () => {
    await cancelSos('sos-1', 'g1');
    expect(mockResolve).toHaveBeenCalledWith('sos-1', 'g1');
  });
  it('respondToSos writes sos_events/{id}/responders/{uid}', async () => {
    await respondToSos('sos-1', 'u2', 'going');
    expect(mockDoc).toHaveBeenCalledWith('sos_events/sos-1/responders/u2');
    expect(mockSet).toHaveBeenCalledWith({ state: 'going', updated_ms: expect.any(Number) }, { merge: true });
  });
  it('subscribeResponders maps docs, ignores malformed ones, and returns the unsubscribe', () => {
    const unsub = jest.fn();
    mockOnSnapshot.mockImplementation((ok: (s: unknown) => void) => {
      ok({ docs: [
        { id: 'a', data: () => ({ state: 'going', updated_ms: 5 }) },
        { id: 'b', data: () => ({ state: 'arrived', updated_ms: 9 }) },
        { id: 'c', data: () => ({ state: 'lost' }) },
      ] });
      return unsub;
    });
    const on = jest.fn();
    const off = subscribeResponders('sos-1', on);
    expect(mockCollection).toHaveBeenCalledWith('sos_events/sos-1/responders');
    expect(on).toHaveBeenCalledWith([{ uid: 'a', state: 'going', updated_ms: 5 }, { uid: 'b', state: 'arrived', updated_ms: 9 }]);
    off();
    expect(unsub).toHaveBeenCalled();
  });
});
