/** The Plan flow: Where -> Route -> When -> Done, with the services mocked at their boundaries. */
import React from 'react';
import { BackHandler, Share, Text, TextInput } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';

import type { Crew, Ride, UserProfile } from '../src/models/domain';
import { ThemeContext, buildTheme } from '../src/theme/ThemeProvider';
import { THEMES } from '../src/theme/palettes';
import { Icon } from '../src/ui';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SafeAreaInsetsContext: require('react').createContext(null),
}));
const mockSetString = jest.fn();
jest.mock('@react-native-clipboard/clipboard', () => ({ __esModule: true, default: { setString: (...a: any[]) => mockSetString(...a) } }));

const mockGeocode = jest.fn();
const mockReverse = jest.fn();
jest.mock('../src/utils/geocode', () => ({
  ...jest.requireActual('../src/utils/geocode'),
  geocodeSearchStrict: (...a: any[]) => mockGeocode(...a),
  reverseGeocode: (...a: any[]) => mockReverse(...a),
  geocodingAvailable: () => mockHasToken,
}));
let mockHasToken = true;
const mockPosition = jest.fn();
jest.mock('../src/utils/myPosition', () => ({ ...jest.requireActual('../src/utils/myPosition'), getMyPosition: (...a: any[]) => mockPosition(...a) }));
const mockRequestRoute = jest.fn();
const mockClientCtor = jest.fn();
jest.mock('@routing/client/routingClient', () => ({
  RoutingClient: jest.fn().mockImplementation((p: any) => { mockClientCtor(p); return { requestRoute: (...a: any[]) => mockRequestRoute(...a) }; }),
}));
let mockClusters: any[] = [];
jest.mock('@hazard/services/hazardService', () => ({
  subscribeToHazardClusters: jest.fn((_g: string, cb: (c: any[]) => void) => { cb(mockClusters); return jest.fn(); }),
}));
const mockCreateRide = jest.fn();
let mockRideDoc: Ride | null = null;
let mockRideErr = false;
jest.mock('../src/services/rideService', () => ({
  ...jest.requireActual('../src/services/rideService'),
  createRide: (...a: any[]) => mockCreateRide(...a),
  subscribeRide: jest.fn((_id: string, on: (r: Ride | null) => void, onErr?: () => void) => { if (mockRideErr) onErr?.(); else on(mockRideDoc); return jest.fn(); }),
}));

import PlanWhereScreen from '../src/screens/garage/PlanWhereScreen';
import PlanRouteScreen from '../src/screens/garage/PlanRouteScreen';
import PlanWhenScreen from '../src/screens/garage/PlanWhenScreen';
import PlanDoneScreen from '../src/screens/garage/PlanDoneScreen';
import { useCrewsStore } from '../src/store/crewsStore';
import { usePlanDraftStore } from '../src/store/planDraftStore';
import { useProfileStore } from '../src/store/profileStore';
import { useRidesStore } from '../src/store/ridesStore';
import { useSessionStore } from '../src/store/sessionStore';
import { useToastStore } from '../src/store/toastStore';

const NOW = new Date(2025, 9, 16, 22, 40).getTime(); // Thu 16 Oct 2025, 10:40 PM
const ALL = [['demo', 'light'], ['demo', 'dark'], ['ember', 'light'], ['ember', 'dark']] as const;
const place = (label: string, lat: number, lng: number) => ({ label, lat, lng });
const BANDRA = place('Bandra West', 19.06, 72.83);
const LONAVALA = place('Lonavala, Maharashtra, India', 18.75, 73.4);
const alt = (id: string, label: 'Fastest' | 'Safest' | 'Alternative', eta: number, km: number, safety: number, hz: number, path: number[][] = [[19.06, 72.83], [18.9, 73.1], [18.75, 73.4]]) => ({
  route_id: id, path_points: path, distance_km: km, eta_minutes: eta, safety_score: safety, hazard_count: hz, label,
});
const THREE = [alt('a', 'Fastest', 125, 84, 0.78, 2), alt('b', 'Safest', 132, 91, 0.91, 0), alt('c', 'Alternative', 150, 102, 0.8, 1)];
const crewA: Crew = { id: 'cA', name: 'Ghat Ghosts', created_by: 'me', member_ids: ['me', 'u2', 'u3'], roles: {}, join_code: 'GHOST7', created_ms: 1 };
const crewB: Crew = { id: 'cB', name: 'Sunday Slow Rollers', created_by: 'u9', member_ids: ['me', 'u9'], roles: {}, join_code: 'SLOW22', created_ms: 2 };
const profile = (uid: string, name: string): UserProfile => ({ uid, name, bike: 'Duke 390', style: 'Steady', stats: { km: 0, rides: 0, together_sum: 0 } });

