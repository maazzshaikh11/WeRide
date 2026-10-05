/**
 * Stops, Voice, Family and Alerts re-colour under every palette (Demo / Ember x
 * light / dark): the screen background, surfaces, accents and the shared
 * header/pill/progress components all come from the active theme. Layout is
 * identical across palettes; only colours change.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

const mounted: renderer.ReactTestRenderer[] = [];
function render(ui: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(ui);
  });
  mounted.push(tree);
  return tree;
}
afterEach(() => {
  while (mounted.length > 0) {
    const tree = mounted.pop()!;
    act(() => tree.unmount());
  }
  jest.useFakeTimers();
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@flvoice/vox/voxClient', () => ({
  __esModule: true,
  VoxClient: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    setVoiceActive: jest.fn(),
  })),
}));
jest.mock('@flvoice/vox/micPermission', () => ({ requestMicrophonePermission: jest.fn().mockResolvedValue(true) }));
jest.mock('../src/services/socketService', () => ({
  getVoxSocket: jest.fn(() => ({ on: jest.fn(), off: jest.fn(), emit: jest.fn(), connected: true })),
}));
jest.mock('@hazard/services/hazardService', () => ({
  subscribeToHazardClusters: jest.fn((_g: string, cb: (c: unknown[]) => void) => {
    cb([
      {
        cluster_id: 'c1', hazard_type: 'pothole', hazard_score: 0.6, report_count: 2, status: 'active',
        centroid_lat: 18.5, centroid_lng: 73.8, polygon_points: [], created_at_hlc: `${Date.now()}:0`,
      },
    ]);
    return () => undefined;
  }),
  submitHazardReport: jest.fn().mockResolvedValue({}),
  triggerClustering: jest.fn().mockResolvedValue(undefined),
  resolveHazard: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@routing/client/routeStore', () => {
  const state: Record<string, unknown> = { route: null, currentLocation: null };
  const useRouteStore: any = (selector?: (s: typeof state) => unknown) => (selector ? selector(state) : state);
  useRouteStore.getState = () => state;
  useRouteStore.setState = (partial: Record<string, unknown>) => Object.assign(state, partial);
  return { useRouteStore, __esModule: true };
});
jest.mock('../src/store/ridersStore', () => {
  const state = { riders: new Map([['user-2', {}]]) };
  return {
    useRidersStore: (selector?: (s: typeof state) => unknown) => (selector ? selector(state) : state),
    __esModule: true,
  };
});

import { THEMES, Plates, ThemeId, Scheme } from '../src/theme/palettes';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { useThemeStore } from '../src/theme/themeStore';
import { useAppStore } from '../src/store/appStore';
import { useStopsStore } from '../src/store/stopsStore';
import { useRidePlanStore } from '../src/store/ridePlanStore';
import StopsScreen from '../src/screens/StopsScreen';
import VoiceScreen from '../src/screens/VoiceScreen';
import FamilyScreen from '../src/screens/FamilyScreen';
import AlertsScreen from '../src/screens/AlertsScreen';
import StatBox from '../src/components/StatBox';
import StatusBadge from '../src/components/StatusBadge';
import AvatarStack from '../src/components/AvatarStack';
import Progressbar from '../src/components/Progressbar';

const ALL: [ThemeId, Scheme][] = [['demo', 'light'], ['demo', 'dark'], ['ember', 'light'], ['ember', 'dark']];

function inTheme(id: ThemeId, scheme: Scheme, ui: React.ReactElement) {
  act(() => useThemeStore.setState({ themeId: id, mode: scheme }));
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

/** Every flattened style on host elements, so a colour can be looked up by value. */
function styles(tree: renderer.ReactTestRenderer): Record<string, unknown>[] {
  return tree.root
    .findAll((n) => typeof n.type === 'string' && n.props.style != null)
    .map((n) => StyleSheet.flatten(n.props.style) as Record<string, unknown>);
}
function has(tree: renderer.ReactTestRenderer, key: string, value: unknown): boolean {
  return styles(tree).some((s) => s[key] === value);
}

beforeEach(() => {
  useAppStore.setState({ userId: 'user-1', groupId: 'group-1' });
  useRidePlanStore.getState().clearPlan();
  useStopsStore.getState().reset();
});

