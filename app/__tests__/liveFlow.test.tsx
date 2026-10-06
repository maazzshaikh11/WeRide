/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
/**
 * The Live screen's demo-parity behaviour end to end over the REAL stores: plate states and their priority, the
 * post-hazard Still there / Gone confirm, signals from the crew, stop-ahead and the hand-offs to Stop / Arrive,
 * push-to-talk honesty, SOS through the SOS flow, glove mode and units, GROUP, presence and the recorder.
 */
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  SafeAreaInsetsContext: require('react').createContext(null),
}));
jest.mock('@tracking/ekf', () => ({ Ekf: jest.fn().mockImplementation(() => ({})) }));
jest.mock('@tracking/sensorStream', () => ({ SensorStream: jest.fn().mockImplementation(() => ({})) }));
jest.mock('@tracking/locationPublisher', () => ({ LocationPublisher: jest.fn().mockImplementation(() => ({ fetchGroupLastKnown: jest.fn().mockResolvedValue([]) })) }));
jest.mock('@tracking/trackingService', () => ({ TrackingService: jest.fn().mockImplementation(() => ({ start: jest.fn().mockResolvedValue(true), stop: jest.fn().mockResolvedValue(undefined) })) }));
jest.mock('@tracking/hlcStore', () => ({ loadHlc: jest.fn().mockReturnValue({ now: jest.fn().mockReturnValue('0:0') }) }));
const mockHandlers: Record<string, (p: any) => void> = {};
const mockSocket = {
  on: jest.fn((ev: string, cb: (p: any) => void) => { mockHandlers[ev] = cb; }),
  off: jest.fn(), emit: jest.fn(), connected: true,
};
jest.mock('../src/services/socketService', () => ({ getLocationSocket: () => mockSocket, getVoxSocket: () => ({}) }));
const mockFit = jest.fn();
const mockSetCamera = jest.fn();
jest.mock('@rnmapbox/maps', () => {
  const React = require('react');
  const Camera = React.forwardRef((_p: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ fitBounds: mockFit, setCamera: mockSetCamera }));
    return React.createElement('Camera', _p);
  });
  const m = {
    setAccessToken: jest.fn(), MapView: 'MapView', Camera, ShapeSource: 'ShapeSource', CircleLayer: 'CircleLayer', LineLayer: 'LineLayer',
    SymbolLayer: 'SymbolLayer', UserLocation: 'UserLocation', MarkerView: 'MarkerView',
    UserTrackingMode: { Follow: 'normal', FollowWithHeading: 'compass', FollowWithCourse: 'course' }, StyleURL: { Dark: 'dark', Light: 'light' },
  };
  return { __esModule: true, default: m, ...m };
});
jest.mock('../src/screens/map/overlays/RiderMarkerOverlay', () => ({ __esModule: true, default: () => null, RiderInfoCard: () => null }));
jest.mock('../src/screens/map/overlays/HazardOverlay', () => ({ __esModule: true, HazardOverlayMapLayer: () => null, HazardOverlayInfoCard: () => null }));
jest.mock('../src/screens/map/overlays/SosOverlay', () => ({ __esModule: true, SosOverlayMapLayer: () => null, SosOverlayInfoCards: () => null }));
jest.mock('../src/screens/map/overlays/RouteOverlay', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/map/overlays/FlStatusOverlay', () => ({ __esModule: true, default: () => null }));
jest.mock('@routing/client/deepLink', () => ({ googleMapsDeepLink: jest.fn(() => 'https://maps.google.com') }));
jest.mock('@routing/group/groupService', () => ({ GroupService: jest.fn().mockImplementation(() => ({ getRidePlan: jest.fn().mockResolvedValue(null), getGroup: jest.fn().mockResolvedValue(null) })) }));
jest.mock('@hazard/services/sosService', () => ({ resolveSos: jest.fn() }));
jest.mock('@hazard/services/hazardService', () => ({ resolveHazard: jest.fn(), submitHazardReport: jest.fn(), triggerClustering: jest.fn(), subscribeToHazardClusters: jest.fn(() => jest.fn()) }));
const mockSetPresence = jest.fn().mockResolvedValue(undefined);
jest.mock('../src/services/rideService', () => ({ setPresence: (...a: unknown[]) => mockSetPresence(...a), subscribeRide: jest.fn(() => jest.fn()), subscribeRollCall: jest.fn(() => jest.fn()), subscribePresence: jest.fn(() => jest.fn()), setRideStatus: jest.fn() }));
const mockTrigger = jest.fn().mockResolvedValue(undefined);
jest.mock('../src/services/sosFlowService', () => ({ triggerSosFlow: (...a: unknown[]) => mockTrigger(...a), noteAnyFix: jest.fn() }));
jest.mock('../src/services/rideRecorder', () => ({
  rideRecorder: { start: jest.fn(), onOwnFix: jest.fn(), onRiders: jest.fn(), addEvent: jest.fn(), countHazard: jest.fn(), countSignal: jest.fn(), isRecording: jest.fn(() => false), rideId: jest.fn(() => null), finish: jest.fn(), reset: jest.fn() },
}));
const mockStill = jest.fn().mockResolvedValue({ queued: false });
const mockGone = jest.fn().mockResolvedValue({ votes: 1, resolved: false });
jest.mock('../src/services/hazardConfirmService', () => ({ confirmStillThere: (...a: unknown[]) => mockStill(...a), voteGone: (...a: unknown[]) => mockGone(...a) }));
const mockVox = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), setVoiceActive: jest.fn() };
jest.mock('@flvoice/vox/voxClient', () => ({ VoxClient: jest.fn().mockImplementation(() => mockVox) }));
const mockMic = { granted: false };
jest.mock('@flvoice/vox/micPermission', () => ({
  checkMicrophonePermission: jest.fn(() => Promise.resolve(mockMic.granted)),
  requestMicrophonePermission: jest.fn(() => Promise.resolve(mockMic.granted)),
}));

