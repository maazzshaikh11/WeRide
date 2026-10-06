/**
 * Log tab, Recap screen, ShareCard + RateRoute sheets: all four palettes, real-shaped log fixtures (full, empty track,
 * no events, no group data), the replay + scrubber, and what the rating / share write.
 */
import React from 'react';
import { StyleSheet, Share, Text } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';

import LogScreen from '../src/screens/garage/LogScreen';
import RecapScreen, { REPLAY_SECONDS } from '../src/screens/garage/RecapScreen';
import ReplayScrubber from '../src/screens/garage/parts/ReplayScrubber';
import RateRouteSheet from '../src/sheets/RateRouteSheet';
import ShareCardSheet, { shareText } from '../src/sheets/ShareCardSheet';
import { MapSketch } from '../src/ui';
import { ThemeContext, buildTheme } from '../src/theme/ThemeProvider';
import { THEMES } from '../src/theme/palettes';
import { useRideLogsStore } from '../src/store/rideLogsStore';
import { useSessionStore } from '../src/store/sessionStore';
import { useToastStore } from '../src/store/toastStore';
import { usePrefsStore } from '../src/store/prefsStore';
import { getRideLog, setRouteRating } from '../src/services/rideLogService';
import type { RideLog } from '../src/models/domain';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SafeAreaInsetsContext: require('react').createContext(null),
}));
jest.mock('../src/services/rideLogService', () => ({
  subscribeRideLogs: jest.fn(() => jest.fn()),
  getRideLog: jest.fn(async () => null),
  setRouteRating: jest.fn(async () => undefined),
  saveRideLog: jest.fn(),
}));

const ALL = [['demo', 'light'], ['demo', 'dark'], ['ember', 'light'], ['ember', 'dark']] as const;
const mounted: ReactTestRenderer[] = [];
afterEach(() => {
  mounted.splice(0).forEach((t) => act(() => t.unmount()));
  jest.useRealTimers();
});

function mount(el: React.ReactElement, id: 'demo' | 'ember' = 'demo', scheme: 'light' | 'dark' = 'light') {
  let t!: ReactTestRenderer;
  act(() => {
    t = create(<ThemeContext.Provider value={buildTheme(id, THEMES[id][scheme])}>{el}</ThemeContext.Provider>);
  });
  mounted.push(t);
  return t;
}
const deepText = (n: any): string => (typeof n === 'string' ? n : (n.children ?? []).map(deepText).join(''));
const texts = (t: { root: any }) => t.root.findAllByType(Text).map(deepText);
const has = (t: ReactTestRenderer, s: string | RegExp) => texts(t).some((x: string) => (typeof s === 'string' ? x === s : s.test(x)));
const byTestId = (t: ReactTestRenderer, id: string) => t.root.findAll((n) => n.props.testID === id && typeof n.type === 'string');
const press = (t: ReactTestRenderer, id: string) => act(() => { t.root.findAll((n) => n.props.testID === id && typeof n.props.onPress === 'function')[0].props.onPress(); });
const pressLabel = (t: ReactTestRenderer, label: string) => act(() => { t.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0].props.onPress(); });
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

const D = (y: number, m: number, d: number, h = 7, min = 0) => new Date(y, m, d, h, min).getTime();
const trackOf = (n: number) => Array.from({ length: n * 2 }, (_, i) => (i % 2 === 0 ? 19 + Math.floor(i / 2) * 0.0008 : 72.8 + Math.floor(i / 2) * 0.0005));

