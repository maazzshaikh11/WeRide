/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories */
/**
 * Live ride screen, end to end over the REAL stores: the small distance label
 * pinned to the right of the rider's own avatar is computed from real verified
 * fixes, updates as either side moves, and is absent when there is nobody to
 * measure against. The old crew ahead/behind panel is gone.
 */
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  SafeAreaInsetsContext: require('react').createContext(null),
}));
jest.mock('@tracking/ekf', () => ({ Ekf: jest.fn().mockImplementation(() => ({})) }));
jest.mock('@tracking/sensorStream', () => ({ SensorStream: jest.fn().mockImplementation(() => ({})) }));
jest.mock('@tracking/locationPublisher', () => ({
  LocationPublisher: jest.fn().mockImplementation(() => ({ fetchGroupLastKnown: jest.fn().mockResolvedValue([]) })),
}));
jest.mock('@tracking/trackingService', () => ({
  TrackingService: jest.fn().mockImplementation(() => ({ start: jest.fn().mockResolvedValue(true), stop: jest.fn().mockResolvedValue(undefined) })),
}));
jest.mock('@tracking/hlcStore', () => ({ loadHlc: jest.fn().mockReturnValue({ now: jest.fn().mockReturnValue('0:0') }) }));
const mockSocket = { on: jest.fn(), off: jest.fn(), emit: jest.fn(), connected: true };
jest.mock('@app/services/socketService', () => ({ getLocationSocket: () => mockSocket }));
jest.mock('../src/services/socketService', () => ({ getLocationSocket: () => mockSocket }));
jest.mock('@rnmapbox/maps', () => {
  const m = {
    setAccessToken: jest.fn(), MapView: 'MapView', Camera: 'Camera', ShapeSource: 'ShapeSource', CircleLayer: 'CircleLayer',
    LineLayer: 'LineLayer', SymbolLayer: 'SymbolLayer', UserLocation: 'UserLocation', MarkerView: 'MarkerView',
    UserTrackingMode: { Follow: 'normal', FollowWithHeading: 'compass', FollowWithCourse: 'course' },
    StyleURL: { Dark: 'dark', Light: 'light' },
  };
  return { __esModule: true, default: m, ...m };
});
jest.mock('../src/screens/map/overlays/RiderMarkerOverlay', () => ({ __esModule: true, default: () => null, RiderInfoCard: () => null }));
jest.mock('../src/screens/map/overlays/HazardOverlay', () => ({ __esModule: true, HazardOverlayMapLayer: () => null, HazardOverlayInfoCard: () => null }));
jest.mock('../src/screens/map/overlays/SosOverlay', () => ({ __esModule: true, SosOverlayMapLayer: () => null, SosOverlayInfoCards: () => null }));
jest.mock('../src/screens/map/overlays/RouteOverlay', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/map/overlays/FlStatusOverlay', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/SosModal', () => ({ __esModule: true, default: () => null }));
jest.mock('@routing/client/deepLink', () => ({ googleMapsDeepLink: jest.fn(() => 'https://maps.google.com') }));
jest.mock('@routing/group/groupService', () => ({
  GroupService: jest.fn().mockImplementation(() => ({
    getRidePlan: jest.fn().mockResolvedValue(null),
    getGroup: jest.fn().mockResolvedValue(null),
  })),
}));
jest.mock('@hazard/services/sosService', () => ({ resolveSos: jest.fn() }));
jest.mock('@hazard/services/hazardService', () => ({
  resolveHazard: jest.fn(), submitHazardReport: jest.fn(), triggerClustering: jest.fn(), subscribeToHazardClusters: jest.fn(() => jest.fn()),
}));

import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';

import MapScreen from '../src/screens/map/MapScreen';
import { useAppStore } from '../src/store/appStore';
import { useRidersStore } from '../src/store/ridersStore';
import { useRouteStore } from '@routing/client/routeStore';
import { ThemeContext, buildTheme } from '../src/theme/ThemeProvider';
import { THEMES } from '../src/theme/palettes';
import { GAP_LABEL_W } from '../src/screens/map/live/LiveAvatar';
import { verifiedLocationFromJson } from '../src/models/verifiedLocation';

const ORIGIN = { lat: 18.52, lng: 73.85 };
const north = (m: number) => ({ lat: ORIGIN.lat + m / 111195, lng: ORIGIN.lng });
const hlcNow = () => `${Date.now()}:0`;

function fix(id: string, at: { lat: number; lng: number }, speedMps = 10) {
  return verifiedLocationFromJson({
    rider_id: id, group_id: 'g1', timestamp_hlc: hlcNow(), lat: at.lat, lng: at.lng,
    speed_mps: speedMps, heading_deg: 0, spoof_flag: false, nis_score: 1, accuracy_m: 5,
  });
}
const setOwn = (at: { lat: number; lng: number }, speedMps = 10) =>
  act(() => useRouteStore.getState().setLastValidLocation(fix('me', at, speedMps)));
const setRider = (id: string, at: { lat: number; lng: number }) =>
  act(() => useRidersStore.getState().upsertRider({ ...fix(id, at), spoof_flag: false }));

const mounted: ReactTestRenderer[] = [];
function mount(palette = THEMES.demo.dark) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <ThemeContext.Provider value={buildTheme('demo', palette)}>
        <MapScreen navigation={{ goBack: jest.fn(), navigate: jest.fn() }} />
      </ThemeContext.Provider>,
    );
  });
  mounted.push(tree);
  return tree;
}
const label = (t: ReactTestRenderer) => {
  const n = t.root.findAll((x) => x.props.testID === 'live-gap-label' && typeof x.type === 'string')[0];
  return n ? [n.props.children].flat().join('') : null;
};
const plate = (t: ReactTestRenderer) =>
  t.root.findAll((n) => n.props.testID === 'status-plate' && typeof n.type === 'string')[0];