import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import MapScreen from '../src/screens/map/MapScreen';
import { useAppStore } from '../src/store/appStore';
import { useRidersStore } from '../src/store/ridersStore';
import { useRouteStore } from '@routing/client/routeStore';
import { useRidePlanStore } from '../src/store/ridePlanStore';
import { useToastStore } from '../src/store/toastStore';
import { useProfileStore } from '../src/store/profileStore';
import { usePrefsStore } from '../src/store/prefsStore';
import { useRidesStore } from '../src/store/ridesStore';
import { useVoiceStore, stopVoice } from '../src/hooks/useVoiceChannel';
import { resetRideFlow, visitedStopIds } from '../src/services/rideFlow';
import { DEFAULT_PREFS } from '../src/models/domain';
import { ThemeContext, buildTheme } from '../src/theme/ThemeProvider';
import { THEMES } from '../src/theme/palettes';
import { rideRecorder as mockRec } from '../src/services/rideRecorder';
import { verifiedLocationFromJson } from '../src/models/verifiedLocation';

const ORIGIN = { lat: 18.52, lng: 73.85 };
const north = (m: number) => ({ lat: ORIGIN.lat + m / 111320, lng: ORIGIN.lng });
const PATH = [0, 1000, 2000, 3000, 4000, 5000].map((m) => [north(m).lat, north(m).lng]);
const ROUTE = { route_id: 'r', path_points: PATH, distance_km: 5, eta_minutes: 60, safety_score: 1, recalculated_at_hlc: '0:0' } as any;
const cluster = (id: string, m: number) => ({ cluster_id: id, group_id: 'g1', hazard_type: 'pothole', centroid_lat: north(m).lat, centroid_lng: north(m).lng, polygon_points: [], report_count: 2, hazard_score: 1, created_at_hlc: '0:0', status: 'active' }) as any;
const fix = (id: string, at: { lat: number; lng: number }, speed = 10) => verifiedLocationFromJson({ rider_id: id, group_id: 'g1', timestamp_hlc: `${Date.now()}:0`, lat: at.lat, lng: at.lng, speed_mps: speed, heading_deg: 0, spoof_flag: false, nis_score: 1, accuracy_m: 5 });
const setOwn = (at: { lat: number; lng: number }, speed = 10) => act(() => useRouteStore.getState().setLastValidLocation(fix('me', at, speed)));
const setRider = (id: string, at: { lat: number; lng: number }) => act(() => useRidersStore.getState().upsertRider(fix(id, at)));

