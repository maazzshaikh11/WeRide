/**
 * Ride tab: the hero by ride status, weather, route intel, upcoming rides, "Where next?", crew pulse — all
 * from real (mocked-at-the-boundary) data, in all four themes.
 */
import React from 'react';
import { Text } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';

import type { Crew, PresenceDoc, Ride, RideLog, RollCallDoc, RsvpDoc, UserProfile } from '../src/models/domain';
import { ThemeContext, buildTheme } from '../src/theme/ThemeProvider';
import { THEMES } from '../src/theme/palettes';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SafeAreaInsetsContext: require('react').createContext(null),
}));
jest.mock('@react-native-clipboard/clipboard', () => ({ __esModule: true, default: { setString: jest.fn() } }));

// ── boundaries ──
const mockDocs: { rsvp: RsvpDoc[]; rollCall: RollCallDoc[]; presence: PresenceDoc[] } = { rsvp: [], rollCall: [], presence: [] };
const mockSetRsvp = jest.fn(() => Promise.resolve());
const mockSetRideStatus = jest.fn(() => Promise.resolve());
jest.mock('../src/services/rideService', () => ({
  ...jest.requireActual('../src/services/rideService'),
  subscribeRsvp: jest.fn((_id: string, on: (d: RsvpDoc[]) => void) => { on(mockDocs.rsvp); return jest.fn(); }),
  subscribeRollCall: jest.fn((_id: string, on: (d: RollCallDoc[]) => void) => { on(mockDocs.rollCall); return jest.fn(); }),
  subscribePresence: jest.fn((_id: string, on: (d: PresenceDoc[]) => void) => { on(mockDocs.presence); return jest.fn(); }),
  setRsvp: (...a: any[]) => (mockSetRsvp as any)(...a),
  setRideStatus: (...a: any[]) => (mockSetRideStatus as any)(...a),
}));
let mockLogs: RideLog[] = [];
jest.mock('../src/services/rideLogService', () => ({
  subscribeRideLogs: jest.fn((_uid: string, on: (l: RideLog[]) => void) => { on(mockLogs); return jest.fn(); }),
}));
let mockClusters: any[] = [];
jest.mock('@hazard/services/hazardService', () => ({
  subscribeToHazardClusters: jest.fn((_g: string, cb: (c: any[]) => void) => { cb(mockClusters); return jest.fn(); }),
}));
const mockFetchWeather = jest.fn();
jest.mock('../src/utils/weather', () => ({ ...jest.requireActual('../src/utils/weather'), fetchWeather: (...a: any[]) => mockFetchWeather(...a) }));
jest.mock('../src/utils/myPosition', () => ({ ...jest.requireActual('../src/utils/myPosition'), getMyPosition: jest.fn(() => Promise.resolve({ lat: 19.07, lng: 72.87 })) }));
const mockReset = jest.fn();
jest.mock('../src/store/rideSession', () => ({ resetRideSession: () => mockReset() }));

import RideHomeScreen from '../src/screens/garage/RideHomeScreen';
import { useAppStore } from '../src/store/appStore';
import { useCrewsStore } from '../src/store/crewsStore';
import { usePlanDraftStore } from '../src/store/planDraftStore';
import { useProfileStore } from '../src/store/profileStore';
import { useRidesStore } from '../src/store/ridesStore';
import { useSessionStore } from '../src/store/sessionStore';
import { useToastStore } from '../src/store/toastStore';
import { usePrefsStore } from '../src/store/prefsStore';

const NOW = new Date(2025, 9, 11, 5, 41, 0).getTime(); // Sat 11 Oct 2025, 5:41 AM local
const START = new Date(2025, 9, 11, 6, 30, 0).getTime(); // 49 minutes later
const ALL = [['demo', 'light'], ['demo', 'dark'], ['ember', 'light'], ['ember', 'dark']] as const;

