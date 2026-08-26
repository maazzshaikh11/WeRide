/**
 * Route store tests (Phase 5 UI).
 */

import { useRouteStore } from '../src/client/routeStore';
import { RouteResponse } from '@app/models/routeResponse';

describe('Route Store', () => {
  beforeEach(() => {
    // Reset store before each test
    useRouteStore.setState({
      route: null,
      avoidHazardTypes: [],
      isLoading: false,
    });
  });

  test('initializes with null route', () => {
    const state = useRouteStore.getState();
    expect(state.route).toBeNull();
    expect(state.avoidHazardTypes).toEqual([]);
    expect(state.isLoading).toBe(false);
  });

  test('setRoute updates state', () => {
    const mockRoute: RouteResponse = {
      route_id: 'r1',
      path_points: [[0, 0], [1, 1]],
      distance_km: 10,
      eta_minutes: 15,
      safety_score: 0.85,
      recalculated_at_hlc: '1:0',
    };

    useRouteStore.getState().setRoute(mockRoute);
    expect(useRouteStore.getState().route).toBe(mockRoute);
  });

  test('setAvoidHazardTypes updates state', () => {
    useRouteStore.getState().setAvoidHazardTypes(['pothole', 'accident']);
    expect(useRouteStore.getState().avoidHazardTypes).toEqual(['pothole', 'accident']);
  });

  test('setAvoidHazardTypes can clear list', () => {
    useRouteStore.getState().setAvoidHazardTypes(['pothole']);
    expect(useRouteStore.getState().avoidHazardTypes).toEqual(['pothole']);

    useRouteStore.getState().setAvoidHazardTypes([]);
    expect(useRouteStore.getState().avoidHazardTypes).toEqual([]);
  });

  test('setIsLoading updates state', () => {
    useRouteStore.getState().setIsLoading(true);
    expect(useRouteStore.getState().isLoading).toBe(true);

    useRouteStore.getState().setIsLoading(false);
    expect(useRouteStore.getState().isLoading).toBe(false);
  });

  test('subscribers receive updates', (done) => {
    let updateCount = 0;
    const unsubscribe = useRouteStore.subscribe(() => {
      updateCount++;
    });

    useRouteStore.getState().setRoute({
      route_id: 'r1',
      path_points: [[0, 0]],
      distance_km: 5,
      eta_minutes: 10,
      safety_score: 0.9,
      recalculated_at_hlc: '1:0',
    } as any);

    setTimeout(() => {
      expect(updateCount).toBeGreaterThan(0);
      unsubscribe();
      done();
    }, 10);
  });
});