describe.each(ALL)('%s / %s', (id, scheme) => {
  const p = THEMES[id][scheme];

  test('StopsScreen: page, waypoint marker, rail and progress follow the palette', () => {
    useRidePlanStore.setState({
      destination: { label: 'Lonavala', lat: 18.75, lng: 73.4 },
      stops: [{ id: 's1', label: 'Chai Point', lat: 18.6, lng: 73.7, icon: 'x' }],
    });
    const t = inTheme(id, scheme, <StopsScreen />);
    expect(has(t, 'backgroundColor', p.bg)).toBe(true);
    // Diamond marker layers: ink (upcoming), accent (current), ok (done), ringed in ink.
    expect(has(t, 'backgroundColor', p.pri)).toBe(true);
    expect(has(t, 'backgroundColor', p.ok)).toBe(true);
    expect(has(t, 'borderColor', p.ink)).toBe(true);
    // Dashed rail in line2 (svg stroke), progress track in line2.
    expect(t.root.findAll((n) => n.props.stroke === p.line2).length).toBeGreaterThan(0);
    expect(has(t, 'backgroundColor', p.line2)).toBe(true);
  });

  test('VoiceScreen: page, rider tile, toolbar and plate follow the palette', () => {
    const t = inTheme(id, scheme, <VoiceScreen />);
    expect(has(t, 'backgroundColor', p.bg)).toBe(true);
    expect(has(t, 'backgroundColor', p.card)).toBe(true); // rider tile
    expect(has(t, 'backgroundColor', p.card2)).toBe(true); // mute / leave
    expect(has(t, 'backgroundColor', p.pri)).toBe(true); // "You" avatar
    // Road-sign plates are the same in every theme.
    // (first render is the "connecting" state: yellow)
    expect(has(t, 'backgroundColor', Plates.yellow.bg)).toBe(true);
  });

  test('FamilyScreen: page, card and primary button follow the palette', () => {
    const t = inTheme(id, scheme, <FamilyScreen />);
    expect(has(t, 'backgroundColor', p.bg)).toBe(true);
    expect(has(t, 'backgroundColor', p.card)).toBe(true);
    expect(has(t, 'backgroundColor', p.pri)).toBe(true);
    expect(has(t, 'color', p.ink)).toBe(true);
  });

  test('AlertsScreen: page, hazard tiles and alert card follow the palette; yellow plate is fixed', () => {
    const t = inTheme(id, scheme, <AlertsScreen />);
    expect(has(t, 'backgroundColor', p.bg)).toBe(true);
    expect(has(t, 'backgroundColor', p.card2)).toBe(true); // .hz tile + icon well
    expect(has(t, 'borderColor', p.line2)).toBe(true); // .hz rim
    expect(has(t, 'backgroundColor', p.card)).toBe(true); // alert card
    expect(has(t, 'backgroundColor', Plates.yellow.bg)).toBe(true);
  });

  test('StatBox, StatusBadge, AvatarStack and Progressbar follow the palette', () => {
    const box = inTheme(id, scheme, <StatBox value="12" label="km" />);
    expect(has(box, 'backgroundColor', p.card2)).toBe(true);
    expect(has(box, 'color', p.ink)).toBe(true);
    const badge = inTheme(id, scheme, <StatusBadge label="Safe" variant="safe" />);
    expect(has(badge, 'color', p.ok)).toBe(true);
    const stack = inTheme(id, scheme, <AvatarStack names={['alice', 'bob']} />);
    expect(has(stack, 'borderColor', p.bg)).toBe(true);
    const bar = inTheme(id, scheme, <Progressbar completed={1} total={2} />);
    expect(has(bar, 'backgroundColor', p.ink)).toBe(true);
    expect(has(bar, 'backgroundColor', p.line2)).toBe(true);
  });
});

test('switching the theme re-colours a mounted screen without remounting it', () => {
  act(() => useThemeStore.setState({ themeId: 'demo', mode: 'dark' }));
  const t = render(<ThemeProvider><FamilyScreen /></ThemeProvider>);
  expect(has(t, 'backgroundColor', THEMES.demo.dark.bg)).toBe(true);
  expect(has(t, 'backgroundColor', THEMES.ember.light.bg)).toBe(false);
  act(() => useThemeStore.setState({ themeId: 'ember', mode: 'light' }));
  expect(has(t, 'backgroundColor', THEMES.ember.light.bg)).toBe(true);
  expect(has(t, 'backgroundColor', THEMES.demo.dark.bg)).toBe(false);
  expect(has(t, 'backgroundColor', THEMES.ember.light.pri)).toBe(true);
});
