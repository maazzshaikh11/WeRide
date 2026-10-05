/**
 * Re-colouring: Login, Rides list (+ RideCard), Create-ride sheet and History
 * must take every colour from the active theme, so the same tree renders in
 * the four palettes (Demo / Ember x light / dark) with no layout change.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, ReactTestInstance } from 'react-test-renderer';

const mockAuth: Record<string, any> = {
  currentUser: { uid: 'u1', email: 'rider@x.com' },
  onAuthStateChanged: jest.fn(),
  signOut: jest.fn(),
};
jest.mock('../src/services/firebaseService', () => ({
  get firebaseAuth() {
    return mockAuth;
  },
  saveFcmToken: jest.fn(),
}));
jest.mock('@react-native-clipboard/clipboard', () => ({ __esModule: true, default: { setString: jest.fn() } }));
jest.mock('../src/store/rideSession', () => ({ resetRideSession: jest.fn() }));
jest.mock('../src/utils/geocode', () => ({ geocodeSearchStrict: jest.fn().mockResolvedValue([]) }));

const G = {
  id: 'g1', name: 'Morning Ride', created_by: 'u2', member_ids: ['u1', 'u2'], created_at: null,
  active_ride_id: null, join_code: 'K7M2QX', ride_type: 'Sport', start_time_ms: Date.now() + 25 * 60_000,
};
let mockOnGroups: ((g: any[]) => void) | null = null;
jest.mock('@routing/group/groupService', () => ({
  RIDE_TYPES: ['Casual', 'Touring', 'Sport', 'Off-road'],
  GroupService: function GroupService() {
    return {
      myGroups: (cb: (g: any[]) => void) => {
        mockOnGroups = cb;
        return () => undefined;
      },
      joinGroup: jest.fn(),
      leaveGroup: jest.fn(),
      createGroup: jest.fn(),
      getGroup: jest.fn(),
    };
  },
}));

import LoginScreen from '../src/screens/LoginScreen';
import GroupListScreen from '../src/screens/GroupListScreen';
import HistoryScreen from '../src/screens/HistoryScreen';
import CreateRideModal from '../src/components/CreateRideModal';
import HistoryCard from '../src/components/HistoryCard';
import RideCard from '../src/components/RideCard';
import { THEMES, ThemeId, Scheme } from '../src/theme/palettes';
import { ThemeContext, buildTheme } from '../src/theme/ThemeProvider';
import { useRouteStore } from '@routing/client/routeStore';

const COMBOS: [ThemeId, Scheme][] = [
  ['demo', 'light'], ['demo', 'dark'], ['ember', 'light'], ['ember', 'dark'],
];

const mounted: ReturnType<typeof create>[] = [];
afterEach(() => mounted.splice(0).forEach((t) => act(() => t.unmount())));

function inTheme(id: ThemeId, scheme: Scheme, el: React.ReactElement) {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<ThemeContext.Provider value={buildTheme(id, THEMES[id][scheme])}>{el}</ThemeContext.Provider>);
  });
  mounted.push(tree);
  return tree;
}

const allStyles = (tree: ReturnType<typeof create>) =>
  tree.root.findAll((n: ReactTestInstance) => n.props.style != null).map((n) => StyleSheet.flatten(n.props.style) ?? {});
const has = (tree: ReturnType<typeof create>, key: 'backgroundColor' | 'borderColor', value: string) =>
  allStyles(tree).some((s: any) => s[key] === value);

beforeEach(() => {
  mockAuth.onAuthStateChanged.mockReset().mockImplementation((cb: (u: null) => void) => {
    cb(null);
    return () => undefined;
  });
  mockOnGroups = null;
  useRouteStore.setState({ route: null });
});

describe.each(COMBOS)('re-colours in %s / %s', (id, scheme) => {
  const P = THEMES[id][scheme];

  it('LoginScreen: page is bg, primary action is pri', () => {
    const tree = inTheme(id, scheme, <LoginScreen navigation={{ replace: jest.fn() }} />);
    expect(has(tree, 'backgroundColor', P.bg)).toBe(true);
    expect(has(tree, 'backgroundColor', P.pri)).toBe(true);
    expect(has(tree, 'backgroundColor', P.card)).toBe(true); // field surface
  });

  it('GroupListScreen: page is bg, ride ticket is card, FAB is pri', async () => {
    const tree = inTheme(id, scheme, <GroupListScreen navigation={{ navigate: jest.fn(), reset: jest.fn() }} />);
    await act(async () => mockOnGroups!([G]));
    expect(has(tree, 'backgroundColor', P.bg)).toBe(true);
    expect(has(tree, 'backgroundColor', P.card)).toBe(true);
    expect(has(tree, 'borderColor', P.line)).toBe(true);
    expect(has(tree, 'backgroundColor', P.pri)).toBe(true);
  });

  it('RideCard: ticket is card, perforation notches are the page bg, upcoming pill is pri', () => {
    const tree = inTheme(id, scheme, (
      <RideCard
        badge={{ label: 'Upcoming', tone: 'ice' }}
        title="Ride to Lonavala"
        stats={[{ value: '58', label: 'km' }]}
        mapPoints={[{ lat: 18.5, lng: 73.8 }, { lat: 18.7, lng: 73.4 }]}
        memberCount={2}
        onPress={() => undefined}
        accessibilityLabel="Open"
      />
    ));
    expect(has(tree, 'backgroundColor', P.card)).toBe(true);
    const perf = tree.root.findByProps({ testID: 'ride-perforation' });
    const notches = perf.findAll((n) => StyleSheet.flatten(n.props.style)?.backgroundColor === P.bg);
    expect(notches.length).toBeGreaterThanOrEqual(2);
    expect(has(tree, 'backgroundColor', P.pri)).toBe(true);
  });

  it('CreateRideModal: sheet is bg over a scrim, Create is pri', () => {
    const tree = inTheme(id, scheme, <CreateRideModal visible onClose={() => undefined} onCreated={() => undefined} />);
    expect(has(tree, 'backgroundColor', P.bg)).toBe(true);
    expect(has(tree, 'backgroundColor', P.scrim)).toBe(true);
    expect(has(tree, 'backgroundColor', P.line2)).toBe(true); // grab handle
    expect(has(tree, 'backgroundColor', P.pri)).toBe(true);
  });

  it('HistoryScreen: page is bg; the in-progress card is card', () => {
    useRouteStore.setState({ route: { distance_km: 12.4, eta_minutes: 30 } as never });
    const tree = inTheme(id, scheme, <HistoryScreen />);
    expect(has(tree, 'backgroundColor', P.bg)).toBe(true);
    expect(has(tree, 'backgroundColor', P.card)).toBe(true);
  });

  it('HistoryCard: static card surface and rim come from the palette', () => {
    const tree = inTheme(id, scheme, <HistoryCard name="Ride" meta="12 Aug" stats={[{ label: 'km', value: '1' }]} />);
    expect(has(tree, 'backgroundColor', P.card)).toBe(true);
    expect(has(tree, 'borderColor', P.line)).toBe(true);
  });
});
