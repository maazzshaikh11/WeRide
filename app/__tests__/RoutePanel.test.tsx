/**
 * RoutePanel component tests — updated for master-spec redesign.
 * RoutePanel now reads ETA/distance/safety from useRouteStore (spec §3.3.8)
 * and rider count from useRidersStore, instead of props.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Platform, Text, Vibration } from 'react-native';
import RoutePanel, { COLLAPSED_HEIGHT } from '../src/components/RoutePanel';
import { EMPTY_STATE_COPY, routePanelMode } from '../src/components/routePanelState';
import { useRouteStore } from '@routing/client/routeStore';
import { useRidePlanStore } from '../src/store/ridePlanStore';
import { VerifiedLocation } from '../src/models/verifiedLocation';
import { RouteResponse } from '../src/models/routeResponse';

// Mock Linking module
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  canOpenURL: jest.fn(() => Promise.resolve(true)),
  openURL: jest.fn(() => Promise.resolve()),
}));

function makeRoute(etaMinutes: number, distanceKm: number, safetyScore: number): RouteResponse {
  return {
    route_id: 'route-1',
    path_points: [[37.77, -122.41]],
    distance_km: distanceKm,
    eta_minutes: etaMinutes,
    safety_score: safetyScore,
    recalculated_at_hlc: '0:0',
  };
}

const FIX: VerifiedLocation = {
  rider_id: 'me',
  group_id: 'g1',
  timestamp_hlc: '1:0',
  lat: 18.52,
  lng: 73.85,
  speed_mps: 0,
  heading_deg: 0,
  spoof_flag: false,
  nis_score: 1,
  accuracy_m: 5,
};

// Track mounted trees so Animated timers (BottomSheet) never outlive a test.
const mounted: renderer.ReactTestRenderer[] = [];
function mount(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(el);
  });
  mounted.push(tree);
  return tree;
}

function getTextContent(node: renderer.ReactTestInstance): string {
  const children = node.props.children;
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) {
    return children
      .map((c: string | number | renderer.ReactTestInstance) =>
        typeof c === 'string' || typeof c === 'number' ? String(c) : '',
      )
      .join('');
  }
  return '';
}

/** The real pressable (findByProps would return the outer wrapper component). */
function pressableByLabel(tree: renderer.ReactTestInstance, label: string) {
  return tree.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPressIn === 'function')[0];
}

/** Expand the sheet through the panel body's toggle. */
function expand(tree: renderer.ReactTestInstance) {
  act(() => {
    pressableByLabel(tree, 'Expand ride details').props.onPress({});
  });
}

function findTextNodes(
  tree: renderer.ReactTestInstance,
  predicate: (text: string) => boolean,
): renderer.ReactTestInstance[] {
  return tree.findAll(
    (node) => node.type === Text && predicate(getTextContent(node)),
  );
}

