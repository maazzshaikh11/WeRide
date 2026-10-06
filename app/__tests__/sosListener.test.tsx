/** SosListener: the pure decision, and the mounted listener raising the incoming-SOS overlay once per event. */
import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';

let mockCb: ((e: unknown[]) => void) | null = null;
const mockUnsub = jest.fn();
const mockSubscribe = jest.fn((_g: string, cb: (e: unknown[]) => void) => {
  mockCb = cb;
  return mockUnsub;
});
jest.mock('@hazard/services/sosService', () => ({ subscribeToSosEvents: (g: string, cb: (e: unknown[]) => void) => mockSubscribe(g, cb) }));

import SosListener, { SOS_MAX_AGE_MS, decideIncoming } from '../src/overlays/SosListener';
import { useSosEventsStore } from '../src/overlays/sosEventsStore';
import { useAppStore } from '../src/store/appStore';
import { OverlayState, useOverlayStore } from '../src/store/overlayStore';
import { useSessionStore } from '../src/store/sessionStore';

const NOW = 1_800_000_000_000;
const ev = (id: string, rider: string, ageMs = 5000, extra: Record<string, unknown> = {}) => ({
  sos_id: id, rider_id: rider, group_id: 'g1', lat: 18.9, lng: 73.3, created_at_hlc: `${NOW - ageMs}:0`, ...extra,
});
const none = new Set<string>();

describe('decideIncoming (pure)', () => {
  it('raises another rider\'s fresh, unseen SOS', () => {
    expect(decideIncoming({ events: [ev('a', 'kab')], me: 'me', seen: none, now: NOW, current: null }).raise?.sos_id).toBe('a');
  });
  it('never raises my own SOS', () => {
    expect(decideIncoming({ events: [ev('a', 'me')], me: 'me', seen: none, now: NOW, current: null }).raise).toBeNull();
  });
  it('first time only: an id already seen (dismissed) is not raised again', () => {
    expect(decideIncoming({ events: [ev('a', 'kab')], me: 'me', seen: new Set(['a']), now: NOW, current: null }).raise).toBeNull();
  });
  it('ignores events older than 10 minutes, keeps ones just inside', () => {
    expect(decideIncoming({ events: [ev('old', 'kab', SOS_MAX_AGE_MS + 1000)], me: 'me', seen: none, now: NOW, current: null }).raise).toBeNull();
    expect(decideIncoming({ events: [ev('ok', 'kab', SOS_MAX_AGE_MS - 1000)], me: 'me', seen: none, now: NOW, current: null }).raise?.sos_id).toBe('ok');
  });
  it('an event with an unreadable time is raised (age unknown is not "old")', () => {
    expect(decideIncoming({ events: [ev('x', 'kab', 0, { created_at_hlc: 'garbage' })], me: 'me', seen: none, now: NOW, current: null }).raise?.sos_id).toBe('x');
  });
  it('the newest of several is raised first', () => {
    expect(decideIncoming({ events: [ev('a', 'k1', 9000), ev('b', 'k2', 1000)], me: 'me', seen: none, now: NOW, current: null }).raise?.sos_id).toBe('b');
  });
  it.each(['sos-sent', 'crash', 'call112', 'sos-incoming'] as const)('waits while a %s overlay is up', (kind) => {
    const current = ({ kind, sosId: 's', riderId: 'r', groupId: 'g', lat: 1, lng: 1 } as unknown) as OverlayState;
    expect(decideIncoming({ events: [ev('a', 'kab')], me: 'me', seen: none, now: NOW, current }).raise).toBeNull();
  });
  it('does raise over the roll-out countdown', () => {
    const current: OverlayState = { kind: 'rollout', groupId: 'g1' };
    expect(decideIncoming({ events: [ev('a', 'kab')], me: 'me', seen: none, now: NOW, current }).raise?.sos_id).toBe('a');
  });
});

describe('SosListener (mounted)', () => {
  const mounted: ReactTestRenderer[] = [];
  const mount = () => {
    let t!: ReactTestRenderer;
    act(() => { t = create(<SosListener />); });
    mounted.push(t);
    return t;
  };
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    mockCb = null;
    useSessionStore.setState({ uid: 'me', authKnown: true });
    useAppStore.setState({ userId: 'me', groupId: 'g1' });
    useOverlayStore.setState({ current: null });
    useSosEventsStore.setState({ events: [] });
  });
  afterEach(() => {
    mounted.splice(0).forEach((t) => act(() => t.unmount()));
    jest.restoreAllMocks();
  });

  it('does not subscribe without a ride', () => {
    useAppStore.setState({ groupId: null });
    mount();
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it('subscribes to the ride and raises the incoming overlay with the event details, once', () => {
    mount();
    expect(mockSubscribe).toHaveBeenCalledWith('g1', expect.any(Function));
    act(() => mockCb!([ev('a', 'kab')]));
    expect(useOverlayStore.getState().current).toEqual({
      kind: 'sos-incoming', sosId: 'a', riderId: 'kab', groupId: 'g1', lat: 18.9, lng: 73.3, startedMs: NOW - 5000,
    });
    // rider dismisses it; the same event arriving again (every snapshot re-sends it) is not re-raised
    act(() => useOverlayStore.getState().hide());
    act(() => mockCb!([ev('a', 'kab')]));
    expect(useOverlayStore.getState().current).toBeNull();
    // a new event is
    act(() => mockCb!([ev('a', 'kab'), ev('b', 'zoya', 1000)]));
    expect(useOverlayStore.getState().current).toMatchObject({ kind: 'sos-incoming', sosId: 'b' });
  });

  it('ignores my own SOS and stale ones', () => {
    mount();
    act(() => mockCb!([ev('mine', 'me'), ev('stale', 'kab', SOS_MAX_AGE_MS + 5000)]));
    expect(useOverlayStore.getState().current).toBeNull();
  });

  it('while my own SOS screen is up it waits, then raises once that closes', () => {
    mount();
    act(() => useOverlayStore.getState().show({ kind: 'sos-sent', sosId: 'mine', groupId: 'g1' }));
    act(() => mockCb!([ev('a', 'kab')]));
    expect(useOverlayStore.getState().current?.kind).toBe('sos-sent');
    act(() => useOverlayStore.getState().hide());
    expect(useOverlayStore.getState().current).toMatchObject({ kind: 'sos-incoming', sosId: 'a' });
  });

  it('unsubscribes and forgets events when the ride ends or changes', () => {
    mount();
    act(() => mockCb!([ev('a', 'kab')]));
    act(() => useOverlayStore.getState().hide());
    act(() => useAppStore.setState({ groupId: null }));
    expect(mockUnsub).toHaveBeenCalled();
    expect(useSosEventsStore.getState().events).toEqual([]);
    // a new ride: the same id may be raised again (different session of seeing)
    act(() => useAppStore.setState({ groupId: 'g2' }));
    expect(mockSubscribe).toHaveBeenLastCalledWith('g2', expect.any(Function));
  });

  it('publishes the active events for the overlay to watch', () => {
    mount();
    act(() => mockCb!([ev('a', 'kab')]));
    expect(useSosEventsStore.getState().events.map((e) => e.sos_id)).toEqual(['a']);
    act(() => mockCb!([]));
    expect(useSosEventsStore.getState().events).toEqual([]);
  });
});