const mounted: ReactTestRenderer[] = [];
afterEach(() => {
  mounted.splice(0).forEach((t) => act(() => t.unmount()));
  jest.useRealTimers();
});
beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  mockHasToken = true;
  mockGeocode.mockReset().mockResolvedValue([]);
  mockReverse.mockReset().mockResolvedValue('Bandra West');
  mockPosition.mockReset().mockResolvedValue({ lat: 19.06, lng: 72.83 });
  mockRequestRoute.mockReset().mockResolvedValue({ route_id: 'a', path_points: THREE[0].path_points, distance_km: 84, eta_minutes: 125, safety_score: 0.78, recalculated_at_hlc: 'x', alternatives: THREE });
  mockClientCtor.mockClear();
  mockCreateRide.mockReset().mockResolvedValue('new-ride');
  mockClusters = [];
  mockRideDoc = null;
  mockRideErr = false;
  mockSetString.mockClear();
  usePlanDraftStore.getState().reset();
  useToastStore.setState({ toasts: [] });
  useSessionStore.setState({ uid: 'me', authKnown: true });
  useRidesStore.setState({ rides: [], loaded: true, error: false });
  useCrewsStore.setState({ crews: [], loaded: true });
  useProfileStore.setState({
    me: profile('me', 'Arjun Rao'),
    byId: { me: profile('me', 'Arjun Rao'), u2: profile('u2', 'Meera Shah'), u3: profile('u3', 'Kabir Das'), u9: profile('u9', 'Zoya Khan') },
    ensure: jest.fn(async () => undefined),
  });
});

function nav() {
  return { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn(), reset: jest.fn() };
}
async function mount(Screen: React.ComponentType<any>, navigation = nav(), params?: any, id: 'demo' | 'ember' = 'demo', scheme: 'light' | 'dark' = 'light') {
  let t!: ReactTestRenderer;
  await act(async () => {
    t = create(
      <ThemeContext.Provider value={buildTheme(id, THEMES[id][scheme])}>
        <Screen navigation={navigation} route={{ key: 'k', name: 'x', params }} />
      </ThemeContext.Provider>,
    );
  });
  mounted.push(t);
  return { t, navigation };
}
const texts = (t: ReactTestRenderer) => t.root.findAllByType(Text).map((n) => [n.props.children].flat(5).filter((x) => typeof x === 'string' || typeof x === 'number').join(''));
const has = (t: ReactTestRenderer, s: string | RegExp) => texts(t).some((x) => (typeof s === 'string' ? x === s : s.test(x)));
const find = (t: ReactTestRenderer, pred: (n: any) => boolean) => t.root.findAll((n) => typeof n.props.onPress === 'function' && pred(n))[0];
const press = (t: ReactTestRenderer, label: string) => {
  const n = find(t, (x) => x.props.accessibilityLabel === label);
  if (!n) throw new Error(`no pressable "${label}" in: ${texts(t).join(' | ')}`);
  act(() => n.props.onPress());
};
const pressId = (t: ReactTestRenderer, testID: string) => {
  const n = find(t, (x) => x.props.testID === testID);
  if (!n) throw new Error(`no pressable testID ${testID}`);
  act(() => n.props.onPress());
};
const type = (t: ReactTestRenderer, value: string) => act(() => t.root.findByType(TextInput).props.onChangeText(value));
const clockText = (t: ReactTestRenderer) => t.root.findByProps({ testID: 'time-value' }).props.accessibilityLabel;
const flush = async (ms = 0) => { await act(async () => { jest.advanceTimersByTime(ms); }); };

