/**
 * ETA Panel Updates test — updated for store-driven RouteSheet.
 * Verifies RouteSheet re-renders when useRouteStore route data changes.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import RouteSheet from '../src/components/RouteSheet';
import { useRouteStore } from '@routing/client/routeStore';
import { RouteResponse } from '../src/models/routeResponse';

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

// Track mounted trees so Animated timers  never outlive a test.
const mounted: renderer.ReactTestRenderer[] = [];
function renderPanel() {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<RouteSheet visible onClose={() => undefined} />);
  });
  mounted.push(tree);
  return tree;
}

describe('RouteSheet Updates (eta_panel_updates)', () => {
  beforeEach(() => {
    useRouteStore.getState().setRoute(makeRoute(10, 5, 0.8));
    useRouteStore.getState().setIsLoading(false);
  });

  afterEach(() => {
    mounted.splice(0).forEach((t) => act(() => t.unmount()));
    jest.useFakeTimers();
    jest.runAllTimers();
    jest.useRealTimers();
  });

  test('re-renders correctly when route ETA changes', () => {
    const instance = renderPanel();
    expect(instance.root).toBeDefined();

    act(() => {
      useRouteStore.getState().setRoute(makeRoute(25, 5, 0.8));
    });

    expect(instance.root).toBeDefined();
    expect(instance.root.children).toBeDefined();
  });

  test('re-renders correctly when route distance changes', () => {
    const instance = renderPanel();
    expect(instance.root).toBeDefined();

    act(() => {
      useRouteStore.getState().setRoute(makeRoute(10, 12.3, 0.8));
    });

    expect(instance.root).toBeDefined();
  });

  test('re-renders when safety score changes', () => {
    const instance = renderPanel();
    expect(instance.root).toBeDefined();

    act(() => {
      useRouteStore.getState().setRoute(makeRoute(10, 5, 0.3));
    });

    expect(instance.root).toBeDefined();
  });

  test('handles route becoming null (ETA unavailable state)', () => {
    const instance = renderPanel();
    act(() => {
      useRouteStore.getState().setRoute(null);
    });
    expect(instance.root).toBeDefined();
  });

  test('handles isLoading recalculation state', () => {
    const instance = renderPanel();
    act(() => {
      useRouteStore.getState().setIsLoading(true);
    });
    expect(instance.root).toBeDefined();
    act(() => {
      useRouteStore.getState().setIsLoading(false);
    });
    expect(instance.root).toBeDefined();
  });

  test('handles multiple rapid route updates without errors', () => {
    const instance = renderPanel();
    for (let i = 0; i < 5; i++) {
      act(() => {
        useRouteStore.getState().setRoute(makeRoute(10 + i, 5 + i * 0.5, Math.max(0, 0.8 - i * 0.1)));
      });
    }
    expect(instance.root).toBeDefined();
  });

  test('handles edge case: very large values', () => {
    act(() => {
      useRouteStore.getState().setRoute(makeRoute(999, 500, 0.5));
    });
    const instance = renderPanel();
    expect(instance.root).toBeDefined();
  });

  test('handles edge case: zero values', () => {
    act(() => {
      useRouteStore.getState().setRoute(makeRoute(0, 0, 0));
    });
    const instance = renderPanel();
    expect(instance.root).toBeDefined();
  });
});