describe('RoutePanel (master-spec redesign, store-driven)', () => {
  beforeEach(() => {
    useRouteStore.getState().setRoute(makeRoute(15, 10, 0.85));
    useRouteStore.getState().setIsLoading(false);
    useRouteStore.getState().setLastValidLocation(null);
    useRidePlanStore.getState().clearPlan();
  });

  afterEach(() => {
    mounted.splice(0).forEach((t) => act(() => t.unmount()));
    jest.useFakeTimers();
    jest.runAllTimers();
    jest.useRealTimers();
  });

  test('renders collapsed stat row with ETA and distance values', () => {
    const tree = mount(<RoutePanel />).root;

    const etaText = findTextNodes(tree, (t) => t.trim() === '15');
    expect(etaText.length).toBeGreaterThan(0);

    const distanceText = findTextNodes(tree, (t) => t.trim() === '10.0');
    expect(distanceText.length).toBeGreaterThan(0);
  });

  test('no route: shows no "—" placeholder numbers', () => {
    useRouteStore.getState().setRoute(null);
    const tree = mount(<RoutePanel />).root;

    expect(findTextNodes(tree, (t) => t.trim() === '—')).toHaveLength(0);
    expect(findTextNodes(tree, (t) => t.includes('MIN LEFT'))).toHaveLength(0);
  });

  test('empty state: "Waiting for your location" when there is no fix', () => {
    useRouteStore.getState().setRoute(null);
    useRidePlanStore.getState().setDestination({ label: 'Lonavala, Maharashtra', lat: 18.75, lng: 73.4 });
    const tree = mount(<RoutePanel />).root;

    expect(findTextNodes(tree, (t) => t === 'Waiting for your location')).toHaveLength(1);
    expect(findTextNodes(tree, (t) => t === 'Pick a destination')).toHaveLength(0);
  });

  test('empty state: "Pick a destination" when the ride has none', () => {
    useRouteStore.getState().setRoute(null);
    useRouteStore.getState().setLastValidLocation(FIX);
    const tree = mount(<RoutePanel />).root;

    expect(findTextNodes(tree, (t) => t === 'Pick a destination')).toHaveLength(1);
    expect(findTextNodes(tree, (t) => t === 'Waiting for your location')).toHaveLength(0);
  });

  test('populated: shows ETA and distance, no empty-state copy', () => {
    useRouteStore.getState().setLastValidLocation(FIX);
    const tree = mount(<RoutePanel />).root;

    expect(findTextNodes(tree, (t) => t === '15')).toHaveLength(1);
    expect(findTextNodes(tree, (t) => t === '10.0')).toHaveLength(1);
    expect(findTextNodes(tree, (t) => t === 'Waiting for your location')).toHaveLength(0);
    expect(findTextNodes(tree, (t) => t === 'Pick a destination')).toHaveLength(0);
  });

  test('riders row is always shown (this device counts as one live rider)', () => {
    useRouteStore.getState().setRoute(null);
    const tree = mount(<RoutePanel />).root;
    expect(findTextNodes(tree, (t) => t.includes('rider') && t.includes('live'))).not.toHaveLength(0);
  });

  test('shows "Recalculating" state while loading', () => {
    useRouteStore.getState().setIsLoading(true);
    const tree = mount(<RoutePanel />).root;

    const recalcing = findTextNodes(tree, (t) => t.includes('Recalculating'));
    expect(recalcing.length).toBeGreaterThan(0);
  });

  test('expanded view shows safety score, toggle and Google Maps button', () => {
    const tree = mount(<RoutePanel avoidHazards={true} />).root;

    // Expand the panel by pressing the sheet toggle
    expand(tree);

    const safetyText = findTextNodes(tree, (t) => t.includes('Safety score'));
    expect(safetyText.length).toBeGreaterThan(0);

    const gmapsText = findTextNodes(tree, (t) => t.includes('Open in Google Maps'));
    expect(gmapsText.length).toBeGreaterThan(0);

    const toggleText = findTextNodes(tree, (t) =>
      t.includes('Avoiding hazards') || t.includes('Hazards ignored'),
    );
    expect(toggleText.length).toBeGreaterThan(0);
  });

  test('respects avoidHazards prop for toggle text', () => {
    const treeAvoiding = mount(<RoutePanel avoidHazards={true} />).root;
    expand(treeAvoiding);
    const avoidingText = findTextNodes(treeAvoiding, (t) => t.includes('Avoiding hazards'));
    expect(avoidingText.length).toBeGreaterThan(0);

    const treeIgnoring = mount(<RoutePanel avoidHazards={false} />).root;
    expand(treeIgnoring);
    const ignoringText = findTextNodes(treeIgnoring, (t) => t.includes('Hazards ignored'));
    expect(ignoringText.length).toBeGreaterThan(0);
  });

  test('expanded view hands turn-by-turn off to Google Maps (no invented turns)', () => {
    const tree = mount(<RoutePanel />).root;
    expand(tree);
    const tbt = findTextNodes(tree, (t) => t.includes("Turn-by-turn isn't built in"));
    expect(tbt.length).toBeGreaterThan(0);
  });

  test('toggle and Google Maps callbacks are wired', () => {
    const onToggle = jest.fn();
    const onGmaps = jest.fn();
    const tree = mount(
      <RoutePanel avoidHazards={false} onToggleAvoidHazards={onToggle} onOpenInGoogleMaps={onGmaps} />,
    ).root;

    expand(tree);

    const toggle = pressableByLabel(tree, 'Avoiding hazards: off. Tap to enable');
    const gmaps = pressableByLabel(tree, 'Open route in Google Maps');
    expect(toggle).toBeDefined();
    expect(gmaps).toBeDefined();
    act(() => toggle.props.onPress({}));
    act(() => gmaps.props.onPress({}));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onGmaps).toHaveBeenCalledTimes(1);
  });

  test('avoid-hazards toggle gives the select haptic on press', () => {
    (Platform as any).OS = 'android';
    const spy = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => undefined);
    const tree = mount(<RoutePanel avoidHazards={false} onToggleAvoidHazards={jest.fn()} />).root;
    expand(tree);
    spy.mockClear();
    act(() => pressableByLabel(tree, 'Avoiding hazards: off. Tap to enable').props.onPress({}));
    expect(spy).toHaveBeenCalledWith(12);
    (Platform as any).OS = 'ios';
    spy.mockRestore();
  });

  test('toggling avoid-hazards re-renders with the new state without throwing', () => {
    const t = mount(<RoutePanel avoidHazards={false} />);
    expand(t.root);
    act(() => t.update(<RoutePanel avoidHazards />));
    expect(findTextNodes(t.root, (x) => x.includes('Avoiding hazards')).length).toBeGreaterThan(0);
    expect(pressableByLabel(t.root, 'Avoiding hazards: on. Tap to disable')).toBeDefined();
  });

  test('numbers update in place when the route changes (pop animation keeps the row)', () => {
    useRouteStore.getState().setLastValidLocation(FIX);
    const t = mount(<RoutePanel />);
    expect(findTextNodes(t.root, (x) => x === '15')).toHaveLength(1);
    act(() => {
      useRouteStore.getState().setRoute(makeRoute(22, 18.4, 0.8));
    });
    expect(findTextNodes(t.root, (x) => x === '22')).toHaveLength(1);
    expect(findTextNodes(t.root, (x) => x === '18.4')).toHaveLength(1);
    expect(findTextNodes(t.root, (x) => x === '15')).toHaveLength(0);
  });

  test('recalculating with a route keeps the numbers on screen (pulsing, not replaced)', () => {
    useRouteStore.getState().setLastValidLocation(FIX);
    useRouteStore.getState().setIsLoading(true);
    const t = mount(<RoutePanel />);
    expect(findTextNodes(t.root, (x) => x.includes('Recalculating')).length).toBeGreaterThan(0);
    expect(findTextNodes(t.root, (x) => x === '15')).toHaveLength(1);
    expect(findTextNodes(t.root, (x) => x === '10.0')).toHaveLength(1);
    expect(findTextNodes(t.root, (x) => x.includes('MIN LEFT')).length).toBeGreaterThan(0);
  });

  test('recalculating with no route yet shows skeleton blocks, no numbers', () => {
    useRouteStore.getState().setRoute(null);
    useRouteStore.getState().setIsLoading(true);
    const t = mount(<RoutePanel />);
    expect(findTextNodes(t.root, (x) => x.includes('Recalculating')).length).toBeGreaterThan(0);
    const skeletons = t.root.findAll((n) => n.props.accessibilityElementsHidden === true && (n.type as unknown) === 'View');
    expect(skeletons.length).toBeGreaterThanOrEqual(2);
  });

  test('the handle toggles the sheet', () => {
    const t = mount(<RoutePanel />);
    expect(pressableByLabel(t.root, 'Expand sheet')).toBeDefined();
    act(() => pressableByLabel(t.root, 'Expand sheet').props.onPress({}));
    expect(pressableByLabel(t.root, 'Collapse sheet')).toBeDefined();
    expect(findTextNodes(t.root, (x) => x.includes('Safety score')).length).toBeGreaterThan(0);
  });
});