const FULL: RideLog = {
  ride_id: 'r1', crew_id: 'c1', name: 'Marine Drive Sunrise', started_ms: D(2026, 9, 4, 6, 34), ended_ms: D(2026, 9, 4, 7, 32),
  km: 28.4, duration_s: 3480, avg_kmh: 29.4, max_kmh: 61, together_pct: 96, longest_gap_m: 410, riders: 5, hazards_shared: 1, signals_sent: 3,
  track: trackOf(60),
  events: [
    { t_ms: D(2026, 9, 4, 6, 34), kind: 'rolled', text: 'Rolled out' },
    { t_ms: D(2026, 9, 4, 6, 52), kind: 'hazard', text: 'Pothole confirmed' },
    { t_ms: D(2026, 9, 4, 7, 5), kind: 'stop', text: 'Chai Point' },
    { t_ms: D(2026, 9, 4, 7, 20), kind: 'gap', text: 'Gap at the ghat' },
    { t_ms: D(2026, 9, 4, 7, 32), kind: 'arrived', text: 'Arrived ∙ Worli' },
  ],
  rating: null, start: { label: 'Gateway', lat: 19, lng: 72.8 }, destination: { label: 'Worli', lat: 19.05, lng: 72.83 },
};
const LOOSE: RideLog = { ...FULL, ride_id: 'r2', name: 'Karjat Night Loop', started_ms: D(2026, 8, 27, 19), ended_ms: D(2026, 8, 27, 22), km: 112, duration_s: 10920, together_pct: 88, longest_gap_m: 1800, events: [] };
const EMPTY_TRACK: RideLog = { ...FULL, ride_id: 'r3', name: 'No GPS Ride', track: [], together_pct: 0, longest_gap_m: 0 };
const SOLO: RideLog = { ...FULL, ride_id: 'r4', name: 'Solo Sunday', together_pct: 0, longest_gap_m: 0, riders: 1 };

const nav = (): any => ({ navigate: jest.fn(), goBack: jest.fn(), canGoBack: jest.fn(() => true), reset: jest.fn() });