// ═════════════════════════════════════ PlanWhere ═════════════════════════════════════
describe('PlanWhere', () => {
  it.each(ALL)('%s/%s: renders the step header, search and the start', async (id, scheme) => {
    const { t } = await mount(PlanWhereScreen, nav(), undefined, id, scheme);
    expect(has(t, 'PLAN A RIDE ∙ 1 OF 3')).toBe(true);
    expect(has(t, 'Where to?')).toBe(true);
    expect(t.root.findByProps({ testID: 'plan-search' }).props.placeholder).toBe('Search a town, ghat or lake');
    expect(t.root.findAllByProps({ testID: 'step-on' }).filter((n) => typeof n.type === 'string')).toHaveLength(1);
  });

  it('start defaults to the rider\'s current position, named by reverse geocoding', async () => {
    const { t } = await mount(PlanWhereScreen);
    expect(usePlanDraftStore.getState().start).toEqual({ label: 'Bandra West', lat: 19.06, lng: 72.83 });
    expect(has(t, 'BANDRA WEST')).toBe(true);
    expect(has(t, 'Starting from')).toBe(true);
  });
  it('falls back to a plain label when the place name can\'t be found', async () => {
    mockReverse.mockResolvedValue(null);
    await mount(PlanWhereScreen);
    expect(usePlanDraftStore.getState().start?.label).toBe('My location');
  });
  it('says so (and does not invent a start) when there is no location fix', async () => {
    mockPosition.mockResolvedValue(null);
    const { t } = await mount(PlanWhereScreen);
    expect(usePlanDraftStore.getState().start).toBeNull();
    expect(has(t, /couldn’t find your location/)).toBe(true);
    expect(has(t, 'CHOOSE A START')).toBe(true);
  });
  it('keeps a start chosen earlier (no re-locating)', async () => {
    usePlanDraftStore.getState().setStart(place('Dadar', 19.02, 72.84));
    await mount(PlanWhereScreen);
    expect(mockPosition).not.toHaveBeenCalled();
  });

  describe('popular with crews', () => {
    const ride = (id: string, dest: string, crew: string | null): Ride => ({
      id, name: id, created_by: 'me', member_ids: ['me'], crew_id: crew, join_code: null, ride_type: null, pace: null, start_time_ms: 1, status: 'planned', started_ms: null, finished_ms: null,
      meetup: null, invited_ids: [], created_ms: 1, ride_plan: { start: null, stops: [], destination: place(dest, 18.75, 73.4) },
    });
    it('lists destinations of rides in the rider\'s crews and opens PlanRoute with it', async () => {
      useCrewsStore.setState({ crews: [crewA] });
      useRidesStore.setState({ rides: [ride('1', 'Lonavala, India', 'cA'), ride('2', 'Lonavala, India', 'cA'), ride('3', 'Karjat', 'cA'), ride('4', 'Alibag', 'other'), ride('5', 'Pune', null)] });
      const { t, navigation } = await mount(PlanWhereScreen);
      expect(has(t, 'POPULAR WITH CREWS NEAR YOU')).toBe(true);
      expect(has(t, 'Lonavala')).toBe(true);
      expect(has(t, 'Ghat Ghosts ∙ 2 rides')).toBe(true);
      expect(has(t, 'Alibag')).toBe(false);
      expect(has(t, 'Pune')).toBe(false);
      expect(has(t, /^~\d+ km$/)).toBe(true);
      pressId(t, 'popular-0');
      expect(usePlanDraftStore.getState().destination).toEqual({ label: 'Lonavala, India', lat: 18.75, lng: 73.4 });
      expect(navigation.navigate).toHaveBeenCalledWith('PlanRoute');
    });
    it('is hidden when no crew has a ride (no invented places)', async () => {
      const { t } = await mount(PlanWhereScreen);
      expect(has(t, 'POPULAR WITH CREWS NEAR YOU')).toBe(false);
      expect(t.root.findAllByProps({ testID: 'plan-where-hint' }).length).toBeGreaterThan(0);
    });
  });

  describe('search', () => {
    it('debounces, shows loading, then the results; choosing one opens PlanRoute', async () => {
      mockGeocode.mockResolvedValue([{ label: 'Lonavala, Maharashtra, India', lat: 18.75, lng: 73.4 }, { label: 'Lonavla Lake, India', lat: 18.7, lng: 73.4 }]);
      const { t, navigation } = await mount(PlanWhereScreen);
      type(t, 'lon');
      expect(t.root.findAllByProps({ testID: 'search-loading' }).length).toBeGreaterThan(0);
      expect(mockGeocode).not.toHaveBeenCalled();
      await flush(450);
      expect(mockGeocode).toHaveBeenCalledWith('lon');
      expect(has(t, 'RESULTS')).toBe(true);
      expect(has(t, 'Lonavala')).toBe(true);
      expect(has(t, 'Maharashtra, India')).toBe(true);
      press(t, 'Select Lonavala, Maharashtra, India');
      expect(usePlanDraftStore.getState().destination).toEqual({ label: 'Lonavala, Maharashtra, India', lat: 18.75, lng: 73.4 });
      expect(navigation.navigate).toHaveBeenCalledWith('PlanRoute');
    });
    it('a query under 3 letters does not search', async () => {
      const { t } = await mount(PlanWhereScreen);
      type(t, 'lo');
      await flush(500);
      expect(mockGeocode).not.toHaveBeenCalled();
    });
    it('empty result and error states, with Retry', async () => {
      mockGeocode.mockResolvedValueOnce([]);
      const { t } = await mount(PlanWhereScreen);
      type(t, 'zzzz');
      await flush(450);
      expect(has(t, 'No places found for “zzzz”.')).toBe(true);
      mockGeocode.mockRejectedValueOnce(new Error('offline'));
      type(t, 'lonav');
      await flush(450);
      expect(t.root.findAllByProps({ testID: 'search-error' }).length).toBeGreaterThan(0);
      expect(has(t, 'Search is unavailable. Check your connection.')).toBe(true);
      mockGeocode.mockResolvedValueOnce([{ label: 'Lonavala', lat: 1, lng: 2 }]);
      press(t, 'Retry search');
      await flush(450);
      expect(has(t, 'Lonavala')).toBe(true);
    });
    it('without a map token it says search is unavailable instead of failing', async () => {
      mockHasToken = false;
      const { t } = await mount(PlanWhereScreen);
      type(t, 'lonavala');
      await flush(500);
      expect(has(t, 'Place search isn’t available in this build.')).toBe(true);
      expect(mockGeocode).not.toHaveBeenCalled();
    });
    it('the start can be changed to a searched place (and does not leave the screen)', async () => {
      mockGeocode.mockResolvedValue([{ label: 'Dadar, Mumbai', lat: 19.02, lng: 72.84 }]);
      const { t, navigation } = await mount(PlanWhereScreen);
      press(t, 'Starting from Bandra West. Tap to change');
      expect(has(t, 'Starting from?')).toBe(true);
      expect(t.root.findByProps({ testID: 'plan-search' }).props.placeholder).toBe('Search a starting point');
      type(t, 'dadar');
      await flush(450);
      press(t, 'Select Dadar, Mumbai');
      expect(usePlanDraftStore.getState().start).toEqual({ label: 'Dadar, Mumbai', lat: 19.02, lng: 72.84 });
      expect(usePlanDraftStore.getState().destination).toBeNull();
      expect(navigation.navigate).not.toHaveBeenCalled();
      expect(has(t, 'Where to?')).toBe(true);
    });
  });
  it('Back goes back', async () => {
    const { t, navigation } = await mount(PlanWhereScreen);
    press(t, 'Back');
    expect(navigation.goBack).toHaveBeenCalled();
  });
});

