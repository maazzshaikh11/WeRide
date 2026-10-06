/** CrashWatcher: mounts the detector only while a ride is live and crash detection is on; an impact raises the countdown. */
import React from 'react';
import { Platform } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { accelerometer } from 'react-native-sensors';
import { useRouteStore } from '@routing/client/routeStore';

import CrashWatcher, { accelScale } from '../src/overlays/CrashWatcher';
import { useAppStore } from '../src/store/appStore';
import { useOverlayStore } from '../src/store/overlayStore';
import { usePrefsStore } from '../src/store/prefsStore';
import { DEFAULT_PREFS } from '../src/models/domain';

let mockPush: ((s: { x: number; y: number; z: number }) => void) | null = null;
const mockUnsubscribe = jest.fn();
let nowMs = 1_000_000;

const fix = (speed: number, hlc: string) => ({
  rider_id: 'me', group_id: 'g1', timestamp_hlc: hlc, lat: 18.9, lng: 73.3, speed_mps: speed, heading_deg: 0,
  spoof_flag: false, nis_score: 0, accuracy_m: 4,
});

describe('CrashWatcher', () => {
  const mounted: ReactTestRenderer[] = [];
  const mount = () => {
    let t!: ReactTestRenderer;
    act(() => { t = create(<CrashWatcher />); });
    mounted.push(t);
    return t;
  };
  const tick = (ms: number) => { nowMs += ms; };
  const sample = (x: number, y: number, z: number) => act(() => mockPush!({ x, y, z }));
  const hit = () => {
    sample(55, 10, 8);
    tick(50);
    sample(28, -6, 12);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    nowMs = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => nowMs);
    mockPush = null;
    (accelerometer.subscribe as jest.Mock).mockImplementation((next: typeof mockPush) => {
      mockPush = next;
      return { unsubscribe: mockUnsubscribe };
    });
    useAppStore.setState({ groupId: 'g1', userId: 'me' });
    usePrefsStore.setState({ prefs: { ...DEFAULT_PREFS, crash: true } });
    useOverlayStore.setState({ current: null });
    useRouteStore.setState({ lastValidLocation: null, currentLocation: null });
  });
  afterEach(() => {
    mounted.splice(0).forEach((t) => act(() => t.unmount()));
    jest.restoreAllMocks();
  });

  it('is off without a ride, or with crash detection switched off', () => {
    useAppStore.setState({ groupId: null });
    mount();
    expect(accelerometer.subscribe).not.toHaveBeenCalled();
    mounted.splice(0).forEach((t) => act(() => t.unmount()));
    useAppStore.setState({ groupId: 'g1' });
    usePrefsStore.setState({ prefs: { ...DEFAULT_PREFS, crash: false } });
    mount();
    expect(accelerometer.subscribe).not.toHaveBeenCalled();
  });

  it('subscribes while live, and stops when the toggle is switched off or the ride ends', () => {
    mount();
    expect(accelerometer.subscribe).toHaveBeenCalledTimes(1);
    act(() => usePrefsStore.setState({ prefs: { ...DEFAULT_PREFS, crash: false } }));
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    act(() => usePrefsStore.setState({ prefs: { ...DEFAULT_PREFS, crash: true } }));
    expect(accelerometer.subscribe).toHaveBeenCalledTimes(2);
    act(() => useAppStore.setState({ groupId: null }));
    expect(mockUnsubscribe).toHaveBeenCalledTimes(2);
  });

  it('a hard hit on a moving bike that then stops raises the "Are you OK?" countdown', () => {
    mount();
    for (let i = 0; i < 5; i++) {
      act(() => useRouteStore.setState({ lastValidLocation: fix(14, `h${i}`) as never }));
      for (let k = 0; k < 20; k++) { tick(50); sample(0.2, 0.1, 9.8); }
    }
    hit();
    expect(useOverlayStore.getState().current).toBeNull();
    tick(800);
    act(() => useRouteStore.setState({ lastValidLocation: fix(0.3, 'h-stop') as never }));
    expect(useOverlayStore.getState().current).toEqual({ kind: 'crash' });
  });

  it('a phone dropped at rest raises nothing', () => {
    mount();
    act(() => useRouteStore.setState({ lastValidLocation: fix(0, 'r1') as never }));
    hit();
    tick(1000);
    act(() => useRouteStore.setState({ lastValidLocation: fix(0, 'r2') as never }));
    expect(useOverlayStore.getState().current).toBeNull();
  });

  it('does not raise a crash screen over an SOS that is already up', () => {
    mount();
    act(() => useOverlayStore.getState().show({ kind: 'sos-sent', sosId: 's' }));
    act(() => useRouteStore.setState({ lastValidLocation: fix(14, 'm1') as never }));
    tick(500);
    hit();
    tick(500);
    act(() => useRouteStore.setState({ lastValidLocation: fix(0, 'm2') as never }));
    expect(useOverlayStore.getState().current?.kind).toBe('sos-sent');
  });

  it('iOS reports g, Android m/s²: the watcher converts to m/s²', () => {
    const original = Platform.OS;
    (Platform as { OS: string }).OS = 'ios';
    expect(accelScale()).toBeCloseTo(9.80665);
    (Platform as { OS: string }).OS = 'android';
    expect(accelScale()).toBe(1);
    (Platform as { OS: string }).OS = original;
  });
});
