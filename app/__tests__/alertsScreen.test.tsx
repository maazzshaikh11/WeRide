/**
 * AlertsScreen: real contract hazard chips, double-submit guard, loading →
 * empty → populated states, ordering and the "new" highlight.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';

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

const mockHazard = {
  listener: null as null | ((c: unknown[]) => void),
  subscribe: jest.fn(),
  submit: jest.fn(),
  cluster: jest.fn(),
};
jest.mock('@hazard/services/hazardService', () => ({
  subscribeToHazardClusters: (g: string, cb: (c: unknown[]) => void) => mockHazard.subscribe(g, cb),
  submitHazardReport: (...args: unknown[]) => mockHazard.submit(...args),
  triggerClustering: (...args: unknown[]) => mockHazard.cluster(...args),
}));

jest.mock('@routing/client/routeStore', () => {
  const state: Record<string, unknown> = { route: null, currentLocation: null };
  const useRouteStore: any = (selector?: (s: typeof state) => unknown) => (selector ? selector(state) : state);
  useRouteStore.getState = () => state;
  useRouteStore.setState = (partial: Record<string, unknown>) => Object.assign(state, partial);
  return { useRouteStore, __esModule: true };
});

jest.mock('../src/store/ridersStore', () => {
  const state = { riders: new Map() };
  return {
    useRidersStore: (selector?: (s: typeof state) => unknown) => (selector ? selector(state) : state),
    __esModule: true,
  };
});

import { useAppStore } from '../src/store/appStore';
import { useToastStore } from '../src/store/toastStore';
import { useRouteStore } from '@routing/client/routeStore';
import AlertsScreen, { sortClusters, HAZARD_OPTIONS } from '../src/screens/AlertsScreen';

const LOCATION = {
  rider_id: 'user-1', group_id: 'group-1', timestamp_hlc: '1700000000000:0',
  lat: 18.5204, lng: 73.8567, speed_mps: 0, heading_deg: 0, spoof_flag: false, nis_score: 0, accuracy_m: 5,
};

function cluster(id: string, type: string, status: 'active' | 'resolved', hlcMs: number) {
  return {
    cluster_id: id, group_id: 'group-1', hazard_type: type, centroid_lat: 18.53, centroid_lng: 73.86,
    polygon_points: [], report_count: 2, hazard_score: 0.5, created_at_hlc: `${hlcMs}:0`, status,
  };
}

function texts(tree: renderer.ReactTestRenderer): string {
  return tree.root
    .findAll((n) => (n.type as unknown) === 'Text')
    .map((n) => ([] as unknown[]).concat(n.props.children).join(''))
    .join(' | ');
}

function chip(tree: renderer.ReactTestRenderer, label: string) {
  return tree.root.find(
    (n) => n.props.accessibilityLabel === `Report hazard: ${label}` && typeof n.props.onPress === 'function',
  );
}

function pushSnapshot(clusters: unknown[]) {
  act(() => {
    mockHazard.listener!(clusters);
  });
}

beforeEach(() => {
  mockHazard.listener = null;
  mockHazard.subscribe.mockReset().mockImplementation((_g: string, cb: (c: unknown[]) => void) => {
    mockHazard.listener = cb;
    return () => undefined;
  });
  mockHazard.submit.mockReset().mockResolvedValue({ queued: false });
  mockHazard.cluster.mockReset().mockResolvedValue(undefined);
  useAppStore.setState({ userId: 'user-1', groupId: 'group-1' });
  useRouteStore.setState({ currentLocation: LOCATION });
  useToastStore.setState({ toasts: [] });
});

describe('AlertsScreen report chips', () => {
  test('offers exactly the five contract hazard types', () => {
    const tree = render(<AlertsScreen />);
    const labels = Array.from(
      new Set(
        tree.root
          .findAll((n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Report hazard: ') && typeof n.props.onPress === 'function')
          .map((n) => n.props.accessibilityLabel.replace('Report hazard: ', '')),
      ),
    );
    expect(labels).toEqual(['Pothole', 'Oil spill', 'Accident', 'Debris', 'Other']);
    expect(HAZARD_OPTIONS.map((o) => o.type)).toEqual(['pothole', 'oil_spill', 'accident', 'debris', 'other']);
  });

  test.each([
    ['Pothole', 'pothole'],
    ['Oil spill', 'oil_spill'],
    ['Accident', 'accident'],
    ['Debris', 'debris'],
    ['Other', 'other'],
  ])('%s chip submits its own type (%s)', async (label, hazardType) => {
    const tree = render(<AlertsScreen />);
    await act(async () => {
      await chip(tree, label).props.onPress();
    });
    expect(mockHazard.submit).toHaveBeenCalledTimes(1);
    expect(mockHazard.submit).toHaveBeenCalledWith(hazardType, 18.5204, 73.8567, 'user-1', 'group-1', '1700000000000:0');
    expect(mockHazard.cluster).toHaveBeenCalledWith('group-1');
    expect(useToastStore.getState().toasts[0].message).toBe('Hazard reported');
  });

  test('a second tap while a report is in flight is ignored and chips are disabled', async () => {
    let resolve!: (v: { queued: boolean }) => void;
    mockHazard.submit.mockReturnValue(new Promise((r) => { resolve = r; }));
    const tree = render(<AlertsScreen />);

    act(() => {
      chip(tree, 'Pothole').props.onPress();
      chip(tree, 'Pothole').props.onPress();
      chip(tree, 'Debris').props.onPress();
    });
    expect(mockHazard.submit).toHaveBeenCalledTimes(1);
    expect(chip(tree, 'Debris').props.disabled).toBe(true);
    expect(texts(tree)).toContain('Sending your report');

    await act(async () => {
      resolve({ queued: false });
    });
    expect(chip(tree, 'Debris').props.disabled).toBeFalsy();

    await act(async () => {
      await chip(tree, 'Debris').props.onPress();
    });
    expect(mockHazard.submit).toHaveBeenCalledTimes(2);
  });

  test('without a location it warns and submits nothing', async () => {
    useRouteStore.setState({ currentLocation: null });
    const tree = render(<AlertsScreen />);
    await act(async () => {
      await chip(tree, 'Pothole').props.onPress();
    });
    expect(mockHazard.submit).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts[0]).toMatchObject({ variant: 'warn' });
    expect(useToastStore.getState().toasts[0].message).toContain('Location not available yet');
  });

  test('offline-queued reports say so; failures surface an error toast and re-enable chips', async () => {
    mockHazard.submit.mockResolvedValueOnce({ queued: true });
    const tree = render(<AlertsScreen />);
    await act(async () => {
      await chip(tree, 'Pothole').props.onPress();
    });
    expect(useToastStore.getState().toasts[0]).toMatchObject({ message: expect.stringContaining('queued'), variant: 'warn' });

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockHazard.submit.mockRejectedValueOnce(new Error('boom'));
    await act(async () => {
      await chip(tree, 'Pothole').props.onPress();
    });
    expect(useToastStore.getState().toasts[1]).toMatchObject({ variant: 'error' });
    expect(chip(tree, 'Pothole').props.disabled).toBeFalsy();
    warn.mockRestore();
  });
});

describe('AlertsScreen list states', () => {
  test('loading until the first snapshot, then empty, then populated', () => {
    const tree = render(<AlertsScreen />);
    expect(tree.root.findAllByProps({ testID: 'alerts-skeleton' }).length).toBeGreaterThan(0);
    expect(texts(tree)).not.toContain('No hazards reported');
    expect(texts(tree)).toContain('SYNCING');

    pushSnapshot([]);
    expect(tree.root.findAllByProps({ testID: 'alerts-skeleton' }).length).toBe(0);
    expect(texts(tree)).toContain('No hazards reported on this ride');
    expect(texts(tree)).toContain('0 ACTIVE');

    pushSnapshot([cluster('c1', 'oil_spill', 'active', Date.now())]);
    expect(texts(tree)).not.toContain('No hazards reported');
    expect(texts(tree)).toContain('Oil spill');
    expect(texts(tree)).toContain('1 ACTIVE');
  });

  test('a failed subscribe shows an error with a working retry', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockHazard.subscribe.mockImplementationOnce(() => {
      throw new Error('firestore down');
    });
    const tree = render(<AlertsScreen />);
    expect(texts(tree)).toContain('Could not load hazards');
    act(() => {
      tree.root.find((n) => n.props.accessibilityLabel === 'Retry loading hazards' && typeof n.props.onPress === 'function').props.onPress();
    });
    expect(mockHazard.subscribe).toHaveBeenCalledTimes(2);
    pushSnapshot([]);
    expect(texts(tree)).toContain('No hazards reported on this ride');
    warn.mockRestore();
  });

  test('no ride selected is not stuck loading', () => {
    useAppStore.setState({ groupId: null });
    const tree = render(<AlertsScreen />);
    expect(mockHazard.subscribe).not.toHaveBeenCalled();
    expect(texts(tree)).toContain('No ride selected');
  });

  test('active hazards sort before resolved, newest first', () => {
    const sorted = sortClusters([
      cluster('old-active', 'pothole', 'active', 1000),
      cluster('new-resolved', 'debris', 'resolved', 9000),
      cluster('new-active', 'accident', 'active', 5000),
    ] as any);
    expect(sorted.map((c) => c.cluster_id)).toEqual(['new-active', 'old-active', 'new-resolved']);
  });

  test('only clusters arriving after the first snapshot are highlighted as new', () => {
    const tree = render(<AlertsScreen />);
    pushSnapshot([cluster('c1', 'pothole', 'active', Date.now())]);
    expect(texts(tree)).not.toContain('NEW');
    pushSnapshot([cluster('c1', 'pothole', 'active', Date.now()), cluster('c2', 'debris', 'active', Date.now())]);
    const newCards = tree.root.findAll((n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('New. '));
    expect(newCards.length).toBeGreaterThan(0);
    expect(newCards.every((n) => n.props.accessibilityLabel.includes('Debris'))).toBe(true);
  });
});