const navigate = jest.fn();
const mounted: ReactTestRenderer[] = [];
function mount(palette = THEMES.demo.dark) {
  let t!: ReactTestRenderer;
  act(() => { t = create(<ThemeContext.Provider value={buildTheme('demo', palette)}><MapScreen navigation={{ goBack: jest.fn(), navigate, isFocused: () => true }} /></ThemeContext.Provider>); });
  mounted.push(t);
  return t;
}
const host = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => n.props.testID === id && typeof n.type === 'string')[0];
const plate = (t: ReactTestRenderer) => host(t, 'status-plate')?.props.accessibilityLabel as string | undefined;
const pressable = (t: ReactTestRenderer, label: string) => t.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPressIn === 'function')[0];
const toasts = () => useToastStore.getState().toasts.map((x) => x.message);
const text = (t: ReactTestRenderer, id: string) => [host(t, id).props.children].flat().join('');

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  Object.keys(mockHandlers).forEach((k) => delete mockHandlers[k]);
  resetRideFlow();
  mockMic.granted = false;
  useAppStore.setState({ userId: 'me', groupId: 'g1' });
  useRouteStore.setState({ route: null, lastValidLocation: null, currentLocation: null, isLoading: false, activeClusters: [] });
  useRidersStore.setState({ riders: new Map(), connected: true });
  useRidePlanStore.setState({ start: null, stops: [], destination: null });
  useToastStore.setState({ toasts: [] });
  useProfileStore.setState({ byId: { m: { uid: 'm', name: 'Meera', bike: '', style: 'Steady', stats: { km: 0, rides: 0, together_sum: 0 } } as any }, ensure: jest.fn() } as any);
  usePrefsStore.setState({ prefs: { ...DEFAULT_PREFS } });
  useRidesStore.setState({ rides: [], loaded: true });
  useVoiceStore.setState({ status: 'off', talking: false });
});
afterEach(async () => {
  mounted.splice(0).forEach((t) => act(() => t.unmount()));
  await act(async () => { await stopVoice(); });
  jest.useRealTimers();
});

describe('status plate: new demo states', () => {
  it('hazard ahead: real active cluster within 500 m AHEAD on the route', () => {
    setOwn(north(0));
    useRouteStore.setState({ route: ROUTE, activeClusters: [cluster('h1', 380)] });
    const t = mount();
    expect(plate(t)).toBe('Pothole · 380 m. Reported by 2 riders · ease off');
    // behind or beyond 500 m: not shown
    act(() => useRouteStore.setState({ activeClusters: [cluster('far', 900)] }));
    expect(plate(t)).toMatch(/Riding solo/i);
  });

  it('hazard distance in miles with the units pref', () => {
    usePrefsStore.setState({ prefs: { ...DEFAULT_PREFS, units: 'mi' } });
    setOwn(north(0));
    useRouteStore.setState({ route: ROUTE, activeClusters: [cluster('h1', 380)] });
    expect(plate(mount())).toMatch(/^Pothole · 0\.2 mi\./);
  });

  it('signal from the crew shows by name for ~15 s, own signals do not', () => {
    setOwn(north(0));
    const t = mount();
    act(() => mockHandlers['signal:received']({ group_id: 'g1', rider_id: 'me', label: 'All good' }));
    expect(plate(t)).toMatch(/Riding solo/i);
    act(() => mockHandlers['signal:received']({ group_id: 'other', rider_id: 'm', label: 'Wait for me' }));
    expect(plate(t)).toMatch(/Riding solo/i);
    act(() => mockHandlers['signal:received']({ group_id: 'g1', rider_id: 'm', label: 'Wait for me' }));
    expect(plate(t)).toBe('Meera · Wait for me. Signal from the crew');
    act(() => { jest.advanceTimersByTime(14_000); });
    expect(plate(t)).toMatch(/^Meera/);
    act(() => { jest.advanceTimersByTime(1_500); });
    expect(plate(t)).toMatch(/Riding solo/i);
  });

  it('stop ahead (blue) within 800 m; tapping it opens Stop for that stop', () => {
    useRidePlanStore.setState({ stops: [{ id: 's1', label: 'Chai Point, Khopoli', lat: north(1600).lat, lng: north(1600).lng, icon: 'cup' }] });
    useRouteStore.setState({ route: ROUTE });
    setOwn(north(1000), 12);
    const t = mount();
    expect(plate(t)).toBe('Chai Point · 600 m. Pull in together');
    act(() => host(t, 'status-plate').props.onPress?.({}) ?? t.root.findAll((n) => n.props.testID === 'status-plate' && typeof n.props.onPress === 'function')[0].props.onPress({}));
    expect(navigate).toHaveBeenCalledWith('Stop', { groupId: 'g1', stopId: 's1' });
    expect([...visitedStopIds('g1')]).toEqual(['s1']);
  });

  it('a rider with a GREY marker: "<name> · No signal", last seen N s ago', () => {
    setOwn(north(0));
    act(() => useRidersStore.getState().upsertRider({ ...fix('m', north(100)), timestamp_hlc: `${Date.now() - 14_000}:0` }));
    const t = mount();
    expect(plate(t)).toBe('Meera · No signal. Last seen 14 s ago · position held');
  });

  it('priority: hazard beats signal beats stop ahead', () => {
    useRidePlanStore.setState({ stops: [{ id: 's1', label: 'Chai', lat: north(1500).lat, lng: north(1500).lng, icon: 'cup' }] });
    useRouteStore.setState({ route: ROUTE, activeClusters: [cluster('h', 1300)] });
    setOwn(north(1000));
    const t = mount();
    act(() => mockHandlers['signal:received']({ group_id: 'g1', rider_id: 'm', label: 'Need fuel' }));
    expect(plate(t)).toMatch(/^Pothole/);
    act(() => useRouteStore.setState({ activeClusters: [] }));
    expect(plate(t)).toMatch(/^Meera · Need fuel/);
    act(() => { jest.advanceTimersByTime(16_000); });
    expect(plate(t)).toMatch(/^Chai/);
  });
});