describe('live ride screen', () => {
  beforeEach(() => {
    useAppStore.setState({ userId: 'me', groupId: 'g1' });
    useRouteStore.setState({ route: null, lastValidLocation: null, currentLocation: null, isLoading: false });
    useRidersStore.setState({ riders: new Map(), connected: true });
  });
  afterEach(() => {
    mounted.splice(0).forEach((t) => act(() => t.unmount()));
  });

  it('no own fix: no avatar, no label', () => {
    const t = mount();
    expect(t.root.findAll((n) => n.props.testID === 'live-avatar')).toHaveLength(0);
    expect(label(t)).toBeNull();
  });

  it('own fix but nobody else live: the avatar shows with NO label (nothing to measure)', () => {
    setOwn(ORIGIN);
    const t = mount();
    expect(t.root.findAll((n) => n.props.testID === 'live-avatar' && typeof n.type === 'string')).toHaveLength(1);
    expect(label(t)).toBeNull();
  });

  it('pins the distance to the nearest live rider beside the avatar and updates it live', () => {
    setOwn(ORIGIN);
    setRider('a', north(300));
    setRider('b', north(900));
    const t = mount();
    expect(label(t)).toBe('300m');

    // the avatar moves 200 m towards them -> label follows, without a remount
    setOwn(north(200));
    expect(label(t)).toBe('100m');

    // a closer rider appears
    setRider('c', north(240));
    expect(label(t)).toBe('40m');

    // beyond a kilometre it switches to km
    setOwn(north(-2000));
    expect(label(t)).toBe('2.2km');
  });

  it('the marker sits on the own fix and the label is on the avatar\'s RIGHT', () => {
    setOwn(north(50));
    setRider('a', north(250));
    const t = mount();
    const marker = t.root.findAll((n) => n.type === ('MarkerView' as any) && n.props.id === 'own-avatar')[0];
    expect(marker.props.coordinate).toEqual([ORIGIN.lng, north(50).lat]);
    expect(marker.props.anchor).toEqual({ x: 0.5, y: 0.5 });
    const row = t.root.findAll((n) => n.props.testID === 'live-avatar' && typeof n.type === 'string')[0];
    const kids = React.Children.toArray(row.props.children) as any[];
    // [left spacer, avatar, label slot]: the label slot is the LAST child, after the avatar
    expect(kids).toHaveLength(3);
    expect(StyleSheet.flatten(kids[0].props.style).width).toBe(GAP_LABEL_W);
    expect(StyleSheet.flatten(kids[2].props.style).width).toBe(GAP_LABEL_W);
    expect(StyleSheet.flatten(kids[2].props.style).alignItems).toBe('flex-start');
  });

  it('ignores stale and unverified riders when measuring', () => {
    setOwn(ORIGIN);
    act(() => useRidersStore.getState().upsertRider({ ...fix('stale', north(20)), timestamp_hlc: `${Date.now() - 60000}:0` }));
    act(() => useRidersStore.getState().upsertRider({ ...fix('spoof', north(30)), spoof_flag: true }));
    setRider('real', north(500));
    const t = mount();
    expect(label(t)).toBe('500m');
  });

  it('label text is small and monospaced; it is not a separate panel', () => {
    setOwn(ORIGIN);
    setRider('a', north(100));
    const t = mount();
    const n = t.root.findAll((x) => x.props.testID === 'live-gap-label' && typeof x.type === 'string')[0];
    const st = StyleSheet.flatten(n.props.style);
    expect(st.fontSize).toBe(12);
    expect(st.fontFamily).toBe('OverpassMono-Bold');
    expect(t.root.findAll((x) => /ahead|behind/i.test(String(x.props.accessibilityLabel ?? '')))).toHaveLength(0);
  });

  it('status plate follows real state: solo, together, gap', () => {
    setOwn(ORIGIN);
    const t = mount();
    expect(plate(t).props.accessibilityLabel).toMatch(/^RIDING SOLO|^Riding solo/i);
    setRider('a', north(200));
    expect(plate(t).props.accessibilityLabel).toMatch(/all together/i);
    setRider('b', north(2000));
    expect(plate(t).props.accessibilityLabel).toMatch(/gap/i);
  });

  it('speed, ETA and distance show real values or dashes — never invented', () => {
    const t = mount();
    const text = (id: string) => [t.root.findAll((n) => n.props.testID === id && typeof n.type === 'string')[0].props.children].flat().join('');
    expect(text('speed-value')).toBe('--');
    expect(text('eta-value')).toBe('--:--');
    setOwn(ORIGIN, 12.5); // 45 km/h
    expect(text('speed-value')).toBe('45');
    act(() => useRouteStore.setState({ route: { route_id: 'r', path_points: [[18.5, 73.8], [18.6, 73.9]], distance_km: 84.2, eta_minutes: 125, safety_score: 0.9, recalculated_at_hlc: '0:0' } as any }));
    expect(text('eta-value')).toMatch(/^\d\d:\d\d$/);
    expect(text('remaining-value')).toContain('84');
  });

  it('colours come from the theme: road palette background in every theme', () => {
    for (const p of [THEMES.demo.light, THEMES.demo.dark, THEMES.ember.light, THEMES.ember.dark]) {
      const t = mount(p);
      const root = t.root.findAll((n) => typeof n.type === 'string' && n.props.style && StyleSheet.flatten(n.props.style).flex === 1 && StyleSheet.flatten(n.props.style).backgroundColor)[0];
      expect(StyleSheet.flatten(root.props.style).backgroundColor).toBe(p.road.bg);
      act(() => t.unmount());
      mounted.pop();
    }
  });
});