const place = (label: string, lat: number, lng: number) => ({ label, lat, lng });
function ride(over: Partial<Ride> & { route?: any } = {}): Ride {
  const { route, ...rest } = over;
  const r: Ride = {
    id: 'r1', name: 'Sunrise Ghat Run', created_by: 'me', member_ids: ['me', 'u2', 'u3'], crew_id: 'c1', join_code: 'RIDE22', ride_type: null, pace: 'Steady',
    start_time_ms: START, status: 'planned', started_ms: null, finished_ms: null, meetup: place('Bandra Fort', 19.04, 72.82),
    ride_plan: { start: place('Bandra Fort', 19.04, 72.82), stops: [], destination: place('Lonavala, Maharashtra', 18.75, 73.4) }, invited_ids: ['u2', 'u3'], created_ms: 1,
    ...rest,
  };
  (r as any).route_stats = route === undefined ? { distance_km: 84.2, eta_minutes: 125, safety_score: 0.91, path: [{ lat: 19.04, lng: 72.82 }, { lat: 18.9, lng: 73.1 }, { lat: 18.75, lng: 73.4 }] } : route;
  return r;
}
const crew: Crew = { id: 'c1', name: 'Ghat Ghosts', created_by: 'me', member_ids: ['me', 'u2', 'u3'], roles: { u2: 'lead', u3: 'sweep' }, join_code: 'GHOST7', created_ms: 1 };
const profile = (uid: string, name: string): UserProfile => ({ uid, name, bike: 'Duke 390', style: 'Steady', stats: { km: 0, rides: 0, together_sum: 0 } });
const log = (rideId: string, riders = 3): RideLog => ({
  ride_id: rideId, crew_id: 'c1', name: 'x', started_ms: NOW - 3_600_000, ended_ms: NOW - 1_800_000, km: 80, duration_s: 7200, avg_kmh: 40, max_kmh: 90, together_pct: 90, longest_gap_m: 100,
  riders, hazards_shared: 1, signals_sent: 0, track: [], events: [], rating: null, start: null, destination: null,
});

const mounted: ReactTestRenderer[] = [];
afterEach(() => {
  mounted.splice(0).forEach((t) => act(() => t.unmount()));
  jest.useRealTimers();
});

function setup(rides: Ride[], extra: { loaded?: boolean; error?: boolean } = {}) {
  useSessionStore.setState({ uid: 'me', authKnown: true });
  useRidesStore.setState({ rides, loaded: extra.loaded ?? true, error: extra.error ?? false });
  useCrewsStore.setState({ crews: [crew], loaded: true });
  useProfileStore.setState({
    me: profile('me', 'Arjun Rao'),
    byId: { me: profile('me', 'Arjun Rao'), u2: profile('u2', 'Meera Shah'), u3: profile('u3', 'Kabir Das') },
    ensure: jest.fn(async () => undefined),
  });
}
async function mount(id: 'demo' | 'ember' = 'demo', scheme: 'light' | 'dark' = 'light') {
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn(), reset: jest.fn() };
  let t!: ReactTestRenderer;
  await act(async () => {
    t = create(
      <ThemeContext.Provider value={buildTheme(id, THEMES[id][scheme])}>
        <RideHomeScreen {...({ navigation, route: { key: 'k', name: 'Ride' } } as any)} />
      </ThemeContext.Provider>,
    );
  });
  mounted.push(t);
  return { t, navigation };
}
const texts = (t: ReactTestRenderer) => t.root.findAllByType(Text).map((n) => [n.props.children].flat(4).filter((x) => typeof x === 'string' || typeof x === 'number').join(''));
const has = (t: ReactTestRenderer, s: string | RegExp) => texts(t).some((x) => (typeof s === 'string' ? x === s : s.test(x)));
const press = (t: ReactTestRenderer, label: string) => {
  const n = t.root.findAll((x) => x.props.accessibilityLabel === label && typeof x.props.onPress === 'function')[0];
  if (!n) throw new Error(`no pressable "${label}" in: ${texts(t).join(' | ')}`);
  act(() => n.props.onPress());
};
const pressId = (t: ReactTestRenderer, testID: string) => {
  const n = t.root.findAll((x) => x.props.testID === testID && typeof x.props.onPress === 'function')[0];
  if (!n) throw new Error(`no pressable testID ${testID}`);
  act(() => n.props.onPress());
};

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  mockDocs.rsvp = []; mockDocs.rollCall = []; mockDocs.presence = [];
  mockLogs = [];
  mockClusters = [];
  mockFetchWeather.mockReset().mockResolvedValue(null);
  mockSetRsvp.mockClear(); mockSetRideStatus.mockClear(); mockReset.mockClear();
  useToastStore.setState({ toasts: [] });
  useAppStore.setState({ groupId: null });
  usePlanDraftStore.getState().reset();
  usePrefsStore.setState({ prefs: { ...usePrefsStore.getState().prefs, units: 'km' } });
});