function seed(logs: RideLog[], o: { loaded?: boolean; error?: boolean; uid?: string | null } = {}) {
  const uid = o.uid === undefined ? 'u1' : o.uid;
  act(() => {
    useSessionStore.setState({ uid, authKnown: true });
    useRideLogsStore.setState({ logs, loaded: o.loaded ?? true, error: o.error ?? false, uid });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  useToastStore.setState({ toasts: [] });
  usePrefsStore.setState({ prefs: { ...usePrefsStore.getState().prefs, units: 'km' } } as any);
  (getRideLog as jest.Mock).mockResolvedValue(null);
  seed([FULL, LOOSE]);
});

describe('Log tab', () => {
  it.each(ALL)('%s/%s: totals, bars, ride cards; together >= 90 in the ok colour', (id, scheme) => {
    const pal = THEMES[id][scheme];
    const t = mount(<LogScreen navigation={nav()} route={{} as any} />, id, scheme);
    expect(has(t, 'Your log')).toBe(true);
    expect(has(t, 'SEASON ∙ SEP – OCT')).toBe(true);
    expect(has(t, '140')).toBe(true); // 28.4 + 112 = 140.4
    expect(has(t, 'KM THIS SEASON')).toBe(true);
    expect(has(t, '2 rides')).toBe(true);
    expect(has(t, '4 h on the road')).toBe(true); // 14400 s
    expect(has(t, '2 logged')).toBe(true);
    expect(has(t, 'Marine Drive Sunrise')).toBe(true);
    expect(has(t, 'Sun 4 Oct ∙ 28 km ∙ 58 min')).toBe(true);
    expect(has(t, 'Sun 27 Sep ∙ 112 km ∙ 3h 02')).toBe(true);
    expect(byTestId(t, 'bars')).toHaveLength(1);
    const pct = (s: string) => StyleSheet.flatten(t.root.findAll((n) => n.type === Text && deepText(n) === s)[0].props.style);
    expect(pct('96%').color).toBe(pal.ok);
    expect(pct('88%').color).toBe(pal.ink);
    expect(t.root.findAllByType(MapSketch)).toHaveLength(2);
  });

  it('opens the recap of a tapped ride', () => {
    const n = nav();
    const t = mount(<LogScreen navigation={n} route={{} as any} />);
    press(t, 'log-card-r2');
    expect(n.navigate).toHaveBeenCalledWith('Recap', { rideId: 'r2' });
  });

  it('shows a dash instead of 0% when no other rider was ever seen', () => {
    seed([SOLO]);
    const t = mount(<LogScreen navigation={nav()} route={{} as any} />);
    expect(has(t, '—')).toBe(true);
    expect(has(t, '0%')).toBe(false);
    expect(has(t, '1 ride')).toBe(true);
  });

  it('skeleton while loading', () => {
    seed([], { loaded: false });
    const t = mount(<LogScreen navigation={nav()} route={{} as any} />);
    expect(byTestId(t, 'log-loading')).toHaveLength(1);
    expect(has(t, 'Your log')).toBe(true);
    expect(has(t, 'YOUR LOG')).toBe(true);
  });

  it('honest empty state', () => {
    seed([]);
    const t = mount(<LogScreen navigation={nav()} route={{} as any} />);
    expect(has(t, 'No rides logged yet — your first ride will show up here')).toBe(true);
    expect(has(t, 'YOUR LOG')).toBe(true);
    expect(has(t, '0 rides')).toBe(true);
    expect(has(t, '0 logged')).toBe(true);
    expect(t.root.findAllByType(MapSketch)).toHaveLength(0);
  });

  it('error state when the listener failed and nothing is cached', () => {
    seed([], { error: true });
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.requireMock('../src/services/rideLogService').subscribeRideLogs.mockImplementationOnce((_u: string, _ok: unknown, onErr: (e: unknown) => void) => {
      onErr(new Error('denied'));
      return jest.fn();
    });
    useRideLogsStore.getState().clear();
    const t = mount(<LogScreen navigation={nav()} route={{} as any} />);
    expect(has(t, "Can't load your rides")).toBe(true);
    expect(has(t, /No rides logged yet/)).toBe(false);
  });

  it('shows miles when the rider prefers them', () => {
    usePrefsStore.setState({ prefs: { ...usePrefsStore.getState().prefs, units: 'mi' } } as any);
    const t = mount(<LogScreen navigation={nav()} route={{} as any} />);
    expect(has(t, '87')).toBe(true); // 140.4 km = 87.2 mi
    expect(has(t, 'MI THIS SEASON')).toBe(true);
    expect(has(t, /∙ 18 mi ∙/)).toBe(true);
  });

  it('watches the rider logs for the signed-in uid', () => {
    const { subscribeRideLogs } = jest.requireMock('../src/services/rideLogService');
    useRideLogsStore.getState().clear();
    useSessionStore.setState({ uid: 'u9' });
    mount(<LogScreen navigation={nav()} route={{} as any} />);
    expect(subscribeRideLogs).toHaveBeenCalledWith('u9', expect.any(Function), expect.any(Function));
  });
});

const recap = (rideId = 'r1', n = nav()) => <RecapScreen navigation={n as any} route={{ key: 'k', name: 'Recap', params: { rideId } } as any} />;

describe('Recap', () => {
  it.each(ALL)('%s/%s: hero, cohesion, stats, timeline, buttons', (id, scheme) => {
    const pal = THEMES[id][scheme];
    const t = mount(recap(), id, scheme);
    expect(has(t, 'SUN 4 OCT')).toBe(true);
    expect(has(t, 'Marine Drive Sunrise')).toBe(true);
    expect(has(t, 'A tight ride.')).toBe(true);
    expect(has(t, /You stayed within 500 m of the group 96% of the time\. Longest gap: 0\.4 km\./)).toBe(true);
    expect(has(t, '% TOGETHER')).toBe(true);
    expect(has(t, '96')).toBe(true);
    expect(has(t, '28')).toBe(true);
    expect(has(t, '58m')).toBe(true);
    expect(has(t, '29')).toBe(true);
    expect(has(t, 'AVG KM/H')).toBe(true);
    expect(has(t, 'HAZARDS SHARED')).toBe(true);
    expect(t.root.findAllByType(Text).find((n: any) => deepText(n) === 'HAZARDS SHARED')?.props.numberOfLines).toBe(2);
    expect(has(t, 'SIGNALS')).toBe(true);
    expect(has(t, 'RIDERS')).toBe(true);
    expect(has(t, 'TIMELINE')).toBe(true);
    expect(has(t, 'Rolled out')).toBe(true);
    expect(has(t, 'Pothole confirmed')).toBe(true);
    expect(has(t, 'Arrived ∙ Worli')).toBe(true);
    expect(has(t, '06:34')).toBe(true);
    expect(has(t, 'Rate the route')).toBe(true);
    expect(has(t, 'Share card')).toBe(true);
    expect(has(t, 'Save image')).toBe(false);
    expect(t.root.findByProps({ accessibilityRole: 'progressbar' }).props.accessibilityValue.now).toBe(96);
    // timeline tones: rolled/arrived ok, stop ink, gap + hazard accent
    const diamonds = t.root.findAll((n) => typeof n.type === 'string' && n.props.style && StyleSheet.flatten(n.props.style).transform?.[0]?.rotate === '45deg').map((n) => StyleSheet.flatten(n.props.style).backgroundColor);
    expect(diamonds).toEqual([pal.ok, pal.pri, pal.ink, pal.pri, pal.ok]);
  });

  it('spread rides are described honestly', () => {
    seed([LOOSE]);
    const t = mount(recap('r2'));
    expect(has(t, 'Spread out in places.')).toBe(true);
    expect(has(t, /Longest gap: 1\.8 km\./)).toBe(true);
    expect(has(t, 'No moments were recorded for this ride.')).toBe(true);
    expect(has(t, '3h 02')).toBe(true);
  });

  it('shows a dash and no cohesion claims when no other rider was ever seen', () => {
    seed([SOLO]);
    const t = mount(recap('r4'));
    expect(has(t, '—')).toBe(true);
    expect(has(t, 'No group data.')).toBe(true);
    expect(has(t, /You stayed within/)).toBe(false);
    expect(t.root.findByProps({ accessibilityRole: 'progressbar' }).props.accessibilityValue.now).toBe(0);
  });

  it('a log with an empty track renders and says there is nothing to replay', () => {
    seed([EMPTY_TRACK]);
    const t = mount(recap('r3'));
    expect(has(t, 'No GPS Ride')).toBe(true);
    expect(byTestId(t, 'recap-no-track')).toHaveLength(1);
    expect(byTestId(t, 'replay-toggle')).toHaveLength(0);
    expect(t.root.findAllByType(MapSketch)[0].props.progress).toBeUndefined();
  });

  it('loading, not found, and read failure', async () => {
    seed([], { loaded: false });
    let t = mount(recap('zzz'));
    expect(byTestId(t, 'recap-loading')).toHaveLength(1);

    seed([FULL]);
    t = mount(recap('zzz'));
    await flush();
    expect(getRideLog).toHaveBeenCalledWith('u1', 'zzz');
    expect(has(t, "We can't find this ride")).toBe(true);

    (getRideLog as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    t = mount(recap('yyy'));
    await flush();
    expect(has(t, "Can't load this ride")).toBe(true);
  });

  it('falls back to reading the log directly when the live list does not have it yet', async () => {
    seed([]);
    (getRideLog as jest.Mock).mockResolvedValueOnce(FULL);
    const t = mount(recap('r1'));
    await flush();
    expect(has(t, 'Marine Drive Sunrise')).toBe(true);
  });

  it('back goes back, or resets to the tabs when there is no history (after End ride)', () => {
    const n = nav();
    const t = mount(recap('r1', n));
    pressLabel(t, 'Back');
    expect(n.goBack).toHaveBeenCalled();
    const n2 = nav();
    n2.canGoBack.mockReturnValue(false);
    const t2 = mount(recap('r1', n2));
    pressLabel(t2, 'Back');
    expect(n2.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'GarageTabs' }] });
  });

  it('top-right share icon and the Share card button open the share card', () => {
    const t = mount(recap());
    expect(byTestId(t, 'share-card')).toHaveLength(0);
    press(t, 'recap-share-icon');
    expect(byTestId(t, 'share-card')).toHaveLength(1);
    const t2 = mount(recap());
    press(t2, 'recap-share');
    expect(byTestId(t2, 'share-card')).toHaveLength(1);
  });

  it('Rate the route opens the sheet; picking a rating writes it and thanks the rider', async () => {
    const t = mount(recap());
    expect(byTestId(t, 'sheet-RateRoute')).toHaveLength(0);
    press(t, 'recap-rate');
    expect(has(t, 'How was the road?')).toBe(true);
    press(t, 'rate-smooth');
    await flush();
    expect(setRouteRating).toHaveBeenCalledWith('u1', 'r1', 'smooth');
    expect(useToastStore.getState().toasts.map((x) => x.message)).toEqual(['Thanks. Rated smooth.']);
    expect(has(t, 'Rated Smooth')).toBe(true);
  });
});

