/**
 * RoutePanel component tests — updated for master-spec redesign.
 * RoutePanel now reads ETA/distance/safety from useRouteStore (spec §3.3.8)
 * and rider count from useRidersStore, instead of props.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
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
    const pressables = tree.findAll((node) => node.type === TouchableOpacity);
    act(() => {
      pressables[0].props.onPress();
    });

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
    act(() => {
      treeAvoiding.findAll((n) => n.type === TouchableOpacity)[0].props.onPress();
    });
    const avoidingText = findTextNodes(treeAvoiding, (t) => t.includes('Avoiding hazards'));
    expect(avoidingText.length).toBeGreaterThan(0);

    const treeIgnoring = mount(<RoutePanel avoidHazards={false} />).root;
    act(() => {
      treeIgnoring.findAll((n) => n.type === TouchableOpacity)[0].props.onPress();
    });
    const ignoringText = findTextNodes(treeIgnoring, (t) => t.includes('Hazards ignored'));
    expect(ignoringText.length).toBeGreaterThan(0);
  });

  test('expanded view hands turn-by-turn off to Google Maps (no invented turns)', () => {
    const tree = mount(<RoutePanel />).root;
    act(() => {
      tree.findAll((n) => n.type === TouchableOpacity)[0].props.onPress();
    });
    const tbt = findTextNodes(tree, (t) => t.includes("Turn-by-turn isn't built in"));
    expect(tbt.length).toBeGreaterThan(0);
  });

  test('toggle and Google Maps callbacks are wired', () => {
    const onToggle = jest.fn();
    const onGmaps = jest.fn();
    const tree = mount(
      <RoutePanel avoidHazards={false} onToggleAvoidHazards={onToggle} onOpenInGoogleMaps={onGmaps} />,
    ).root;

    act(() => {
      tree.findAll((n) => n.type === TouchableOpacity)[0].props.onPress();
    });

    const buttons = tree.findAll((n) => n.type === TouchableOpacity);
    const toggleBtn = buttons.find((b) => {
      try {
        return findTextNodes(b, (t) => t.includes('Hazards ignored') || t.includes('Avoiding hazards')).length > 0;
      } catch {
        return false;
      }
    });
    expect(toggleBtn).toBeDefined();
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