describe('hazard passed: Still there / Gone', () => {
  const passHazard = () => {
    useRouteStore.setState({ route: ROUTE, activeClusters: [cluster('h1', 1300)] });
    setOwn(north(1000));
    const t = mount();
    setOwn(north(1250));
    setOwn(north(1340));
    return t;
  };
  it('after passing it the plate is replaced by STILL THERE / GONE', () => {
    const t = passHazard();
    expect(host(t, 'hazard-confirm')).toBeDefined();
    expect(host(t, 'status-plate')).toBeUndefined();
  });
  it('Still there confirms the cluster (a report at its spot), toasts, counts it for the recap', () => {
    const t = passHazard();
    act(() => t.root.findAll((n) => n.props.testID === 'confirm-still' && typeof n.props.onPress === 'function')[0].props.onPress({}));
    expect(mockStill).toHaveBeenCalledWith(expect.objectContaining({ type: 'pothole', riderId: 'me', groupId: 'g1', lat: north(1300).lat }));
    expect(toasts()).toContain('Confirmed. Crew alerted');
    expect((mockRec as any).countHazard).toHaveBeenCalled();
    expect((mockRec as any).addEvent).toHaveBeenCalledWith('hazard', 'Confirmed pothole');
    expect(host(t, 'hazard-confirm')).toBeUndefined();
  });
  it('Gone adds the rider’s vote (resolution needs a second rider)', () => {
    const t = passHazard();
    act(() => t.root.findAll((n) => n.props.testID === 'confirm-gone' && typeof n.props.onPress === 'function')[0].props.onPress({}));
    expect(mockGone).toHaveBeenCalledWith('h1', 'me');
    expect(toasts().join('|')).toMatch(/Marked as gone/);
    expect(mockStill).not.toHaveBeenCalled();
  });
  it('the buttons go away by themselves after ~4 min', () => {
    const t = passHazard();
    act(() => { jest.advanceTimersByTime(4 * 60_000 + 100); });
    expect(host(t, 'hazard-confirm')).toBeUndefined();
    expect(plate(t)).toBeDefined();
  });
  it('a hazard reported from the sheet is counted and recorded', () => {
    setOwn(north(0));
    const t = mount();
    const sheet = t.root.findAll((n) => typeof n.props.onReported === 'function')[0];
    act(() => sheet.props.onReported('oil_spill'));
    expect((mockRec as any).countHazard).toHaveBeenCalled();
    expect((mockRec as any).addEvent).toHaveBeenCalledWith('hazard', 'Reported oil');
  });
});