describe('replay', () => {
  it('plays along the recorded points in 14 s, pauses, replays from the start, and reads elapsed time', () => {
    jest.useFakeTimers();
    const t = mount(recap());
    const head = () => t.root.findAllByType(MapSketch)[0].props.progress as number;
    expect(head()).toBe(0);
    expect(has(t, '0:00')).toBe(true);
    pressLabel(t, 'Play replay');
    act(() => { jest.advanceTimersByTime(7000); });
    expect(head()).toBeGreaterThan(0.45);
    expect(head()).toBeLessThan(0.55);
    expect(byTestId(t, 'replay-toggle')[0].props.accessibilityLabel).toBe('Pause replay');
    pressLabel(t, 'Pause replay');
    const paused = head();
    act(() => { jest.advanceTimersByTime(3000); });
    expect(head()).toBe(paused);
    expect(has(t, `${Math.floor((paused * 3480) / 60)}:${String(Math.floor(paused * 3480) % 60).padStart(2, '0')}`)).toBe(true);
    pressLabel(t, 'Play replay');
    act(() => { jest.advanceTimersByTime((REPLAY_SECONDS + 1) * 1000); });
    expect(head()).toBe(1);
    expect(has(t, '58:00')).toBe(true);
    expect(byTestId(t, 'replay-toggle')[0].props.accessibilityLabel).toBe('Play replay'); // stopped at the end
    pressLabel(t, 'Play replay'); // restarts from the beginning
    expect(head()).toBe(0);
  });

  it('clears its timer on unmount', () => {
    jest.useFakeTimers();
    const t = mount(recap());
    pressLabel(t, 'Play replay');
    act(() => t.unmount());
    mounted.splice(0);
    expect(jest.getTimerCount()).toBe(0);
  });
});

