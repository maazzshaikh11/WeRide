/**
 * Road theme: `useTheme().road` honours prefs.road. night -> the theme's DARK road palette, day -> its LIGHT road
 * palette, auto -> dark when the sun is down at the rider's last known position (06:00-18:30 local clock with no fix),
 * re-checked every minute. The garage palette keeps following Light / Dark / Auto.
 */
import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

import { THEMES, ThemeId } from '../src/theme/palettes';
import { ThemeProvider, buildTheme, useTheme } from '../src/theme/ThemeProvider';
import { resolveRoadScheme } from '../src/theme/roadTheme';
import { useThemeStore } from '../src/theme/themeStore';
import { usePrefsStore } from '../src/store/prefsStore';
import { DEFAULT_PREFS } from '../src/models/domain';
import { useRouteStore } from '@routing/client/routeStore';

let mockScheme: 'light' | 'dark' | null = 'dark';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: () => mockScheme }));

const MUMBAI = { lat: 19.076, lng: 72.8777 };
const NIGHT_IN_MUMBAI = Date.UTC(2026, 2, 21, 1, 0); // 06:30 IST, before sunrise (06:42)
const DAY_IN_MUMBAI = Date.UTC(2026, 2, 21, 2, 0); // 07:30 IST

function Probe() {
  const t = useTheme();
  return <Text testID="probe">{`${t.scheme}|${t.roadScheme}|${t.colors.bg}|${t.road.bg}`}</Text>;
}
function read(tree: ReactTestRenderer) {
  const [garage, road, bg, roadBg] = String(tree.root.findByProps({ testID: 'probe' }).props.children).split('|');
  return { garage, road, bg, roadBg };
}
const mounted: ReactTestRenderer[] = [];
function mount() {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<ThemeProvider><Probe /></ThemeProvider>);
  });
  mounted.push(tree);
  return tree;
}
const setRoad = (road: 'night' | 'day' | 'auto') => act(() => { usePrefsStore.getState().setPref('road', road); });

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NIGHT_IN_MUMBAI);
  mockScheme = 'dark';
  act(() => {
    usePrefsStore.setState({ prefs: { ...DEFAULT_PREFS } });
    useThemeStore.setState({ themeId: 'demo', mode: 'system', lastFix: null });
    useRouteStore.setState({ currentLocation: null });
  });
});
afterEach(() => {
  mounted.splice(0).forEach((t) => act(() => t.unmount()));
  jest.useRealTimers();
});

describe('resolveRoadScheme', () => {
  it('night and day ignore the clock and the position', () => {
    expect(resolveRoadScheme('night', DAY_IN_MUMBAI, MUMBAI)).toBe('dark');
    expect(resolveRoadScheme('day', NIGHT_IN_MUMBAI, MUMBAI)).toBe('light');
  });
  it('auto follows the sun at the fix', () => {
    expect(resolveRoadScheme('auto', NIGHT_IN_MUMBAI, MUMBAI)).toBe('dark');
    expect(resolveRoadScheme('auto', DAY_IN_MUMBAI, MUMBAI)).toBe('light');
  });
  it('auto without a fix uses 06:00-18:30 local', () => {
    expect(resolveRoadScheme('auto', new Date(2026, 9, 6, 12, 0), null)).toBe('light');
    expect(resolveRoadScheme('auto', new Date(2026, 9, 6, 19, 0), null)).toBe('dark');
    expect(resolveRoadScheme('auto', new Date(2026, 9, 6, 5, 0), null)).toBe('dark');
  });
});

describe('buildTheme', () => {
  it('uses the garage scheme road palette unless a road scheme is given', () => {
    expect(buildTheme('demo', THEMES.demo.light).road).toBe(THEMES.demo.light.road);
    const t = buildTheme('ember', THEMES.ember.light, 'dark');
    expect(t.scheme).toBe('light');
    expect(t.road).toBe(THEMES.ember.dark.road);
    expect(t.roadScheme).toBe('dark');
    expect(t.colors.bg).toBe(THEMES.ember.light.bg);
  });
});