describe('header', () => {
  it('shows the real date/time, a greeting by hour and the rider\'s avatar (-> Me)', async () => {
    setup([]);
    const { t, navigation } = await mount();
    expect(has(t, 'SAT 11 OCT · 5:41 AM')).toBe(true);
    expect(has(t, 'Good morning.')).toBe(true);
    expect(has(t, 'AR')).toBe(true);
    press(t, 'Me');
    expect(navigation.navigate).toHaveBeenCalledWith('Me');
  });
  it('greets by the hour', async () => {
    jest.setSystemTime(new Date(2025, 9, 11, 19, 0).getTime());
    setup([]);
    expect(has((await mount()).t, 'Good evening.')).toBe(true);
  });
});

describe('planned ride hero', () => {
  it.each(ALL)('%s/%s: ticket with real distance, time, safety, countdown and RSVP', async (id, scheme) => {
    mockDocs.rsvp = [{ uid: 'me', status: 'going', updated_ms: 1 }, { uid: 'u2', status: 'going', updated_ms: 2 }];
    setup([ride()]);
    const { t } = await mount(id, scheme);
    expect(has(t, 'Sunrise Ghat Run')).toBe(true);
    expect(has(t, 'Sat 11 Oct · 6:30 AM')).toBe(true);
    expect(has(t, 'Bandra Fort → Lonavala · with Ghat Ghosts')).toBe(true);
    expect(texts(t).join('|')).toContain('84');
    expect(has(t, '2h 05')).toBe(true);
    expect(has(t, '91')).toBe(true);
    expect(has(t, 'DISTANCE')).toBe(true);
    expect(has(t, '2 of 3 confirmed')).toBe(true);
    expect(has(t, 'IN 49 MIN')).toBe(true);
    expect(has(t, 'RIDE PASS')).toBe(true);
    expect(has(t, 'Go to meetup')).toBe(true);
    const going = t.root.findAll((n) => n.props.accessibilityLabel === 'Going' && n.props.accessibilityRole === 'radio')[0];
    expect(going.props.accessibilityState.selected).toBe(true);
  });

  it('the countdown keeps ticking', async () => {
    setup([ride()]);
    const { t } = await mount();
    expect(has(t, 'IN 49 MIN')).toBe(true);
    await act(async () => { jest.advanceTimersByTime(30 * 60_000); });
    expect(has(t, 'IN 19 MIN')).toBe(true);
  });

  it('omits what it cannot compute: no saved route calculation -> no est. time or safety, a straight-line distance at most', async () => {
    setup([ride({ route: null })]);
    const { t } = await mount();
    expect(has(t, 'EST. TIME')).toBe(false);
    expect(has(t, 'SAFETY SCORE')).toBe(false);
    expect(texts(t).join('|')).toMatch(/≈\d+/);
    setup([ride({ route: null, ride_plan: null, meetup: null })]);
    const again = await mount();
    expect(has(again.t, 'DISTANCE')).toBe(false);
  });

  it('RSVP writes the rider\'s answer', async () => {
    setup([ride()]);
    const { t } = await mount();
    press(t, 'Maybe');
    expect(mockSetRsvp).toHaveBeenCalledWith('r1', 'me', 'maybe');
    expect(useToastStore.getState().toasts[0].message).toBe('Marked maybe');
    press(t, 'Can’t');
    expect(mockSetRsvp).toHaveBeenLastCalledWith('r1', 'me', 'no');
    press(t, 'Going');
    expect(mockSetRsvp).toHaveBeenLastCalledWith('r1', 'me', 'going');
  });

  it('a failed RSVP write tells the rider', async () => {
    mockSetRsvp.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    setup([ride()]);
    const { t } = await mount();
    press(t, 'Going');
    await act(async () => undefined);
    expect(useToastStore.getState().toasts.map((x) => x.variant)).toContain('error');
  });

  it('Go to meetup opens the meetup (still planned), resets the session, selects the ride and navigates', async () => {
    setup([ride()]);
    const { t, navigation } = await mount();
    press(t, 'Go to meetup');
    expect(mockSetRideStatus).toHaveBeenCalledWith('r1', 'meetup');
    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().groupId).toBe('r1');
    expect(navigation.navigate).toHaveBeenCalledWith('Meetup', { groupId: 'r1' });
  });

  it('shows avatars of the real members', async () => {
    setup([ride()]);
    const { t } = await mount();
    const row = t.root.findByProps({ testID: 'avatar-row' });
    expect(row.findAllByType(Text).map((n) => n.props.children)).toEqual(['AR', 'MS', 'KD']);
  });
});