/** Fake touch events for the PanResponder behind the scrubber. */
function touch(x: number, ts: number, prevX = x, prevTs = ts, startX = x) {
  return {
    nativeEvent: { locationX: x, pageX: x, touches: [] },
    touchHistory: {
      indexOfSingleActiveTouch: 0, mostRecentTimeStamp: ts, numberActiveTouches: 1,
      touchBank: [{ touchActive: true, startPageX: startX, startPageY: 0, startTimeStamp: 1000, currentPageX: x, currentPageY: 0, currentTimeStamp: ts, previousPageX: prevX, previousPageY: 0, previousTimeStamp: prevTs }],
    },
  };
}

describe('ReplayScrubber', () => {
  const setup = (value = 0) => {
    const onChange = jest.fn(), onStart = jest.fn(), onEnd = jest.fn();
    const t = mount(<ReplayScrubber value={value} onChange={onChange} onScrubStart={onStart} onScrubEnd={onEnd} testID="scrub" />);
    const host = () => byTestId(t, 'scrub')[0];
    act(() => host().props.onLayout({ nativeEvent: { layout: { width: 232, height: 44 } } }));
    return { t, host, onChange, onStart, onEnd };
  };

  it('a tap jumps to that position (thumb is 32 px wide: 16..216 is the usable range)', () => {
    const { host, onChange, onStart, onEnd } = setup();
    act(() => { host().props.onResponderGrant(touch(116, 1000)); });
    expect(onStart).toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith(0.5);
    act(() => { host().props.onResponderRelease(touch(116, 1010)); });
    expect(onEnd).toHaveBeenCalled();
  });

  it('dragging moves by the finger distance and clamps to 0..1', () => {
    const { host, onChange } = setup();
    act(() => { host().props.onResponderGrant(touch(16, 1000)); });
    expect(onChange).toHaveBeenLastCalledWith(0);
    act(() => { host().props.onResponderMove(touch(116, 1100, 16, 1000, 16)); });
    expect(onChange).toHaveBeenLastCalledWith(0.5);
    act(() => { host().props.onResponderMove(touch(500, 1200, 116, 1100, 16)); });
    expect(onChange).toHaveBeenLastCalledWith(1);
    act(() => { host().props.onResponderMove(touch(-300, 1300, 500, 1200, 16)); });
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('the thumb sits at the value and the bar reads as an adjustable control', () => {
    const { t } = setup(0.5);
    const thumb = StyleSheet.flatten(byTestId(t, 'scrub-thumb')[0].props.style);
    expect(thumb.left).toBeCloseTo(100, 5);
    const bar = byTestId(t, 'scrub')[0];
    expect(bar.props.accessibilityRole).toBe('adjustable');
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 50 });
  });

  it('screen readers can step it', () => {
    const { host, onChange } = setup(0.5);
    act(() => host().props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }));
    expect(onChange).toHaveBeenLastCalledWith(0.6);
    act(() => host().props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } }));
    expect(onChange).toHaveBeenLastCalledWith(0.4);
  });

  it('on the recap, dragging moves the replay head and the readout, and pauses playback', () => {
    jest.useFakeTimers();
    const t = mount(recap());
    pressLabel(t, 'Play replay');
    const sc = () => byTestId(t, 'replay-scrubber')[0];
    act(() => sc().props.onLayout({ nativeEvent: { layout: { width: 232, height: 44 } } }));
    act(() => { sc().props.onResponderGrant(touch(116, 1000)); });
    expect(t.root.findAllByType(MapSketch)[0].props.progress).toBe(0.5);
    expect(has(t, '29:00')).toBe(true); // half of 3480 s
    expect(byTestId(t, 'replay-toggle')[0].props.accessibilityLabel).toBe('Play replay'); // grabbing paused it
  });
});