// ═════════════════════════════════════ PlanRoute ═════════════════════════════════════
describe('PlanRoute', () => {
  const ready = () => {
    usePlanDraftStore.getState().setStart(BANDRA);
    usePlanDraftStore.getState().setDestination(LONAVALA);
  };

  it.each(ALL)('%s/%s: shows the server\'s three options with real numbers and no Scenic option', async (id, scheme) => {
    ready();
    const { t } = await mount(PlanRouteScreen, nav(), undefined, id, scheme);
    expect(has(t, 'PLAN A RIDE ∙ 2 OF 3')).toBe(true);
    expect(has(t, 'Bandra West → Lonavala')).toBe(true);
    expect(has(t, 'Fastest')).toBe(true);
    expect(has(t, 'Safest')).toBe(true);
    expect(has(t, 'Alternative')).toBe(true);
    expect(has(t, '2h 05')).toBe(true);
    expect(has(t, '2h 12')).toBe(true);
    expect(has(t, '84 km')).toBe(true);
    expect(has(t, '102 km')).toBe(true);
    expect(has(t, '78')).toBe(true);
    expect(has(t, '91')).toBe(true);
    expect(has(t, 'Passes 2 reported hazards')).toBe(true);
    expect(has(t, 'No reported hazards on this route ∙ +7 min')).toBe(true);
    expect(has(t, 'RECOMMENDED')).toBe(true);
    expect(texts(t).join('|')).not.toMatch(/scenic/i);
    expect(['route-option-0', 'route-option-1', 'route-option-2'].every((id) => t.root.findAllByProps({ testID: id }).length > 0)).toBe(true);
    expect(t.root.findAllByProps({ testID: 'route-option-3' })).toHaveLength(0);
  });

  it('asks the routing server with the start, destination, every hazard type and the real active clusters', async () => {
    ready();
    mockClusters = [{ cluster_id: 'h1', group_id: 'g', hazard_type: 'pothole', centroid_lat: 18.9, centroid_lng: 73.1, polygon_points: [], report_count: 2, hazard_score: 0.7, created_at_hlc: 'x', status: 'active' }];
    useRidesStore.setState({ rides: [{ id: 'g' } as any] });
    await mount(PlanRouteScreen);
    expect(mockClientCtor).toHaveBeenCalledWith({ baseUrl: 'http://localhost:3000' });
    const req = mockRequestRoute.mock.calls[0][0];
    expect(req).toMatchObject({
      group_id: 'plan-me', origin: { lat: 19.06, lng: 72.83 }, destination: { lat: 18.75, lng: 73.4 },
      avoid_hazard_types: ['pothole', 'oil_spill', 'accident', 'debris', 'other'],
    });
    expect(req.active_hazards).toEqual([{ centroid_lat: 18.9, centroid_lng: 73.1, hazard_type: 'pothole', hazard_score: 0.7 }]);
  });

  it('draws hazard diamonds for the real clusters near the chosen path and counts them', async () => {
    ready();
    mockClusters = [
      { cluster_id: 'on', group_id: 'g', hazard_type: 'pothole', centroid_lat: 18.9, centroid_lng: 73.1, polygon_points: [], report_count: 2, hazard_score: 1, created_at_hlc: 'x', status: 'active' },
      { cluster_id: 'off', group_id: 'g', hazard_type: 'pothole', centroid_lat: 10, centroid_lng: 70, polygon_points: [], report_count: 2, hazard_score: 1, created_at_hlc: 'x', status: 'active' },
    ];
    useRidesStore.setState({ rides: [{ id: 'g' } as any] });
    const { t } = await mount(PlanRouteScreen);
    expect(has(t, '1 HAZARD ON ROUTE')).toBe(true);
    const map = t.root.findByProps({ testID: 'route-map' });
    expect(map.props.markers).toEqual([{ lat: 18.9, lng: 73.1, kind: 'hazard' }]);
  });
  it('pre-selects the first option when the server returned no Safest one', async () => {
    ready();
    const onlyFast = [alt('a', 'Fastest', 125, 84, 0.78, 2), alt('c', 'Alternative', 150, 102, 0.8, 1)];
    mockRequestRoute.mockResolvedValue({ route_id: 'a', path_points: onlyFast[0].path_points, distance_km: 84, eta_minutes: 125, safety_score: 0.78, recalculated_at_hlc: 'x', alternatives: onlyFast });
    const { t } = await mount(PlanRouteScreen);
    expect(usePlanDraftStore.getState()).toMatchObject({ chosenOption: 0, route: { route_id: 'a' } });
    expect(has(t, 'RECOMMENDED')).toBe(false);
  });
  it('the map pill carries the hazard icon', async () => {
    ready();
    const { t } = await mount(PlanRouteScreen);
    const pill = t.root.findByProps({ testID: 'route-haz-pill' });
    expect(pill.findAllByType(Icon).some((i: any) => i.props.name === 'haz')).toBe(true);
  });
  it('no clusters -> "No hazards on route"', async () => {
    ready();
    const { t } = await mount(PlanRouteScreen);
    expect(has(t, 'NO HAZARDS ON ROUTE')).toBe(true);
  });

  it('choosing an option changes the map and what "Use this route" saves; then opens PlanWhen', async () => {
    ready();
    const { t, navigation } = await mount(PlanRouteScreen);
    // The Safest option (the Recommended card) is pre-selected.
    expect(usePlanDraftStore.getState()).toMatchObject({ chosenOption: 1, route: { route_id: 'b' } });
    expect(has(t, 'RECOMMENDED')).toBe(true);
    pressId(t, 'route-option-0');
    expect(usePlanDraftStore.getState()).toMatchObject({ chosenOption: 0, route: { route_id: 'a' } });
    expect(t.root.findAll((n) => n.props.testID === 'route-option-0' && n.props.accessibilityState)[0].props.accessibilityState.selected).toBe(true);
    pressId(t, 'use-route');
    expect(navigation.navigate).toHaveBeenCalledWith('PlanWhen');
  });

  it('shows a loading state, then an error with Try again', async () => {
    ready();
    let reject!: (e: unknown) => void;
    mockRequestRoute.mockReturnValueOnce(new Promise((_r, rej) => { reject = rej; }));
    const { t } = await mount(PlanRouteScreen);
    expect(t.root.findAllByProps({ testID: 'route-loading' }).length).toBeGreaterThan(0);
    expect(find(t, (n) => n.props.testID === 'use-route')?.props.disabled ?? true).toBeTruthy();
    await act(async () => reject(new Error('offline')));
    expect(t.root.findAllByProps({ testID: 'route-error' }).length).toBeGreaterThan(0);
    expect(has(t, /couldn’t get routes/)).toBe(true);
    press(t, 'Try again');
    await flush();
    expect(mockRequestRoute).toHaveBeenCalledTimes(2);
    expect(has(t, 'Fastest')).toBe(true);
  });

  it('an older server (no alternatives) gives one honest option', async () => {
    ready();
    mockRequestRoute.mockResolvedValue({ route_id: 'solo', path_points: [[19.06, 72.83], [18.75, 73.4]], distance_km: 60, eta_minutes: 90, safety_score: 1, recalculated_at_hlc: 'x' });
    const { t } = await mount(PlanRouteScreen);
    expect(has(t, 'Your route')).toBe(true);
    expect(has(t, 'RECOMMENDED')).toBe(false);
    expect(has(t, '1h 30')).toBe(true);
  });

  it('distances follow the rider\'s units', async () => {
    ready();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { usePrefsStore } = require('../src/store/prefsStore');
    usePrefsStore.setState({ prefs: { ...usePrefsStore.getState().prefs, units: 'mi' } });
    const { t } = await mount(PlanRouteScreen);
    expect(has(t, '52 mi')).toBe(true);
    usePrefsStore.setState({ prefs: { ...usePrefsStore.getState().prefs, units: 'km' } });
  });

  it('with no start chosen it uses the rider\'s position', async () => {
    usePlanDraftStore.getState().setDestination(LONAVALA);
    await mount(PlanRouteScreen);
    expect(usePlanDraftStore.getState().start).toEqual({ label: 'Bandra West', lat: 19.06, lng: 72.83 });
    expect(mockRequestRoute).toHaveBeenCalledTimes(1);
    expect(mockRequestRoute.mock.calls[0][0].origin).toEqual({ lat: 19.06, lng: 72.83 });
  });
  it('and says so when it cannot find the rider', async () => {
    usePlanDraftStore.getState().setDestination(LONAVALA);
    mockPosition.mockResolvedValue(null);
    const { t, navigation } = await mount(PlanRouteScreen);
    expect(t.root.findAllByProps({ testID: 'route-nostart' }).length).toBeGreaterThan(0);
    expect(mockRequestRoute).not.toHaveBeenCalled();
    press(t, 'Choose a start');
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('coming back from PlanWhen keeps the options and the choice without asking again', async () => {
    ready();
    usePlanDraftStore.getState().setOptions(THREE, 2);
    const { t } = await mount(PlanRouteScreen);
    expect(mockRequestRoute).not.toHaveBeenCalled();
    expect(t.root.findAll((n) => n.props.testID === 'route-option-2' && n.props.accessibilityState)[0].props.accessibilityState.selected).toBe(true);
  });
});

// ═════════════════════════════════════ PlanWhen ═════════════════════════════════════
describe('PlanWhen', () => {
  const ready = (crews: Crew[] = [crewA]) => {
    useCrewsStore.setState({ crews });
    const d = usePlanDraftStore.getState();
    d.setStart(BANDRA);
    d.setDestination(LONAVALA);
    d.setOptions(THREE, 0);
  };

  it.each(ALL)('%s/%s: renders the demo\'s controls', async (id, scheme) => {
    ready();
    const { t } = await mount(PlanWhenScreen, nav(), undefined, id, scheme);
    expect(has(t, 'PLAN A RIDE ∙ 3 OF 3')).toBe(true);
    expect(has(t, 'When, and with whom?')).toBe(true);
    for (const l of ['Today', 'Tomorrow', 'Sat 18 Oct', 'Sun 19 Oct']) expect(has(t, l)).toBe(true);
    expect(clockText(t)).toBe('Roll out at 6:30 AM');
    expect(has(t, 'PACE')).toBe(true);
    for (const l of ['Relaxed', 'Steady', 'Spirited']) expect(has(t, l)).toBe(true);
    expect(has(t, 'Create ride')).toBe(true);
  });

  it('without a chosen route it asks to start over rather than creating nothing', async () => {
    const { t, navigation } = await mount(PlanWhenScreen);
    expect(has(t, 'Choose where you are riding and a route first.')).toBe(true);
    press(t, 'Start over');
    expect(navigation.navigate).toHaveBeenCalledWith('PlanWhere');
  });

  it('day chips: Today, Tomorrow (default), then the next two dates', async () => {
    ready();
    const { t } = await mount(PlanWhenScreen);
    const sel = (id: string) => t.root.findAll((n) => n.props.testID === id && n.props.accessibilityState)[0].props.accessibilityState.selected;
    expect(sel('day-1')).toBe(true);
    pressId(t, 'day-3');
    expect(usePlanDraftStore.getState().dayOffset).toBe(3);
    expect(sel('day-3')).toBe(true);
    expect(sel('day-1')).toBe(false);
  });

  it('the roll-out time steps 15 minutes, shows correct AM/PM and stops at 5:00 and 10:00', async () => {
    ready();
    const { t } = await mount(PlanWhenScreen);
    pressId(t, 'time-plus');
    expect(clockText(t)).toBe('Roll out at 6:45 AM');
    pressId(t, 'time-minus');
    pressId(t, 'time-minus');
    expect(clockText(t)).toBe('Roll out at 6:15 AM');
    for (let i = 0; i < 12; i++) pressId(t, 'time-minus');
    expect(clockText(t)).toBe('Roll out at 5:00 AM');
    expect(find(t, (n) => n.props.testID === 'time-minus')?.props.disabled).toBeTruthy();
    usePlanDraftStore.setState({ timeMin: 600 });
    await act(async () => undefined);
    expect(clockText(t)).toBe('Roll out at 10:00 AM');
    expect(find(t, (n) => n.props.testID === 'time-plus')?.props.disabled).toBeTruthy();
  });

  it('a time that has already passed today blocks Create ride and says why', async () => {
    jest.setSystemTime(new Date(2025, 9, 16, 8, 0).getTime());
    ready();
    usePlanDraftStore.getState().setDay(0);
    const { t } = await mount(PlanWhenScreen);
    expect(t.root.findAllByProps({ testID: 'time-past' }).length).toBeGreaterThan(0);
    pressId(t, 'create-ride');
    expect(mockCreateRide).not.toHaveBeenCalled();
    pressId(t, 'day-1');
    expect(t.root.findAllByProps({ testID: 'time-past' })).toHaveLength(0);
  });

  describe('crew + invitees', () => {
    it('defaults to the rider\'s crew with every other member invited (real names)', async () => {
      ready();
      const { t } = await mount(PlanWhenScreen);
      expect(usePlanDraftStore.getState()).toMatchObject({ crewId: 'cA', invitees: ['u2', 'u3'], crewTouched: false });
      expect(has(t, 'CREW ∙ 2 INVITED')).toBe(true);
      expect(has(t, 'Meera Shah')).toBe(true);
      expect(has(t, 'Kabir Das')).toBe(true);
      expect(has(t, 'Arjun Rao')).toBe(false); // the rider is not one of their own invitees
      pressId(t, 'invitee-u3');
      expect(usePlanDraftStore.getState().invitees).toEqual(['u2']);
      expect(has(t, 'CREW ∙ 1 INVITED')).toBe(true);
    });
    it('with several crews a chip row picks the crew (and Solo)', async () => {
      ready([crewA, crewB]);
      const { t } = await mount(PlanWhenScreen);
      pressId(t, 'crew-cB');
      expect(usePlanDraftStore.getState()).toMatchObject({ crewId: 'cB', invitees: ['u9'], crewTouched: true });
      expect(has(t, 'Zoya Khan')).toBe(true);
      expect(has(t, 'Meera Shah')).toBe(false);
      pressId(t, 'crew-solo');
      expect(usePlanDraftStore.getState()).toMatchObject({ crewId: null, invitees: [] });
      expect(t.root.findAllByProps({ testID: 'solo-note' }).length).toBeGreaterThan(0);
      expect(has(t, 'RIDERS')).toBe(true);
    });
    it('a rider with no crew rides solo with a code', async () => {
      ready([]);
      const { t } = await mount(PlanWhenScreen);
      expect(usePlanDraftStore.getState().crewId).toBeNull();
      expect(has(t, /not in a crew yet/)).toBe(true);
      expect(t.root.findAllByProps({ testID: 'crew-solo' })).toHaveLength(0);
    });
    it('a solo choice survives going back and forth', async () => {
      ready();
      const first = await mount(PlanWhenScreen);
      pressId(first.t, 'crew-solo');
      act(() => first.t.unmount());
      mounted.pop();
      await mount(PlanWhenScreen);
      expect(usePlanDraftStore.getState().crewId).toBeNull();
    });
  });

  it('pace is a real choice', async () => {
    ready();
    const { t } = await mount(PlanWhenScreen);
    press(t, 'Spirited');
    expect(usePlanDraftStore.getState().pace).toBe('Spirited');
  });

  describe('fuel / chai stops', () => {
    const FUEL = { label: 'HP Petrol Pump, Khopoli, India', lat: 18.9, lng: 73.1 };
    it('add a real stop found near the route midpoint; toggling off removes it', async () => {
      ready();
      mockGeocode.mockResolvedValue([FUEL]);
      const { t } = await mount(PlanWhenScreen);
      expect(has(t, 'Find a fuel station near the route')).toBe(true);
      const toggle = () => find(t, (n) => n.props.testID === 'toggle-fuel');
      await act(async () => toggle().props.onPress());
      const [query, limit, opts] = mockGeocode.mock.calls[0];
      expect(query).toBe('fuel station');
      expect(limit).toBe(5);
      expect(opts.proximity.lat).toBeCloseTo(18.9, 1); // the middle of the path
      expect(usePlanDraftStore.getState().stops).toEqual([{ id: 'plan-fuel', label: FUEL.label, lat: 18.9, lng: 73.1, icon: '⛽' }]);
      expect(has(t, /^HP Petrol Pump ∙ after \d+ km$/)).toBe(true);
      await act(async () => toggle().props.onPress());
      expect(usePlanDraftStore.getState().stops).toEqual([]);
    });
    it('chai uses a cafe search', async () => {
      ready();
      mockGeocode.mockResolvedValue([{ label: 'Chai Point, Khopoli', lat: 18.9, lng: 73.1 }]);
      const { t } = await mount(PlanWhenScreen);
      await act(async () => find(t, (n) => n.props.testID === 'toggle-chai').props.onPress());
      expect(mockGeocode.mock.calls[0][0]).toBe('cafe');
      expect(usePlanDraftStore.getState().stops[0]).toMatchObject({ id: 'plan-chai', icon: '☕' });
    });
    it('a result far from the route is not offered; says none found', async () => {
      ready();
      mockGeocode.mockResolvedValue([{ label: 'Far away', lat: 10, lng: 70 }]);
      const { t } = await mount(PlanWhenScreen);
      await act(async () => find(t, (n) => n.props.testID === 'toggle-fuel').props.onPress());
      expect(usePlanDraftStore.getState().stops).toEqual([]);
      expect(usePlanDraftStore.getState().fuel).toBe(false);
      expect(has(t, 'No fuel station found near your route.')).toBe(true);
    });
    it('a failed search says so and leaves the toggle off', async () => {
      ready();
      mockGeocode.mockRejectedValue(new Error('offline'));
      const { t } = await mount(PlanWhenScreen);
      await act(async () => find(t, (n) => n.props.testID === 'toggle-chai').props.onPress());
      expect(has(t, 'Search is unavailable. Check your connection.')).toBe(true);
      expect(usePlanDraftStore.getState().chai).toBe(false);
    });
    it('the toggles are hidden without a map token', async () => {
      mockHasToken = false;
      ready();
      const { t } = await mount(PlanWhenScreen);
      expect(has(t, 'Fuel stop')).toBe(false);
      expect(has(t, 'Chai break')).toBe(false);
    });
  });

  describe('Create ride', () => {
    it('writes the ride with what was chosen and goes to PlanDone', async () => {
      ready();
      mockGeocode.mockImplementation(async (q: string) => (q === 'cafe' ? [{ label: 'Chai Point', lat: 18.8, lng: 73.3 }] : [{ label: 'HP Fuel', lat: 18.9, lng: 73.1 }]));
      const { t, navigation } = await mount(PlanWhenScreen);
      pressId(t, 'day-2');
      pressId(t, 'time-plus');
      press(t, 'Spirited');
      pressId(t, 'invitee-u3');
      await act(async () => find(t, (n) => n.props.testID === 'toggle-chai').props.onPress());
      await act(async () => find(t, (n) => n.props.testID === 'toggle-fuel').props.onPress());
      await act(async () => pressId(t, 'create-ride'));
      expect(mockCreateRide).toHaveBeenCalledTimes(1);
      const input = mockCreateRide.mock.calls[0][0];
      expect(input).toMatchObject({
        name: 'Lonavala Run', crewId: 'cA', start: BANDRA, destination: LONAVALA, startTimeMs: new Date(2025, 9, 18, 6, 45).getTime(),
        pace: 'Spirited', invitedIds: ['u2'], meetup: BANDRA,
        route: { distanceKm: 84, etaMinutes: 125, safetyScore: 0.78 },
      });
      expect(input.route.path[0]).toEqual({ lat: 19.06, lng: 72.83 });
      // stops are ordered along the route: the fuel stop (18.9,73.1) comes before the cafe (18.8,73.3)
      expect(input.stops.map((s: any) => s.id)).toEqual(['plan-fuel', 'plan-chai']);
      expect(navigation.replace).toHaveBeenCalledWith('PlanDone', { rideId: 'new-ride' });
    });
    it('a solo ride has no crew and no invitees', async () => {
      ready([]);
      const { t } = await mount(PlanWhenScreen);
      await act(async () => pressId(t, 'create-ride'));
      expect(mockCreateRide.mock.calls[0][0]).toMatchObject({ crewId: null, invitedIds: [] });
    });
    it('only invites members of the chosen crew', async () => {
      ready();
      const { t } = await mount(PlanWhenScreen);
      act(() => usePlanDraftStore.setState({ invitees: ['u2', 'stranger'] }));
      await act(async () => pressId(t, 'create-ride'));
      expect(mockCreateRide.mock.calls[0][0].invitedIds).toEqual(['u2']);
    });
    it('a failed write shows an error, tells the rider and stays on the screen (can retry)', async () => {
      ready();
      mockCreateRide.mockRejectedValueOnce(new Error('unavailable'));
      const { t, navigation } = await mount(PlanWhenScreen);
      await act(async () => pressId(t, 'create-ride'));
      expect(has(t, 'Could not create the ride. Check your connection and try again.')).toBe(true);
      expect(navigation.replace).not.toHaveBeenCalled();
      expect(useToastStore.getState().toasts.map((x) => x.variant)).toContain('error');
      await act(async () => pressId(t, 'create-ride'));
      expect(navigation.replace).toHaveBeenCalledWith('PlanDone', { rideId: 'new-ride' });
    });
  });
});

// ═════════════════════════════════════ PlanDone ═════════════════════════════════════
describe('PlanDone', () => {
  const rideDoc = (over: Partial<Ride> = {}): Ride => {
    const r: any = {
      id: 'new-ride', name: 'Lonavala Run', created_by: 'me', member_ids: ['me', 'u2'], crew_id: 'cA', join_code: 'RIDE22', ride_type: null, pace: 'Steady',
      start_time_ms: new Date(2025, 9, 17, 6, 30).getTime(), status: 'planned', started_ms: null, finished_ms: null, meetup: BANDRA,
      ride_plan: { start: BANDRA, stops: [], destination: LONAVALA }, invited_ids: ['u2'], created_ms: 1, ...over,
    };
    r.route_stats = { distance_km: 84, eta_minutes: 125, safety_score: 0.9, path: [{ lat: 19.06, lng: 72.83 }, { lat: 18.75, lng: 73.4 }] };
    return r;
  };

  it.each(ALL)('%s/%s: green plate, the ticket and the crew\'s code', async (id, scheme) => {
    useCrewsStore.setState({ crews: [crewA] });
    mockRideDoc = rideDoc();
    const { t } = await mount(PlanDoneScreen, nav(), { rideId: 'new-ride' }, id, scheme);
    expect(has(t, 'RIDE CREATED')).toBe(true);
    expect(has(t, 'Your crew will see it in Rides')).toBe(true);
    expect(has(t, 'Lonavala Run')).toBe(true);
    expect(has(t, 'Tomorrow ∙ 6:30 AM ∙ 84 km ∙ Ghat Ghosts')).toBe(true);
    expect(has(t, 'INVITE CODE')).toBe(true);
    expect(t.root.findByProps({ testID: 'invite-code' }).props.children).toBe('GHOST7');
    expect(texts(t).join('|')).not.toMatch(/notified/i);
    expect(texts(t).join('|')).not.toMatch(/calendar/i);
  });

  it('a ride without a crew shows the ride\'s own code and says to share it', async () => {
    mockRideDoc = rideDoc({ crew_id: null });
    const { t } = await mount(PlanDoneScreen, nav(), { rideId: 'new-ride' });
    expect(t.root.findByProps({ testID: 'invite-code' }).props.children).toBe('RIDE22');
    expect(has(t, 'Share the code to invite riders')).toBe(true);
    expect(has(t, 'Tomorrow ∙ 6:30 AM ∙ 84 km')).toBe(true);
  });

  it('Copy puts the code on the clipboard; Share opens the OS share sheet with it', async () => {
    useCrewsStore.setState({ crews: [crewA] });
    mockRideDoc = rideDoc();
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as any);
    const { t } = await mount(PlanDoneScreen, nav(), { rideId: 'new-ride' });
    pressId(t, 'copy-code');
    expect(mockSetString).toHaveBeenCalledWith('GHOST7');
    expect(useToastStore.getState().toasts[0].message).toBe('Code copied');
    await act(async () => pressId(t, 'share-code'));
    expect(share).toHaveBeenCalledWith({ message: expect.stringContaining('GHOST7') });
    expect((share.mock.calls[0][0] as any).message).toContain('Lonavala Run');
    share.mockRestore();
  });

  it('Back to rides resets to the garage tabs and clears the plan', async () => {
    mockRideDoc = rideDoc();
    usePlanDraftStore.getState().setPace('Spirited');
    const { t, navigation } = await mount(PlanDoneScreen, nav(), { rideId: 'new-ride' });
    pressId(t, 'back-to-rides');
    expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'GarageTabs' }] });
    expect(usePlanDraftStore.getState().pace).toBe('Steady');
  });

  it('Android back also goes to the rides list, not back into the planner', async () => {
    mockRideDoc = rideDoc();
    const add = jest.spyOn(BackHandler, 'addEventListener');
    const { navigation } = await mount(PlanDoneScreen, nav(), { rideId: 'new-ride' });
    const handler = add.mock.calls.find((c) => c[0] === 'hardwareBackPress')![1];
    expect(handler()).toBe(true);
    expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'GarageTabs' }] });
    add.mockRestore();
  });

  it('if the ride cannot be read it says it was created and will appear in Rides', async () => {
    mockRideErr = true;
    const { t } = await mount(PlanDoneScreen, nav(), { rideId: 'new-ride' });
    expect(has(t, /Your ride was created, but we can’t show it right now/)).toBe(true);
    expect(t.root.findAllByProps({ testID: 'invite-card' })).toHaveLength(0);
  });
});
