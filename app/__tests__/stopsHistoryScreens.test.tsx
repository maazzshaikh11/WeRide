/**
 * StopsScreen: empty state vs planned stops. HistoryScreen: empty state vs the
 * in-progress ride card (no placeholder stats). Real stores, mocked boundaries.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Share } from 'react-native';

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

jest.mock('@routing/client/routeStore', () => {
  const state: Record<string, unknown> = { route: null, currentLocation: null };
  const useRouteStore: any = (selector?: (s: typeof state) => unknown) => (selector ? selector(state) : state);
  useRouteStore.getState = () => state;
  useRouteStore.setState = (partial: Record<string, unknown>) => Object.assign(state, partial);
  return { useRouteStore, __esModule: true };
});

jest.mock('../src/store/ridersStore', () => {
  const state = { riders: new Map([['user-2', {}], ['user-3', {}]]) };
  return {
    useRidersStore: (selector?: (s: typeof state) => unknown) => (selector ? selector(state) : state),
    __esModule: true,
  };
});

jest.mock('../src/ui/haptics', () => ({
  ...jest.requireActual('../src/ui/haptics'),
  haptic: jest.fn(),
}));

import { haptic } from '../src/ui/haptics';
import StopNode from '../src/components/StopNode';
import { useAppStore } from '../src/store/appStore';
import { useStopsStore } from '../src/store/stopsStore';
import { useRidePlanStore } from '../src/store/ridePlanStore';
import { useToastStore } from '../src/store/toastStore';
import { useRouteStore } from '@routing/client/routeStore';
import StopsScreen from '../src/screens/StopsScreen';
import HistoryScreen from '../src/screens/HistoryScreen';

function texts(tree: renderer.ReactTestRenderer): string {
  return tree.root
    .findAll((n) => (n.type as unknown) === 'Text')
    .map((n) => ([] as unknown[]).concat(n.props.children).join(''))
    .join(' | ');
}

function stopButtons(tree: renderer.ReactTestRenderer) {
  return tree.root.findAll(
    (n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Stop ') && typeof n.props.onPress === 'function',
  );
}

describe('StopsScreen', () => {
  beforeEach(() => {
    useRidePlanStore.getState().clearPlan();
    useStopsStore.getState().reset();
    useToastStore.setState({ toasts: [] });
    useRouteStore.setState({ currentLocation: null });
  });

  test('no destination and no stops: shows the empty state, not a placeholder "Destination" stop', () => {
    const tree = render(<StopsScreen />);
    const t = texts(tree);
    expect(t).toContain('This ride has no planned stops');
    expect(t).not.toContain('Up next');
    expect(t).not.toContain('Tap the next stop');
    expect(stopButtons(tree)).toHaveLength(0);
  });

  test('planned stops + destination render as a timeline with a tap hint, no numbered eyebrow', () => {
    useRidePlanStore.setState({
      destination: { label: 'Lonavala, Maharashtra', lat: 18.75, lng: 73.4 },
      stops: [{ id: 's1', label: 'Chai Point, Pune', lat: 18.6, lng: 73.7, icon: '☕' }],
    });
    const tree = render(<StopsScreen />);
    const t = texts(tree);
    expect(t).toContain('Chai Point');
    expect(t).toContain('Lonavala');
    expect(t).toContain('Up next');
    expect(t).toContain('Upcoming');
    expect(t).toContain('0 of 2 stops reached');
    expect(t).toContain('Tap the next stop when you arrive');
    expect(t).not.toMatch(/0\d — /);
    // Only the current stop is pressable.
    expect(new Set(stopButtons(tree).map((n) => n.props.accessibilityLabel)).size).toBe(1);
  });

  test('shows real distance from the verified position', () => {
    useRidePlanStore.setState({ destination: { label: 'Lonavala', lat: 18.75, lng: 73.4 }, stops: [] });
    useRouteStore.setState({ currentLocation: { lat: 18.52, lng: 73.85 } as never });
    const tree = render(<StopsScreen />);
    expect(texts(tree)).toMatch(/\d+ km away/);
  });

  test('marking stops reached advances the timeline and ends with "All stops reached"', () => {
    useRidePlanStore.setState({ destination: { label: 'Lonavala', lat: 18.75, lng: 73.4 }, stops: [] });
    const tree = render(<StopsScreen />);
    act(() => {
      stopButtons(tree)[0].props.onPress();
    });
    expect(useToastStore.getState().toasts[0].message).toContain('Marked "Lonavala" as reached');
    const t = texts(tree);
    expect(t).toContain('1 of 1 stop reached');
    expect(t).toContain('All stops reached');
    expect(t).not.toContain('Tap the next stop');
  });
});

/** The real pressable (outer wrappers skip the press handlers). */
function realPressable(tree: renderer.ReactTestRenderer, match: (n: any) => boolean) {
  return tree.root.findAll((n) => match(n.props) && typeof n.props.onPressIn === 'function')[0];
}

