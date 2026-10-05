import React from 'react';
import { createRoot } from 'react-dom/client';
import { View, Animated } from 'react-native';

/**
 * Screenshot scenes: real screens/components with real stores, rendered by
 * react-native-web with native modules stubbed (see ./stubs). Sample data below is
 * illustrative. Run via ./run.sh (see README.md).
 */

// Screenshots show resting states: finish every animation instantly (headless
// browsers don't advance animation frames), and keep looping pulses still.
const done = (v: any, cfg: any) => ({
  start(cb?: any) { try { v.setValue(cfg.toValue); } catch {} cb?.({ finished: true }); },
  stop() {}, reset() {},
});
(Animated as any).timing = done;
(Animated as any).spring = done;
(Animated as any).loop = () => ({ start() {}, stop() {}, reset() {} });
(Animated as any).sequence = (list: any[]) => ({ start(cb?: any) { list.forEach((a) => a.start()); cb?.({ finished: true }); }, stop() {} });
(Animated as any).parallel = (Animated as any).sequence;
import { useAppStore } from '@app/store/appStore';
import { useRouteStore } from '@routing/client/routeStore';
import { useRidePlanStore } from '@app/store/ridePlanStore';
import { useStopsStore } from '@app/store/stopsStore';
import { useRidersStore } from '@app/store/ridersStore';
import { useToastStore } from '@app/store/toastStore';
import LoginScreen from '@app/screens/LoginScreen';
import GroupListScreen from '@app/screens/GroupListScreen';
import AlertsScreen from '@app/screens/AlertsScreen';
import StopsScreen from '@app/screens/StopsScreen';
import HistoryScreen from '@app/screens/HistoryScreen';
import VoiceScreen from '@app/screens/VoiceScreen';
import FamilyScreen from '@app/screens/FamilyScreen';
import MapScreen from '@app/screens/map/MapScreen';
import CreateRideModal from '@app/components/CreateRideModal';
import SosModal from '@app/components/SosModal';
import SignalSheet from '@app/components/SignalSheet';
import HazardSheet from '@app/components/HazardSheet';
import RouteSheet from '@app/components/RouteSheet';
import SettingsScreen from '@app/screens/SettingsScreen';
import { ThemeContext, buildTheme, useTheme } from '@app/theme/ThemeProvider';
import { THEMES, ThemeId, Scheme } from '@app/theme/palettes';
import ToastContainer from '@app/components/ToastContainer';
import { MainTabBar } from '@app/navigation/MainTabNavigator';

const NOW = Date.now();
const H = 3600e3;
const ts = (ms: number) => ({ toMillis: () => ms });
const members = (n: number) => Array.from({ length: n }, (_, i) => (i === 0 ? 'u1' : `u${i + 1}`));
const planA = {
  start: { label: 'Bandra, Mumbai', lat: 19.0596, lng: 72.8295 },
  destination: { label: 'Lonavala, Maharashtra', lat: 18.7546, lng: 73.4062 },
  stops: [{ id: 's1', label: 'Chai Point, Khopoli', lat: 18.79, lng: 73.34, icon: '☕' }],
};
(globalThis as any).__GROUPS__ = [
  { id: 'g1', name: 'Sunday Ghat Ride', created_by: 'u1', member_ids: members(6), created_at: ts(NOW - 5 * H), active_ride_id: null, join_code: 'K7M2QX', ride_type: 'Touring', start_time_ms: NOW + 14 * H, ride_plan: planA },
  { id: 'g2', name: 'Evening City Loop', created_by: 'u2', member_ids: members(3), created_at: ts(NOW - 9 * H), active_ride_id: null, join_code: 'H8K2QD', ride_type: 'Sport', start_time_ms: NOW + 3 * 24 * H, ride_plan: { start: { label: 'Juhu Circle, Mumbai', lat: 19.1, lng: 72.83 }, destination: { label: 'BKC, Mumbai', lat: 19.066, lng: 72.865 }, stops: [] } },
  { id: 'g3', name: 'Ride to Goa', created_by: 'u1', member_ids: members(1), created_at: ts(NOW - 2 * H), active_ride_id: null, join_code: 'P4N9TZ', ride_plan: null },
  { id: 'g4', name: 'Night Loop — BKC', created_by: 'u1', member_ids: members(4), created_at: ts(NOW - 99 * H), active_ride_id: null, join_code: 'M3C8WE', ride_type: 'Casual', start_time_ms: NOW - 3 * 24 * H, ride_plan: { start: { label: 'Bandra, Mumbai', lat: 19.0596, lng: 72.8295 }, destination: { label: 'BKC, Mumbai', lat: 19.066, lng: 72.865 }, stops: [] } },
];
(globalThis as any).__CLUSTERS__ = [
  { cluster_id: 'c1', group_id: 'g1', hazard_type: 'pothole', centroid_lat: 18.99, centroid_lng: 72.95, polygon_points: [], report_count: 4, hazard_score: 0.62, created_at_hlc: `${NOW - 6 * 60e3}:0`, status: 'active' },
  { cluster_id: 'c2', group_id: 'g1', hazard_type: 'oil_spill', centroid_lat: 18.9, centroid_lng: 73.1, polygon_points: [], report_count: 2, hazard_score: 0.41, created_at_hlc: `${NOW - 25 * 60e3}:0`, status: 'active' },
  { cluster_id: 'c3', group_id: 'g1', hazard_type: 'debris', centroid_lat: 18.8, centroid_lng: 73.3, polygon_points: [], report_count: 3, hazard_score: 0.35, created_at_hlc: `${NOW - 80 * 60e3}:0`, status: 'resolved' },
];