describe('ShareCardSheet', () => {
  it.each(ALL)('%s/%s: the yellow plate with the real numbers', (id, scheme) => {
    const t = mount(<ShareCardSheet visible onClose={jest.fn()} log={FULL} />, id, scheme);
    expect(has(t, 'SHARE CARD')).toBe(true);
    expect(has(t, 'WERIDE ∙ SUN 4 OCT')).toBe(true);
    expect(has(t, 'MARINE DRIVE SUNRISE')).toBe(true);
    expect(has(t, '28')).toBe(true);
    expect(has(t, '96%')).toBe(true);
    expect(has(t, '5')).toBe(true);
    expect(has(t, 'TOGETHER')).toBe(true);
    expect(has(t, 'Arrived ∙ Worli')).toBe(true);
    expect(has(t, 'Save image')).toBe(false);
    expect(StyleSheet.flatten(byTestId(t, 'share-card')[0].props.style).backgroundColor).toBe('#FFC20E'); // fixed road-sign yellow
  });

  it('shows a dash for together when nobody else was seen', () => {
    const t = mount(<ShareCardSheet visible onClose={jest.fn()} log={SOLO} />);
    expect(has(t, '—')).toBe(true);
    expect(has(t, '0%')).toBe(false);
    expect(has(t, '1')).toBe(true);
    expect(has(t, 'RIDER')).toBe(true);
  });

  it('Share opens the OS share sheet with a text version', async () => {
    const spy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as any);
    const onClose = jest.fn();
    const t = mount(<ShareCardSheet visible onClose={onClose} log={FULL} />);
    press(t, 'share-card-share');
    await flush();
    expect(spy).toHaveBeenCalledTimes(1);
    const msg = (spy.mock.calls[0][0] as any).message as string;
    expect(msg).toContain('Marine Drive Sunrise ∙ Sun 4 Oct');
    expect(msg).toContain('28 km ∙ 96% together ∙ 5 riders');
    expect(msg).toContain('Arrived ∙ Worli');
    expect(onClose).toHaveBeenCalled();
  });

  it('reports a failed share and stays open', async () => {
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('x'));
    const onClose = jest.fn();
    const t = mount(<ShareCardSheet visible onClose={onClose} log={FULL} />);
    press(t, 'share-card-share');
    await flush();
    expect(onClose).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts[0].variant).toBe('error');
  });

  it('text version honours miles and omits together without group data', () => {
    expect(shareText(FULL, 'mi')).toContain('18 mi ∙ 96% together');
    expect(shareText(SOLO, 'km')).not.toContain('together');
  });
});

