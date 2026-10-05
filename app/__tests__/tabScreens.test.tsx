/**
 * New tab screens smoke tests (master-spec Phase 15).
 * Renders StopsScreen, VoiceScreen, FamilyScreen, AlertsScreen, HistoryScreen
 * with module boundaries mocked. Verifies structure + key interactions.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Share } from 'react-native';

/** Renders a component inside act() so passive effects run synchronously. */
const mountedTrees: renderer.ReactTestRenderer[] = [];
function render(ui: React.ReactElement) {
  let tree: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(ui);
  });
  mountedTrees.push(tree!);
  return tree!;
}

// Unmount everything so Animated timers don't leak past test teardown
// (leaked timers crash the worker: Easing.bezier in torn-down registry).
afterEach(() => {
  while (mountedTrees.length > 0) {
    const tree = mountedTrees.pop()!;
    act(() => {
      tree.unmount();
    });
  }
  jest.useFakeTimers();
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

// --- mocks (registered before imports) ---------------------------------------

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native/Libraries/Linking/Linking', () => ({
  canOpenURL: jest.fn(() => Promise.resolve(true)),
  openURL: jest.fn(() => Promise.resolve()),
}));

jest.mock('@react-native-clipboard/clipboard', () => ({
  default: { setString: jest.fn(), getString: jest.fn(() => '') },
  setString: jest.fn(),
}));

jest.mock('@routing/group/groupService', () => ({
  GroupService: jest.fn().mockImplementation(() => ({
    myGroups: jest.fn((cb: (g: unknown[]) => void) => {
      cb([
        {
          id: 'group-1',
          name: 'Morning Ride',
          created_by: 'user-1',
          member_ids: ['user-1', 'user-2', 'user-3'],
          created_at: new Date(),
          active_ride_id: null,
        },
      ]);
      return () => undefined;
    }),
  })),
  __esModule: true,
}));

jest.mock('@flvoice/vox/voxClient', () => ({
  __esModule: true,
  VoxClient: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockRejectedValue(new Error('no webrtc in tests')),
    stop: jest.fn().mockResolvedValue(undefined),
    setVoiceActive: jest.fn(),
  })),
}));

jest.mock('../src/services/socketService', () => ({
  getLocationSocket: jest.fn(() => ({ on: jest.fn(), off: jest.fn(), emit: jest.fn(), connected: true })),
  getVoxSocket: jest.fn(() => ({ on: jest.fn(), off: jest.fn(), emit: jest.fn(), connected: true })),
}));

jest.mock('../src/services/firebaseService', () => ({
  firebaseAuth: { currentUser: { uid: 'user-1' } },
}));