function seedRide() {
  useAppStore.setState({ userId: 'u1', groupId: 'g1', groupName: 'Sunday Ghat Ride', rideStartedAt: NOW - 38 * 60e3 });
  const plan = useRidePlanStore.getState();
  plan.clearPlan();
  plan.setStart(planA.start); plan.setDestination(planA.destination);
  planA.stops.forEach((s) => plan.addStop(s));
  useStopsStore.getState().syncFromPlan();
  const loc = { rider_id: 'u1', group_id: 'g1', timestamp_hlc: `${NOW}:0`, lat: 19.0, lng: 72.9, speed_mps: 12, heading_deg: 90, spoof_flag: false, nis_score: 0.4, accuracy_m: 6 };
  useRouteStore.setState({
    route: { route_id: 'r1', path_points: [[19.0596, 72.8295], [19.0, 72.9], [18.9, 73.1], [18.79, 73.34], [18.7546, 73.4062]], distance_km: 84.2, eta_minutes: 107, safety_score: 0.82, recalculated_at_hlc: '1:0' },
    currentLocation: loc, lastValidLocation: loc,
  });
  const mk = (id: string, lat: number, lng: number) => ({ rider_id: id, group_id: 'g1', timestamp_hlc: `${Date.now()}:0`, lat, lng, speed_mps: 11, heading_deg: 90, spoof_flag: false, nis_score: 0.5, accuracy_m: 8 });
  [0.0009, -0.002, 0.0034].forEach((d, i) => useRidersStore.getState().upsertRider(mk(`u${i + 2}`, 19.0 + d, 72.9)));
}

const ROUTE = { route_id: 'r1', path_points: [[19.0596, 72.8295], [19.0, 72.9], [18.9, 73.1], [18.79, 73.34], [18.7546, 73.4062]], distance_km: 84.2, eta_minutes: 107, safety_score: 0.82, recalculated_at_hlc: '1:0' };
// In the app the routing server answers; in this harness there is none, so apply its reply.
const reseedRoute = () => setTimeout(() => useRouteStore.setState({ route: ROUTE }), 700);
const nav = { navigate() {}, goBack() {}, replace() {}, reset() {}, getParent: () => ({ goBack() {} }) };
const Frame = ({ children, bg, height = 844 }: any) => {
  const { colors } = useTheme();
  return <View style={{ width: 390, height, backgroundColor: bg ?? colors.bg, overflow: 'hidden' }}>{children}</View>;
};
// A tab screen laid out like the navigator does: content above, bar below (not overlapping).
const TabScreen = ({ children, idx }: any) => (
  <Frame><View style={{ flex: 1 }}>{children}</View><MainTabBar {...tabState(idx)} /></Frame>
);
const click = (sel: string, delay = 500) => setTimeout(() => (document.querySelector(sel) as HTMLElement | null)?.click(), delay);