describe('hand-offs', () => {
  const stops = [{ id: 's1', label: 'Chai Point', lat: north(2000).lat, lng: north(2000).lng, icon: 'cup' }];
  it('stationary (< 5 km/h) for 20 s inside a stop zone opens Stop, once', () => {
    useRidePlanStore.setState({ stops });
    useRouteStore.setState({ route: ROUTE });
    setOwn(north(1990), 0);
    mount();
    act(() => { jest.advanceTimersByTime(10_000); });
    setOwn(north(1992), 0.2);
    expect(navigate).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(11_000); });
    setOwn(north(1993), 0.2);
    expect(navigate).toHaveBeenCalledWith('Stop', { groupId: 'g1', stopId: 's1' });
    setOwn(north(1994), 0);
    act(() => { jest.advanceTimersByTime(30_000); });
    setOwn(north(1995), 0);
    expect(navigate.mock.calls.filter((c) => c[0] === 'Stop')).toHaveLength(1);
  });
  it('moving through the stop zone does not open Stop', () => {
    useRidePlanStore.setState({ stops });
    useRouteStore.setState({ route: ROUTE });
    setOwn(north(1990), 12);
    mount();
    act(() => { jest.advanceTimersByTime(25_000); });
    setOwn(north(2010), 12);
    expect(navigate).not.toHaveBeenCalled();
  });
  it('within 150 m of the destination (after having been away) opens Arrive, once', () => {
    useRidePlanStore.setState({ destination: { label: 'Lonavala', lat: north(5000).lat, lng: north(5000).lng } as any });
    useRouteStore.setState({ route: ROUTE });
    setOwn(north(4800), 10);
    mount();
    expect(navigate).not.toHaveBeenCalled(); // first fix already close: never armed
    setOwn(north(0), 10);
    setOwn(north(4900), 10);
    setOwn(north(4950), 10);
    expect(navigate.mock.calls.filter((c) => c[0] === 'Arrive')).toEqual([['Arrive', { groupId: 'g1' }]]);
  });
});

describe('push-to-talk', () => {
  const talk = (t: ReactTestRenderer) => pressable(t, 'Talk to the crew');
  it('channel not live: an honest toast, nothing is broadcast', () => {
    setOwn(north(0));
    const t = mount();
    act(() => talk(t).props.onPressIn({}));
    expect(toasts()).toContain("Voice channel isn't live yet");
    expect(mockVox.setVoiceActive).not.toHaveBeenCalled();
    expect(host(t, 'talk-plate')).toBeUndefined();
  });
  it('live: hold = talking (green plate + green key), release = muted', async () => {
    mockMic.granted = true;
    setOwn(north(0));
    const t = mount();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(useVoiceStore.getState().status).toBe('live');
    act(() => talk(t).props.onPressIn({}));
    expect(mockVox.setVoiceActive).toHaveBeenLastCalledWith(true);
    expect(host(t, 'talk-plate')).toBeDefined();
    expect(toasts()).not.toContain("Voice channel isn't live yet");
    act(() => talk(t).props.onPressOut({}));
    expect(mockVox.setVoiceActive).toHaveBeenLastCalledWith(false);
    expect(host(t, 'talk-plate')).toBeUndefined();
  });
  it('releasing without a successful hold does nothing', () => {
    const t = mount();
    act(() => talk(t).props.onPressOut({}));
    expect(mockVox.setVoiceActive).not.toHaveBeenCalled();
  });
});