describe('StopsScreen interactions', () => {
  beforeEach(() => {
    useRidePlanStore.getState().clearPlan();
    useStopsStore.getState().reset();
    useToastStore.setState({ toasts: [] });
    (haptic as jest.Mock).mockClear();
    useRidePlanStore.setState({
      destination: { label: 'Lonavala, Maharashtra', lat: 18.75, lng: 73.4 },
      stops: [{ id: 's1', label: 'Chai Point, Pune', lat: 18.6, lng: 73.7, icon: '☕' }],
    });
  });

  test('only the current stop has press feedback; pressing it marks it reached with a success haptic', () => {
    const tree = render(<StopsScreen />);
    const current = realPressable(tree, (p) => typeof p.accessibilityLabel === 'string' && p.accessibilityLabel.startsWith('Stop Chai Point'));
    expect(current).toBeDefined();
    expect(typeof current.props.onPressOut).toBe('function');
    // Upcoming stop is not a pressable at all (so it is never dimmed like a disabled button).
    expect(realPressable(tree, (p) => typeof p.accessibilityLabel === 'string' && p.accessibilityLabel.startsWith('Stop Lonavala'))).toBeUndefined();

    act(() => {
      current.props.onPress();
    });
    const stops = useStopsStore.getState().stops;
    expect(stops.map((x) => x.status)).toEqual(['done', 'current']);
    expect(haptic).toHaveBeenCalledWith('success');
    expect(texts(tree)).toContain('1 of 2 stops reached');

    // The next stop is now the pressable one.
    const next = realPressable(tree, (p) => typeof p.accessibilityLabel === 'string' && p.accessibilityLabel.startsWith('Stop Lonavala'));
    expect(next).toBeDefined();
    act(() => {
      next.props.onPress();
    });
    expect(useStopsStore.getState().stops.map((x) => x.status)).toEqual(['done', 'done']);
    expect(texts(tree)).toContain('All stops reached');
  });

  test('StopNode re-renders upcoming -> current -> done without throwing and keeps its state text', () => {
    const base = { id: 'a', name: 'Stop A', icon: '☕' } as const;
    const tree = render(<StopNode stop={{ ...base, status: 'upcoming' }} />);
    expect(texts(tree)).toContain('Upcoming');
    act(() => tree.update(<StopNode stop={{ ...base, status: 'current' }} onPress={() => undefined} />));
    expect(texts(tree)).toContain('Up next');
    act(() => tree.update(<StopNode stop={{ ...base, status: 'done' }} />));
    expect(texts(tree)).toContain('Reached');
    expect(texts(tree)).toContain('✓');
  });
});

describe('HistoryScreen', () => {
  beforeEach(() => {
    useAppStore.setState({ userId: 'user-1', groupId: 'group-12345678' });
    useRouteStore.setState({ route: null });
  });

  test('no route: honest empty state and no placeholder stats', () => {
    const t = texts(render(<HistoryScreen />));
    expect(t).toContain('No completed rides yet');
    expect(t).toContain('Rides you finish will be listed here');
    expect(t).not.toContain('—');
    expect(t).not.toContain('CITIES');
    expect(t).not.toContain('TOTAL KM');
  });

  test('route present: in-progress card with real distance, eta and rider count; share sends them', () => {
    useRouteStore.setState({ route: { distance_km: 12.46, eta_minutes: 31.6 } as never });
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as any);
    const tree = render(<HistoryScreen />);
    const t = texts(tree);
    expect(t).toContain('In progress');
    expect(t).toContain('12.5');
    expect(t).toContain('32');
    expect(t).toContain('2'); // riders from the riders store
    expect(t).not.toContain('No completed rides yet');
    expect(t).not.toContain('—');
    expect(t).not.toMatch(/\p{Extended_Pictographic}/u);

    const btn = tree.root.find((n) => n.props.accessibilityLabel?.startsWith('Share ride card') && typeof n.props.onPress === 'function');
    act(() => {
      btn.props.onPress();
    });
    expect(shareSpy).toHaveBeenCalledWith({ message: expect.stringContaining('12.5 km') });
    shareSpy.mockRestore();
  });

  describe('ride card press', () => {
    beforeEach(() => {
      useRouteStore.setState({ route: { distance_km: 12.46, eta_minutes: 31.6 } as never });
    });
    const card = (tree: renderer.ReactTestRenderer) =>
      realPressable(tree, (p) => p.accessibilityHint === 'Opens the live map');
    const share = (tree: renderer.ReactTestRenderer) =>
      realPressable(tree, (p) => typeof p.accessibilityLabel === 'string' && p.accessibilityLabel.startsWith('Share ride card'));

    test('pressing the in-progress card switches to the Home (map) tab', () => {
      const navigate = jest.fn();
      const tree = render(<HistoryScreen navigation={{ navigate }} />);
      expect(card(tree)).toBeDefined();
      act(() => {
        card(tree).props.onPress();
      });
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith('Home');
    });

    test('the Share button shares and does not navigate', () => {
      const navigate = jest.fn();
      const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as any);
      const tree = render(<HistoryScreen navigation={{ navigate }} />);
      expect(share(tree)).not.toBe(card(tree));
      act(() => {
        share(tree).props.onPress();
      });
      expect(shareSpy).toHaveBeenCalledTimes(1);
      expect(navigate).not.toHaveBeenCalled();
      shareSpy.mockRestore();
    });

    test('without a navigation prop the card is static (no dead press target) and Share still works', () => {
      const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as any);
      const tree = render(<HistoryScreen />);
      expect(card(tree)).toBeUndefined();
      expect(share(tree)).toBeDefined();
      act(() => {
        share(tree).props.onPress();
      });
      expect(shareSpy).toHaveBeenCalled();
      shareSpy.mockRestore();
    });
  });
});