describe('meetup / live / finished', () => {
  it('meetup: "Open roll call" navigates without rewriting the status; the pill counts who is ready', async () => {
    mockDocs.rollCall = [{ uid: 'u2', state: 'ready', updated_ms: 1 }, { uid: 'u3', state: 'notready', updated_ms: 1 }];
    setup([ride({ status: 'meetup' })]);
    const { t, navigation } = await mount();
    expect(has(t, '● MEETUP OPEN')).toBe(true);
    expect(has(t, '1 READY')).toBe(true);
    expect(has(t, 'Go to meetup')).toBe(false);
    press(t, 'Open roll call');
    expect(mockSetRideStatus).not.toHaveBeenCalled();
    expect(navigation.navigate).toHaveBeenCalledWith('Meetup', { groupId: 'r1' });
  });

  it('live: dark ticket, who leads / sweeps from the crew, and "Rejoin ride"', async () => {
    mockDocs.presence = [{ uid: 'u2', state: 'riding', updated_ms: 1 }, { uid: 'u3', state: 'riding', updated_ms: 1 }];
    setup([ride({ status: 'live', started_ms: NOW - 600_000 })]);
    const { t, navigation } = await mount('demo', 'light');
    expect(has(t, 'Ride on.')).toBe(true);
    expect(has(t, '● LIVE')).toBe(true);
    expect(has(t, 'You’re on the road.')).toBe(true);
    expect(has(t, 'Meera leads · Kabir sweeps')).toBe(true);
    expect(has(t, 'Sunrise Ghat Run · 2 riding')).toBe(true);
    press(t, 'Rejoin ride');
    expect(navigation.navigate).toHaveBeenCalledWith('Live', { groupId: 'r1' });
    expect(useAppStore.getState().groupId).toBe('r1');
  });

  it('live: rejoining the ride already open keeps its session', async () => {
    useAppStore.setState({ groupId: 'r1' });
    setup([ride({ status: 'live', started_ms: NOW - 600_000 })]);
    const { t } = await mount();
    press(t, 'Rejoin ride');
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('finished with a log: "Back safe.", the rider\'s name and "See the recap"', async () => {
    mockLogs = [log('r1', 3)];
    mockDocs.presence = ['me', 'u2', 'u3'].map((uid) => ({ uid, state: 'arrived' as const, updated_ms: 1 }));
    setup([ride({ status: 'finished', finished_ms: NOW - 3_600_000 })]);
    const { t, navigation } = await mount();
    expect(has(t, 'Back safe.')).toBe(true);
    expect(has(t, 'Nice ride, Arjun.')).toBe(true);
    expect(has(t, 'Everyone home · 3 of 3')).toBe(true);
    expect(has(t, '✓ FINISHED')).toBe(true);
    press(t, 'See the recap');
    expect(navigation.navigate).toHaveBeenCalledWith('Recap', { rideId: 'r1' });
  });

  it('finished without a log: the empty hero, not a recap that does not exist', async () => {
    setup([ride({ status: 'finished', finished_ms: NOW - 3_600_000 })]);
    const { t } = await mount();
    expect(has(t, 'See the recap')).toBe(false);
    expect(has(t, 'Nothing planned')).toBe(true);
  });
});

describe('empty / loading / error', () => {
  it('no rides: honest empty hero with Plan a ride (fresh draft) and Join with a code', async () => {
    usePlanDraftStore.getState().setPace('Spirited');
    setup([]);
    const { t, navigation } = await mount();
    expect(has(t, 'Nothing planned')).toBe(true);
    expect(has(t, 'Route intel'.toUpperCase())).toBe(false);
    expect(has(t, 'ALSO COMING UP')).toBe(false);
    expect(has(t, 'CREW PULSE')).toBe(false);
    pressId(t, 'empty-plan');
    expect(navigation.navigate).toHaveBeenCalledWith('PlanWhere');
    expect(usePlanDraftStore.getState().pace).toBe('Steady');
    pressId(t, 'empty-join');
    expect(navigation.navigate).toHaveBeenCalledWith('Join');
  });

  it('while the rides are loading it shows a placeholder, not the empty state', async () => {
    setup([], { loaded: false });
    const { t } = await mount();
    expect(has(t, 'Nothing planned')).toBe(false);
  });

  it('a failed rides listener says so (offline)', async () => {
    setup([], { error: true });
    const { t } = await mount();
    expect(has(t, 'Can’t load your rides')).toBe(true);
  });
});

describe('weather', () => {
  const FINE = { tempC: 21.4, code: 1, sky: 'Mostly clear', fair: true, windKmh: 9.2, precipMm: 0, sunrise: '6:24 AM' };
  it('shows real weather for the next ride\'s start', async () => {
    mockFetchWeather.mockResolvedValue(FINE);
    setup([ride()]);
    const { t } = await mount();
    expect(mockFetchWeather).toHaveBeenCalledWith(19.04, 72.82);
    expect(has(t, '21° · Mostly clear')).toBe(true);
    expect(has(t, 'wind 9 km/h · sunrise 6:24 AM')).toBe(true);
  });
  it('falls back to the rider\'s position when there is no ride', async () => {
    mockFetchWeather.mockResolvedValue(FINE);
    setup([]);
    await mount();
    expect(mockFetchWeather).toHaveBeenCalledWith(19.07, 72.87);
  });
  it('is hidden when the request fails', async () => {
    mockFetchWeather.mockResolvedValue(null);
    setup([ride()]);
    const { t } = await mount();
    expect(t.root.findAllByProps({ testID: 'weather-card' })).toHaveLength(0);
  });
  it('uses miles per hour when the rider prefers miles', async () => {
    usePrefsStore.setState({ prefs: { ...usePrefsStore.getState().prefs, units: 'mi' } });
    mockFetchWeather.mockResolvedValue(FINE);
    setup([ride()]);
    expect(has((await mount()).t, 'wind 6 mph · sunrise 6:24 AM')).toBe(true);
  });
});

describe('route intel', () => {
  const cluster = (id: string, type: string, n: number) => ({ cluster_id: id, group_id: 'r1', hazard_type: type, centroid_lat: 18.9, centroid_lng: 73.1, polygon_points: [], report_count: n, hazard_score: 1, created_at_hlc: `${NOW - 40 * 60_000}:0`, status: 'active' });
  it('summarises the real active clusters of the ride and opens the sheet', async () => {
    mockClusters = [cluster('a', 'pothole', 3), cluster('b', 'oil_spill', 1)];
    setup([ride()]);
    const { t } = await mount();
    expect(has(t, '2 hazards on your route')).toBe(true);
    expect(has(t, 'Pothole (3 reports), Oil on the road (1 report).')).toBe(true);
    expect(t.root.findByProps({ testID: 'sheet-Intel' }) && true).toBe(true);
  });
  it('with no clusters it says so and quotes the ride\'s safety score', async () => {
    setup([ride()]);
    const { t } = await mount();
    expect(has(t, 'No hazards reported on your route')).toBe(true);
    expect(has(t, 'Route safety score 91.')).toBe(true);
  });
  it('the sheet lists each hazard (km along the route) and the safety score, and keeps the copy', async () => {
    mockClusters = [cluster('a', 'pothole', 3)];
    setup([ride()]);
    const { t } = await mount();
    press(t, 'View route intel');
    expect(has(t, 'Before you roll')).toBe(true);
    expect(has(t, /^Pothole · km \d+$/)).toBe(true);
    expect(has(t, '3 reports · first reported 40 min ago')).toBe(true);
    expect(has(t, 'Route safety score 91')).toBe(true);
    expect(has(t, 'Hazards show up when two riders report the same spot. That keeps one bad tap from crying wolf.')).toBe(true);
  });
  it('is not shown for a finished ride', async () => {
    mockLogs = [log('r1')];
    setup([ride({ status: 'finished', finished_ms: NOW - 3_600_000 })]);
    expect(has((await mount()).t, 'ROUTE INTEL')).toBe(false);
  });
});

describe('also coming up / where next / crew pulse', () => {
  const other = (id: string, name: string, startOffset: number, extra: Partial<Ride> = {}) => ride({ id, name, start_time_ms: NOW + startOffset, ...extra });

  it('lists the other upcoming rides across crews and opens RideInfoSheet', async () => {
    setup([ride(), other('r2', 'Mulshi Lake Loop', 7 * 86_400_000, { crew_id: null, member_ids: ['me', 'u2'] }), other('r3', 'Old', -20 * 3_600_000)]);
    const { t } = await mount();
    expect(has(t, 'ALSO COMING UP')).toBe(true);
    expect(has(t, 'Mulshi Lake Loop')).toBe(true);
    expect(has(t, 'Old')).toBe(false);
    pressId(t, 'upcoming-r2');
    expect(has(t, 'UPCOMING')).toBe(true);
    expect(has(t, 'Sat 18 Oct · 5:41 AM · 84 km · 0 riders confirmed')).toBe(true);
  });
  it('hides "Also coming up" when there is nothing else', async () => {
    setup([ride()]);
    expect(has((await mount()).t, 'ALSO COMING UP')).toBe(false);
  });

  it('"Where next?": chips from the rider\'s own finished rides; tapping one pre-fills the plan and opens PlanRoute', async () => {
    const done = ride({ id: 'old', status: 'finished', finished_ms: NOW - 3 * 86_400_000, start_time_ms: NOW - 3 * 86_400_000, ride_plan: { start: null, stops: [], destination: place('Karjat, Maharashtra', 18.9, 73.32) } });
    setup([ride(), done]);
    const { t, navigation } = await mount();
    expect(has(t, 'Plan a ride')).toBe(true);
    pressId(t, 'chip-Karjat');
    expect(usePlanDraftStore.getState().destination).toEqual({ label: 'Karjat, Maharashtra', lat: 18.9, lng: 73.32 });
    expect(navigation.navigate).toHaveBeenCalledWith('PlanRoute');
  });
  it('no chips without past rides, and Plan a ride starts fresh', async () => {
    usePlanDraftStore.getState().setPace('Relaxed');
    setup([ride()]);
    const { t, navigation } = await mount();
    expect(t.root.findAll((n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('chip-'))).toHaveLength(0);
    pressId(t, 'plan-a-ride');
    expect(navigation.navigate).toHaveBeenCalledWith('PlanWhere');
    expect(usePlanDraftStore.getState().pace).toBe('Steady');
  });

  it('crew pulse: real names, newest first, never the rider themself', async () => {
    mockDocs.rsvp = [{ uid: 'u2', status: 'going', updated_ms: NOW - 2 * 3_600_000 }, { uid: 'me', status: 'going', updated_ms: NOW - 1000 }];
    mockDocs.presence = [{ uid: 'u3', state: 'fuel', updated_ms: NOW - 40 * 60_000 }];
    setup([ride()]);
    const { t } = await mount();
    expect(has(t, 'Kabir is fuelling up')).toBe(true);
    expect(has(t, 'Meera confirmed')).toBe(true);
    expect(has(t, 'You confirmed')).toBe(false);
    expect(has(t, '40 min ago')).toBe(true);
    expect(has(t, '2h ago')).toBe(true);
    const order = texts(t).filter((x) => /Kabir is fuelling up|Meera confirmed/.test(x));
    expect(order).toEqual(['Kabir is fuelling up', 'Meera confirmed']);
  });
  it('crew pulse is hidden when there is nothing yet', async () => {
    setup([ride()]);
    expect(has((await mount()).t, 'CREW PULSE')).toBe(false);
  });
});

describe('accessibility', () => {
  it('controls carry labels and roles; tap targets are named', async () => {
    setup([ride()]);
    const { t } = await mount();
    const buttons = t.root.findAll((n) => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function');
    expect(buttons.length).toBeGreaterThan(3);
    for (const b of buttons) expect(typeof b.props.accessibilityLabel).toBe('string');
    expect(Array.from(new Set(t.root.findAll((n) => n.props.accessibilityRole === 'radio').map((n) => n.props.accessibilityLabel)))).toEqual(['Going', 'Maybe', 'Can’t']);
  });
});