describe('RateRouteSheet', () => {
  const sheet = (props: Partial<React.ComponentProps<typeof RateRouteSheet>> = {}) => (
    <RateRouteSheet visible onClose={jest.fn()} rideId="r1" {...props} />
  );

  it.each(ALL)('%s/%s: the three answers with the demo copy', (id, scheme) => {
    const t = mount(sheet(), id, scheme);
    expect(has(t, 'How was the road?')).toBe(true);
    expect(has(t, 'Your answer sharpens hazard alerts for every rider on this route.')).toBe(true);
    ['Smooth', 'Mixed', 'Rough'].forEach((x) => expect(has(t, x)).toBe(true));
    expect(has(t, 'Clean tarmac, no surprises')).toBe(true);
    expect(has(t, 'A few rough patches')).toBe(true);
    expect(has(t, 'Potholes or loose gravel')).toBe(true);
  });

  it.each([['smooth', 'Smooth'], ['mixed', 'Mixed'], ['rough', 'Rough']] as const)('%s writes the rating, toasts, closes', async (value, title) => {
    const onClose = jest.fn(), onRated = jest.fn();
    const t = mount(sheet({ onClose, onRated }));
    press(t, `rate-${value}`);
    await flush();
    expect(setRouteRating).toHaveBeenCalledWith('u1', 'r1', value);
    expect(onRated).toHaveBeenCalledWith(value);
    expect(onClose).toHaveBeenCalled();
    expect(useToastStore.getState().toasts[0]).toMatchObject({ variant: 'success', message: `Thanks. Rated ${title.toLowerCase()}.` });
  });

  it('a failed write toasts an error and keeps the sheet open', async () => {
    (setRouteRating as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    const onClose = jest.fn(), onRated = jest.fn();
    const t = mount(sheet({ onClose, onRated }));
    press(t, 'rate-mixed');
    await flush();
    expect(onClose).not.toHaveBeenCalled();
    expect(onRated).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts[0].variant).toBe('error');
  });

  it('writes nothing when signed out or without a ride', async () => {
    useSessionStore.setState({ uid: null });
    const t = mount(sheet());
    press(t, 'rate-smooth');
    await flush();
    expect(setRouteRating).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts[0].variant).toBe('error');
  });

  it('marks the current rating selected and labels every row for screen readers', () => {
    const t = mount(sheet({ current: 'rough' }));
    const row = (v: string) => byTestId(t, `rate-${v}`)[0] ?? t.root.findAll((n) => n.props.testID === `rate-${v}`)[0];
    expect(row('rough').props.accessibilityState.selected).toBe(true);
    expect(row('smooth').props.accessibilityState.selected).toBe(false);
    expect(row('smooth').props.accessibilityLabel).toBe('Smooth. Clean tarmac, no surprises');
  });
});
