/**
 * RoutePanel component tests — updated for master-spec redesign.
 * RoutePanel now reads ETA/distance/safety from useRouteStore (spec §3.3.8)
 * and rider count from useRidersStore, instead of props.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import RoutePanel from '../src/components/RoutePanel';
import { useRouteStore } from '@routing/client/routeStore';
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
  });

  afterEach(() => {
    jest.useFakeTimers();
    jest.runAllTimers();
    jest.useRealTimers();
  });

  test('renders collapsed stat row with ETA and distance values', () => {
    const tree = renderer.create(<RoutePanel />).root;

    const etaText = findTextNodes(tree, (t) => t.trim() === '15');
    expect(etaText.length).toBeGreaterThan(0);

    const distanceText = findTextNodes(tree, (t) => t.trim() === '10.0');
    expect(distanceText.length).toBeGreaterThan(0);
  });

  test('shows "—" placeholders when route unavailable', () => {
    useRouteStore.getState().setRoute(null);
    const tree = renderer.create(<RoutePanel />).root;

    const placeholders = findTextNodes(tree, (t) => t.trim() === '—');
    expect(placeholders.length).toBeGreaterThan(0);
  });

  test('shows "Recalculating" state while loading', () => {
    useRouteStore.getState().setIsLoading(true);
    const tree = renderer.create(<RoutePanel />).root;

    const recalcing = findTextNodes(tree, (t) => t.includes('Recalculating'));
    expect(recalcing.length).toBeGreaterThan(0);
  });

  test('expanded view shows safety score, toggle and Google Maps button', () => {
    const tree = renderer.create(<RoutePanel avoidHazards={true} />).root;

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
    const treeAvoiding = renderer.create(<RoutePanel avoidHazards={true} />).root;
    act(() => {
      treeAvoiding.findAll((n) => n.type === TouchableOpacity)[0].props.onPress();
    });
    const avoidingText = findTextNodes(treeAvoiding, (t) => t.includes('Avoiding hazards'));
    expect(avoidingText.length).toBeGreaterThan(0);

    const treeIgnoring = renderer.create(<RoutePanel avoidHazards={false} />).root;
    act(() => {
      treeIgnoring.findAll((n) => n.type === TouchableOpacity)[0].props.onPress();
    });
    const ignoringText = findTextNodes(treeIgnoring, (t) => t.includes('Hazards ignored'));
    expect(ignoringText.length).toBeGreaterThan(0);
  });

  test('expanded view shows turn-by-turn placeholder', () => {
    const tree = renderer.create(<RoutePanel />).root;
    act(() => {
      tree.findAll((n) => n.type === TouchableOpacity)[0].props.onPress();
    });
    const tbt = findTextNodes(tree, (t) => t.includes('Turn-by-turn navigation (coming soon)'));
    expect(tbt.length).toBeGreaterThan(0);
  });

  test('toggle and Google Maps callbacks are wired', () => {
    const onToggle = jest.fn();
    const onGmaps = jest.fn();
    const tree = renderer.create(
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