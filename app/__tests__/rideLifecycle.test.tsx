/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
import React from 'react';
import { act, create } from 'react-test-renderer';
import type { Ride } from '../src/models/domain';
import { decideLifecycle, primaryRide } from '../src/navigation/rideLifecycle';

const mockReset = jest.fn();
const mockRoute = { current: { name: 'GarageTabs', params: undefined as any } };
jest.mock('../src/navigation/navigationRef', () => ({
  navigationRef: {
    isReady: () => true,
    getCurrentRoute: () => mockRoute.current,
    reset: (...a: unknown[]) => mockReset(...a),
  },
  navigateRoot: jest.fn(),
  resetRoot: jest.fn(),
}));
const mockFinish = jest.fn().mockResolvedValue({ log: null, saved: false });
jest.mock('../src/services/rideFlow', () => ({
  finishOwnRide: (...a: unknown[]) => mockFinish(...a),
  isEndingOwnRide: jest.fn(() => false),
  resetRideFlow: jest.fn(),
}));
jest.mock('../src/services/pendingLogs', () => ({ flushPending: jest.fn().mockResolvedValue(0) }));

import RideLifecycleBridge from '../src/navigation/RideLifecycleBridge';
import { useAppStore } from '../src/store/appStore';
import { useRidesStore } from '../src/store/ridesStore';
import { useOverlayStore } from '../src/store/overlayStore';
import { useProfileStore } from '../src/store/profileStore';
import { useCrewsStore } from '../src/store/crewsStore';

const ride = (over: Partial<Ride> = {}): Ride => ({
  id: 'r1', name: 'Sunrise Ghat Run', created_by: 'lead', member_ids: ['me', 'lead'], crew_id: null, join_code: null, ride_type: null, pace: null,
  start_time_ms: 1000, status: 'meetup', started_ms: null, finished_ms: null, meetup: null, ride_plan: null, invited_ids: [], created_ms: 1, ...over,
});
const base = { uid: 'me', groupId: 'r1', routeName: 'Meetup', routeGroupId: 'r1', memory: {} as Record<string, any> };

describe('decideLifecycle (pure)', () => {
  it('meetup -> live while in the roll call: roll out', () => {
    const r = decideLifecycle({ ...base, rides: [ride({ status: 'live' })], memory: { r1: 'meetup' } });
    expect(r.action).toEqual({ type: 'rollout', rideId: 'r1' });
    expect(r.memory.r1).toBe('live');
  });
  it('a snapshot replay of the same status never re-navigates', () => {
    const live = [ride({ status: 'live' })];
    const first = decideLifecycle({ ...base, rides: live, memory: { r1: 'meetup' } });
    const again = decideLifecycle({ ...base, rides: live, memory: first.memory });
    expect(again.action).toBeNull();
  });
  it('first sight of a ride that is already live (app start) is a replay, not a roll-out', () => {
    expect(decideLifecycle({ ...base, routeName: 'GarageTabs', routeGroupId: null, rides: [ride({ status: 'live' })] }).action).toBeNull();
  });
  it('...unless the rider is sitting in that ride’s roll call', () => {
    expect(decideLifecycle({ ...base, rides: [ride({ status: 'live' })] }).action).toEqual({ type: 'rollout', rideId: 'r1' });
  });
  it('already on Live / Stop / Arrive: no roll-out', () => {
    for (const routeName of ['Live', 'Stop', 'Arrive']) {
      expect(decideLifecycle({ ...base, routeName, rides: [ride({ status: 'live' })], memory: { r1: 'meetup' } }).action).toBeNull();
    }
  });
  it('a roll-out already on screen is not raised twice', () => {
    expect(decideLifecycle({ ...base, rolloutShowing: true, rides: [ride({ status: 'live' })], memory: { r1: 'meetup' } }).action).toBeNull();
  });
  it('from the Garage a meetup -> live ride pulls the rider in', () => {
    expect(decideLifecycle({ ...base, routeName: 'GarageTabs', routeGroupId: null, rides: [ride({ status: 'live' })], memory: { r1: 'meetup' } }).action).toEqual({ type: 'rollout', rideId: 'r1' });
  });
  it('finished while on a Road screen: recap; not from the Garage; not when this device ended it', () => {
    const fin = [ride({ status: 'finished' })];
    expect(decideLifecycle({ ...base, routeName: 'Arrive', rides: fin, memory: { r1: 'live' } }).action).toEqual({ type: 'recap', rideId: 'r1' });
    expect(decideLifecycle({ ...base, routeName: 'GarageTabs', rides: fin, memory: { r1: 'live' } }).action).toBeNull();
    expect(decideLifecycle({ ...base, routeName: 'Arrive', rides: fin, memory: { r1: 'live' }, endingOwn: () => true }).action).toBeNull();
    expect(decideLifecycle({ ...base, routeName: 'Live', rides: fin }).action).toBeNull(); // never saw it live: replay
  });
  it('picks the active ride, else the most recent meetup/live ride the rider is in', () => {
    const rides = [ride({ id: 'old', status: 'live', started_ms: 1 }), ride({ id: 'new', status: 'meetup', started_ms: 9 }), ride({ id: 'x', status: 'live', member_ids: ['other'], started_ms: 99 })];
    expect(primaryRide(rides, 'me', null)?.id).toBe('new');
    expect(primaryRide(rides, 'me', 'old')?.id).toBe('old');
    expect(primaryRide(rides, 'nobody', null)).toBeNull();
  });
});

describe('RideLifecycleBridge', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReset.mockClear();
    mockFinish.mockClear();
    useOverlayStore.setState({ current: null });
    useAppStore.setState({ userId: 'me', groupId: 'r1' });
    useRidesStore.setState({ rides: [ride({ status: 'meetup' })], loaded: true });
    useCrewsStore.setState({ crews: [] });
    useProfileStore.setState({ byId: { lead: { uid: 'lead', name: 'Meera Rao', bike: '', style: 'Steady', stats: { km: 0, rides: 0, together_sum: 0 } } as any } });
    mockRoute.current = { name: 'Meetup', params: { groupId: 'r1' } };
  });
  afterEach(() => jest.useRealTimers());

  it('shows the roll-out overlay with the lead’s name when the ride turns live, once', () => {
    let t: any;
    act(() => { t = create(<RideLifecycleBridge />); });
    expect(useOverlayStore.getState().current).toBeNull();
    act(() => useRidesStore.setState({ rides: [ride({ status: 'live' })] }));
    act(() => { jest.advanceTimersByTime(10); });
    expect(useOverlayStore.getState().current).toEqual({ kind: 'rollout', groupId: 'r1', leadName: 'MEERA' });
    // same snapshot again (listener re-attach)
    useOverlayStore.setState({ current: null });
    act(() => useRidesStore.setState({ rides: [ride({ status: 'live' })] }));
    expect(useOverlayStore.getState().current).toBeNull();
    act(() => t.unmount());
  });

  it('finished while on Arrive: finishes + saves our own recording, then resets to Garage + Recap', async () => {
    mockRoute.current = { name: 'Live', params: { groupId: 'r1' } };
    useRidesStore.setState({ rides: [ride({ status: 'live' })] });
    let t: any;
    act(() => { t = create(<RideLifecycleBridge />); });
    await act(async () => { useRidesStore.setState({ rides: [ride({ status: 'finished' })] }); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(mockFinish).toHaveBeenCalledWith('me', 'r1', 2);
    expect(mockReset).toHaveBeenCalledWith({ index: 1, routes: [{ name: 'GarageTabs' }, { name: 'Recap', params: { rideId: 'r1' } }] });
    act(() => t.unmount());
  });
});