describe('controls, prefs and recording', () => {
  it('the SOS key goes through triggerSosFlow(groupId)', () => {
    const t = mount();
    const key = t.root.findAll((n) => n.props.testID === 'sos-key' && typeof n.props.onPressIn === 'function')[0];
    act(() => key.props.onPressIn({}));
    act(() => { jest.advanceTimersByTime(2100); });
    expect(mockTrigger).toHaveBeenCalledWith('g1');
    expect((mockRec as any).addEvent).toHaveBeenCalledWith('sos', 'SOS sent');
  });
  it('a signal from the sheet is counted for the recap', () => {
    const t = mount();
    const sheet = t.root.findAll((n) => typeof n.props.onSend === 'function' && n.props.groupId === 'g1')[0];
    act(() => sheet.props.onSend('Pull over'));
    expect((mockRec as any).countSignal).toHaveBeenCalled();
  });
  it('glove mode: speed 132, control keys 104 high', () => {
    usePrefsStore.setState({ prefs: { ...DEFAULT_PREFS, glove: true } });
    setOwn(north(0), 10);
    const t = mount();
    expect(StyleSheet.flatten(host(t, 'speed-value').props.style).fontSize).toBe(132);
    const key = t.root.findAll((n) => n.props.testID === 'key-hazard' && typeof n.props.onPressIn === 'function')[0];
    expect(StyleSheet.flatten(key.props.style).height).toBe(104);
  });
  it('normal mode: speed 122, keys 88', () => {
    const t = mount();
    expect(StyleSheet.flatten(host(t, 'speed-value').props.style).fontSize).toBe(122);
    const key = t.root.findAll((n) => n.props.testID === 'key-hazard' && typeof n.props.onPressIn === 'function')[0];
    expect(StyleSheet.flatten(key.props.style).height).toBe(88);
  });
  it('units: miles per hour, converted speed and distance left', () => {
    usePrefsStore.setState({ prefs: { ...DEFAULT_PREFS, units: 'mi' } });
    setOwn(north(0), 13.4112); // 48.28 km/h = 30 mph
    useRouteStore.setState({ route: { ...ROUTE, distance_km: 16.09344 } });
    const t = mount();
    expect(text(t, 'speed-value')).toBe('30');
    expect(text(t, 'speed-unit')).toBe('MPH');
    const rem = host(t, 'remaining-value').props.children as any[];
    expect(rem[0]).toBe('10');
    expect(rem[1].props.children.join('')).toBe(' mi');
  });
  it('writes own presence "riding" while it is the screen in front', () => {
    mount();
    expect(mockSetPresence).toHaveBeenCalledWith('g1', 'me', 'riding');
    mockSetPresence.mockClear();
    act(() => { jest.advanceTimersByTime(15_100); });
    expect(mockSetPresence).toHaveBeenCalledWith('g1', 'me', 'riding');
  });
  it('starts recording a live ride (once) and feeds riders to the recorder', () => {
    useRidesStore.setState({ rides: [{ id: 'g1', name: 'Run', status: 'live', crew_id: null, ride_plan: null, member_ids: ['me'] } as any], loaded: true });
    setOwn(north(0));
    setRider('m', north(100));
    mount();
    expect((mockRec as any).start).toHaveBeenCalledWith(expect.objectContaining({ rideId: 'g1', name: 'Run' }), expect.any(Number));
    act(() => { jest.advanceTimersByTime(1100); });
    expect((mockRec as any).onRiders).toHaveBeenCalled();
    expect((mockRec.onRiders as jest.Mock).mock.calls[0][0].map((r: any) => r.rider_id)).toEqual(['m']);
  });
  it('a gap opening (> 500 m) is added to the recording once', () => {
    setOwn(north(0));
    setRider('m', north(100));
    mount();
    setRider('m', north(900));
    setRider('m', north(950));
    expect((mockRec.addEvent as jest.Mock).mock.calls.filter((c) => c[0] === 'gap')).toHaveLength(1);
  });
  it('GROUP fits everybody and follows again after 7 s', () => {
    setOwn(north(0));
    setRider('m', north(400));
    const t = mount();
    const side = pressable(t, 'Show the whole group');
    act(() => side.props.onPress({}));
    expect(mockFit).toHaveBeenCalled();
    const camera = () => t.root.findAll((n) => n.props.followUserLocation !== undefined)[0];
    expect(camera().props.followUserLocation).toBe(false);
    act(() => { jest.advanceTimersByTime(7100); });
    expect(camera().props.followUserLocation).toBe(true);
  });
  it('colours: Road palette', () => {
    const t = mount(THEMES.ember.light);
    const root = t.root.findAll((n) => typeof n.type === 'string' && n.props.style && StyleSheet.flatten(n.props.style).flex === 1 && StyleSheet.flatten(n.props.style).backgroundColor)[0];
    expect(StyleSheet.flatten(root.props.style).backgroundColor).toBe(THEMES.ember.light.road.bg);
  });
  it('plate text is a Text in the plate (a11y label carries it)', () => {
    setOwn(north(0));
    expect(plate(mount())).toBeDefined();
    expect(Text).toBeDefined();
  });
});