const tabState = (idx: number) => {
  const names = ['Home', 'Stops', 'Voice', 'Family', 'Alerts', 'History'];
  return {
    state: { index: idx, key: 'tab', routes: names.map((n) => ({ key: n, name: n })) },
    descriptors: Object.fromEntries(names.map((n) => [n, { options: {} }])),
    navigation: { emit: () => ({ defaultPrevented: false }), dispatch() {} },
  } as any;
};

const scenes: Record<string, () => React.ReactElement> = {
  login: () => <Frame><LoginScreen navigation={nav} /></Frame>,
  'login-create': () => { click('[aria-label="Switch to create account"]', 900); return <Frame><LoginScreen navigation={nav} /></Frame>; },
  groups: () => { seedRide(); return <Frame><GroupListScreen navigation={nav} /></Frame>; },
  'groups-tall': () => { seedRide(); return <Frame height={1900}><GroupListScreen navigation={nav} /></Frame>; },
  'groups-empty': () => { (globalThis as any).__GROUPS__ = []; return <Frame><GroupListScreen navigation={nav} /></Frame>; },
  'create-ride': () => {
    useRidePlanStore.getState().clearPlan();
    useRidePlanStore.getState().setStart(planA.start); useRidePlanStore.getState().setDestination(planA.destination);
    useRidePlanStore.getState().addStop(planA.stops[0]);
    return <Frame><CreateRideModal visible onClose={() => {}} onCreated={() => {}} /></Frame>;
  },
  alerts: () => { seedRide(); return <TabScreen idx={4}><AlertsScreen /></TabScreen>; },
  stops: () => { seedRide(); useStopsStore.getState().markCurrentDone(); return <TabScreen idx={1}><StopsScreen /></TabScreen>; },
  history: () => { seedRide(); return <TabScreen idx={5}><HistoryScreen navigation={nav} /></TabScreen>; },
  voice: () => { seedRide(); return <TabScreen idx={2}><VoiceScreen /></TabScreen>; },
  family: () => { seedRide(); return <TabScreen idx={3}><FamilyScreen /></TabScreen>; },
  // The live screen sits above the tab bar, like in the app.
  map: () => { seedRide(); reseedRoute(); return <TabScreen idx={0}><MapScreen navigation={nav} /></TabScreen>; },
  'map-expanded': () => { seedRide(); reseedRoute(); click('[aria-label="Route details"]', 900); return <TabScreen idx={0}><MapScreen navigation={nav} /></TabScreen>; },
  hazards: () => { seedRide(); reseedRoute(); click('[aria-label="Report a hazard"]', 900); return <TabScreen idx={0}><MapScreen navigation={nav} /></TabScreen>; },
  settings: () => <Frame><SettingsScreen navigation={nav} /></Frame>,
  sos: () => { seedRide(); return <Frame><SosModal visible riderId="u1" groupId="g1" riderCount={4} location={{ lat: 19, lng: 72.9 }} onCancel={() => {}} onSent={() => {}} /></Frame>; },
  signals: () => { seedRide(); reseedRoute(); click('[aria-label="Send a quick signal"]', 900); return <TabScreen idx={0}><MapScreen navigation={nav} /></TabScreen>; },
  tabbar: () => <Frame><View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}><MainTabBar {...tabState(0)} /></View></Frame>,
};

// #scene[:theme[:scheme]]  e.g. #map:ember:light
const [name, themeArg = 'demo', schemeArg = 'dark'] = (location.hash || '#login').slice(1).split(':');
const themeId = (themeArg === 'ember' ? 'ember' : 'demo') as ThemeId;
const scheme = (schemeArg === 'light' ? 'light' : 'dark') as Scheme;
document.body.style.background = THEMES[themeId][scheme].bg;
createRoot(document.getElementById('root')!).render(
  <ThemeContext.Provider value={buildTheme(themeId, THEMES[themeId][scheme])}>{(scenes[name] ?? scenes.login)()}</ThemeContext.Provider>,
);