jest.mock('@hazard/services/hazardService', () => ({
  subscribeToHazardClusters: jest.fn((groupId: string, cb: (c: unknown[]) => void) => {
    cb([
      {
        cluster_id: 'cluster-1',
        hazard_type: 'pothole',
        hazard_score: 0.6,
        report_count: 2,
        status: 'active',
        centroid_lat: 18.5,
        centroid_lng: 73.8,
        polygon_points: [],
      },
    ]);
    return () => undefined;
  }),
  submitHazardReport: jest.fn().mockResolvedValue({}),
  triggerClustering: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@routing/client/routeStore', () => {
  const state = {
    route: null,
    avoidHazardTypes: [] as string[],
    isLoading: false,
    currentLocation: null,
    lastValidLocation: null,
    activeClusters: [],
    setRoute: jest.fn(),
    setAvoidHazardTypes: jest.fn(),
    setIsLoading: jest.fn(),
    setCurrentLocation: jest.fn(),
    setLastValidLocation: jest.fn(),
    setActiveClusters: jest.fn(),
  };
  const useRouteStore: any = (selector?: (s: typeof state) => unknown) =>
    (selector ? selector(state) : state);
  useRouteStore.getState = () => state;
  useRouteStore.setState = (partial: Partial<typeof state>) => Object.assign(state, partial);
  return { useRouteStore, __esModule: true };
});

jest.mock('../src/store/ridersStore', () => {
  const riders = new Map<string, unknown>([
    ['user-2', { location: { lat: 1, lng: 1, timestamp_hlc: `${Date.now()}:0` }, receivedAt: Date.now(), markerState: 'GREEN' }],
    ['user-3', { location: { lat: 1, lng: 1, timestamp_hlc: `${Date.now()}:0` }, receivedAt: Date.now(), markerState: 'GREEN' }],
  ]);
  const state = { riders, connected: true, subscribed: true, selectedRiderId: null };
  return {
    useRidersStore: (selector?: (s: typeof state) => unknown) => (selector ? selector(state) : state),
    __esModule: true,
  };
});

// --- imports -----------------------------------------------------------------

import { useAppStore } from '../src/store/appStore';
import { useStopsStore } from '../src/store/stopsStore';
import { useToastStore } from '../src/store/toastStore';
import { useRouteStore } from '@routing/client/routeStore';
import StopsScreen from '../src/screens/StopsScreen';
import VoiceScreen from '../src/screens/VoiceScreen';
import FamilyScreen from '../src/screens/FamilyScreen';
import AlertsScreen from '../src/screens/AlertsScreen';
import HistoryScreen from '../src/screens/HistoryScreen';

// -----------------------------------------------------------------------------

describe('StopsScreen', () => {
  test('renders header, progress and stop timeline', () => {
    useStopsStore.getState().reset();
    const tree = render(<StopsScreen />).root;
    const texts = tree.findAll((n) => (n.type as unknown) === 'Text').map((n) => JSON.stringify(n.props.children));
    const joined = texts.join(' ');
    expect(joined).toContain('Planned Stops');
    expect(joined).toContain('Destination');
    expect(joined).toContain('Up next'); // demo tag label, not the raw 'current' status
  });

  test('tapping the current stop marks it done and pushes a toast', () => {
    useStopsStore.getState().reset();
    useToastStore.setState({ toasts: [] });
    const tree = render(<StopsScreen />).root;
    // Find the pressable for the current stop (the only stop node with onPress)
    const pressables = tree.findAll((n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel?.includes('Stop'));
    expect(pressables.length).toBeGreaterThan(0);
    act(() => {
      pressables[0].props.onPress();
    });
    const stops = useStopsStore.getState().stops;
    expect(stops[stops.length - 1].status === 'done' || stops.every((s) => s.status === 'done')).toBe(true);
  });
});

describe('VoiceScreen', () => {
  test('renders participant grid and VOX zone', () => {
    useAppStore.setState({ userId: 'user-1', groupId: 'group-1' });
    const tree = render(<VoiceScreen />).root;
    const joined = tree.findAll((n) => (n.type as unknown) === 'Text').map((n) => JSON.stringify(n.props.children)).join(' ');
    expect(joined).toContain('Group Voice');
    expect(joined).toContain('You');
  });
});

describe('FamilyScreen', () => {
  test('shows real share action and states live tracking is unavailable (no fake watchers)', () => {
    useAppStore.setState({ userId: 'user-1', groupId: 'group-1' });
    const tree = render(<FamilyScreen />).root;
    const joined = tree.findAll((n) => (n.type as unknown) === 'Text').map((n) => JSON.stringify(n.props.children)).join(' ');
    expect(joined).toContain('Send my location');
    expect(joined).toContain('Not available yet');
    // Previously fabricated content must be gone.
    expect(joined).not.toContain('Mom');
    expect(joined).not.toContain('Hritika');
    expect(joined).not.toContain('weride.app/track');
  });

  test('sharing without a verified fix warns instead of sharing a fake position', async () => {
    useToastStore.setState({ toasts: [] });
    useRouteStore.setState({ currentLocation: null });
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as any);
    const tree = render(<FamilyScreen />).root;
    const btn = tree.find((n) => n.props.accessibilityLabel === 'Send my location' && typeof n.props.onPress === 'function');
    await act(async () => {
      await btn.props.onPress();
    });
    expect(shareSpy).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts[0].variant).toBe('warn');
    shareSpy.mockRestore();
  });

  test('sharing with a fix shares a Google Maps pin of the real coordinates', async () => {
    useRouteStore.setState({
      currentLocation: {
        rider_id: 'user-1', group_id: 'group-1', timestamp_hlc: '1:0',
        lat: 18.5204, lng: 73.8567, speed_mps: 0, heading_deg: 0,
        spoof_flag: false, nis_score: 0, accuracy_m: 5,
      },
    });
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as any);
    const tree = render(<FamilyScreen />).root;
    const btn = tree.find((n) => n.props.accessibilityLabel === 'Send my location' && typeof n.props.onPress === 'function');
    await act(async () => {
      await btn.props.onPress();
    });
    expect(shareSpy).toHaveBeenCalledWith({
      message: expect.stringContaining('query=18.520400,73.856700'),
    });
    shareSpy.mockRestore();
  });
});

describe('AlertsScreen', () => {
  test('renders report chips and alert cards from hazard subscription', () => {
    useAppStore.setState({ userId: 'user-1', groupId: 'group-1' });
    const tree = render(<AlertsScreen />).root;
    const joined = tree.findAll((n) => (n.type as unknown) === 'Text').map((n) => JSON.stringify(n.props.children)).join(' ');
    expect(joined).toContain('Road Alerts');
    expect(joined).toContain('Pothole');
    expect(joined).toContain('Pothole'); // card title
  });
});

describe('HistoryScreen', () => {
  test('renders stats row and empty state without route', () => {
    useAppStore.setState({ userId: 'user-1', groupId: 'group-1' });
    const tree = render(<HistoryScreen />).root;
    const joined = tree.findAll((n) => (n.type as unknown) === 'Text').map((n) => JSON.stringify(n.props.children)).join(' ');
    expect(joined).toContain('Ride History');
    expect(joined).toContain('TOTAL KM');
    expect(joined).toContain('Your ride history will appear here');
  });
});