describe('ThemeProvider road palette', () => {
  const themes: ThemeId[] = ['demo', 'ember'];
  const garageModes = ['light', 'dark'] as const;

  it.each(themes.flatMap((id) => garageModes.flatMap((mode) => (['night', 'day'] as const).map((road) => [id, mode, road] as const))))(
    '%s, garage %s, road %s: garage palette by mode, road palette by the road setting',
    (id, mode, road) => {
      act(() => useThemeStore.setState({ themeId: id, mode }));
      setRoad(road);
      const { garage, road: roadScheme, bg, roadBg } = read(mount());
      expect(garage).toBe(mode);
      expect(bg).toBe(THEMES[id][mode].bg);
      expect(roadScheme).toBe(road === 'night' ? 'dark' : 'light');
      expect(roadBg).toBe(THEMES[id][road === 'night' ? 'dark' : 'light'].road.bg);
    },
  );

  it('system garage mode follows the OS while the road stays on its own setting', () => {
    mockScheme = 'light';
    setRoad('night');
    const r = read(mount());
    expect(r.garage).toBe('light');
    expect(r.road).toBe('dark');
  });

  it('auto: dark road before sunrise at the last known position, light road after, re-checked each minute', () => {
    act(() => useThemeStore.getState().setLastFix(MUMBAI));
    setRoad('auto');
    const tree = mount();
    expect(read(tree).road).toBe('dark');
    expect(read(tree).roadBg).toBe(THEMES.demo.dark.road.bg);

    // 06:30 IST -> 07:30 IST: pass sunrise (06:42), one minute at a time.
    act(() => {
      jest.setSystemTime(DAY_IN_MUMBAI);
      jest.advanceTimersByTime(60_000);
    });
    expect(read(tree).road).toBe('light');
    expect(read(tree).roadBg).toBe(THEMES.demo.light.road.bg);
    expect(read(tree).garage).toBe('dark'); // garage untouched by the road flip
  });

  it('auto: switching the setting stops the clock re-evaluation', () => {
    act(() => useThemeStore.getState().setLastFix(MUMBAI));
    setRoad('auto');
    const tree = mount();
    setRoad('night');
    act(() => {
      jest.setSystemTime(DAY_IN_MUMBAI);
      jest.advanceTimersByTime(5 * 60_000);
    });
    expect(read(tree).road).toBe('dark');
  });

  it('auto: a live fix wins over the remembered one and is remembered for next time', () => {
    act(() => useThemeStore.setState({ lastFix: { lat: 51.5, lng: -0.12 } })); // London: 01:00Z is night, 02:00Z too
    jest.setSystemTime(DAY_IN_MUMBAI); // 07:30 in Mumbai, 02:00 in London
    setRoad('auto');
    const tree = mount();
    expect(read(tree).road).toBe('dark'); // London says night
    act(() => useRouteStore.setState({ currentLocation: { lat: MUMBAI.lat, lng: MUMBAI.lng } as any }));
    expect(read(tree).road).toBe('light'); // the rider is now in Mumbai: day
    expect(useThemeStore.getState().lastFix).toEqual(MUMBAI);
  });

  it('auto with no fix at all uses the local clock fallback', () => {
    jest.setSystemTime(new Date(2026, 9, 6, 13, 0, 0));
    setRoad('auto');
    expect(read(mount()).road).toBe('light');
    const night = (() => {
      jest.setSystemTime(new Date(2026, 9, 6, 21, 0, 0));
      return mount();
    })();
    expect(read(night).road).toBe('dark');
  });
});

describe('last fix store', () => {
  it('only records a meaningful move', () => {
    act(() => useThemeStore.setState({ lastFix: null }));
    useThemeStore.getState().setLastFix(MUMBAI);
    useThemeStore.getState().setLastFix({ lat: MUMBAI.lat + 0.01, lng: MUMBAI.lng });
    expect(useThemeStore.getState().lastFix).toEqual(MUMBAI);
    useThemeStore.getState().setLastFix({ lat: MUMBAI.lat + 1, lng: MUMBAI.lng });
    expect(useThemeStore.getState().lastFix!.lat).toBeCloseTo(MUMBAI.lat + 1);
  });
});