describe('routePanelMode (pure)', () => {
  const base = { hasRoute: false, isLoading: false, hasFix: true, hasDestination: true };

  test('loading wins over everything', () => {
    expect(routePanelMode({ ...base, hasRoute: true, isLoading: true })).toBe('loading');
  });

  test('a route means ready', () => {
    expect(routePanelMode({ ...base, hasRoute: true })).toBe('ready');
  });

  test('no fix -> no-fix; fix but no destination -> no-destination', () => {
    expect(routePanelMode({ ...base, hasFix: false })).toBe('no-fix');
    expect(routePanelMode({ ...base, hasDestination: false })).toBe('no-destination');
  });

  test('fix + destination but no route yet -> pending', () => {
    expect(routePanelMode(base)).toBe('pending');
  });

  test('empty-state copy is the agreed wording', () => {
    expect(EMPTY_STATE_COPY['no-fix'].title).toBe('Waiting for your location');
    expect(EMPTY_STATE_COPY['no-destination'].title).toBe('Pick a destination');
  });

  test('collapsed height is a positive whole number (camera padding relies on it)', () => {
    expect(Number.isInteger(COLLAPSED_HEIGHT)).toBe(true);
    expect(COLLAPSED_HEIGHT).toBeGreaterThan(0);
  });
});
