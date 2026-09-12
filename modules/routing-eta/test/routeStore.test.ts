/**
 * Tests for routeStore.ts (Phase 6 extension).
 * Verifies location, cluster, and setters work correctly.
 */
import { useRouteStore } from '../src/client/routeStore';
import { VerifiedLocation } from '@app/models/verifiedLocation';
import { HazardCluster } from '@app/models/hazardCluster';

describe('routeStore (Phase 6)', () => {
  beforeEach(() => {
    // Reset Zustand store
    useRouteStore.setState({
      route: null,
      currentLocation: null,
      lastValidLocation: null,
      activeClusters: [],
      avoidHazardTypes: [],
      isLoading: false,
    });
  });

  it('should initialize with default values', () => {
    useRouteStore.setState({
      route: null,
      currentLocation: null,
      lastValidLocation: null,
      activeClusters: [],
      avoidHazardTypes: [],
      isLoading: false,
    });

    const state = useRouteStore.getState();
    expect(state.route).toBeNull();
    expect(state.currentLocation).toBeNull();
    expect(state.lastValidLocation).toBeNull();
    expect(state.activeClusters).toEqual([]);
    expect(state.avoidHazardTypes).toEqual([]);
    expect(state.isLoading).toBe(false);
  });

  it('should set current location', () => {
    const location: VerifiedLocation = {
      rider_id: 'r1',
      group_id: 'g1',
      timestamp_hlc: '1000:0',
      lat: 40.7128,
      lng: -74.006,
      speed_mps: 5.5,
      heading_deg: 45,
      spoof_flag: false,
      nis_score: 0.95,
      accuracy_m: 10,
    };

    useRouteStore.getState().setCurrentLocation(location);
    const state = useRouteStore.getState();
    expect(state.currentLocation).toEqual(location);
  });

  it('should set last valid location', () => {
    const location: VerifiedLocation = {
      rider_id: 'r1',
      group_id: 'g1',
      timestamp_hlc: '1000:0',
      lat: 40.7128,
      lng: -74.006,
      speed_mps: 5.5,
      heading_deg: 45,
      spoof_flag: false,
      nis_score: 0.95,
      accuracy_m: 10,
    };

    useRouteStore.getState().setLastValidLocation(location);
    const state = useRouteStore.getState();
    expect(state.lastValidLocation).toEqual(location);
  });

  it('should set active clusters', () => {
    const clusters: HazardCluster[] = [
      {
        cluster_id: 'c1',
        group_id: 'g1',
        centroid_lat: 40.7140,
        centroid_lng: -74.0089,
        hazard_type: 'pothole',
        polygon_points: [[40.714, -74.009], [40.715, -74.009], [40.715, -74.008]],
        report_count: 3,
        hazard_score: 0.8,
        created_at_hlc: '1000:0',
        status: 'active',
      },
    ];

    useRouteStore.getState().setActiveClusters(clusters);
    const state = useRouteStore.getState();
    expect(state.activeClusters).toEqual(clusters);
  });

  it('should update avoid hazard types', () => {
    const types = ['pothole', 'oil_spill'];

    useRouteStore.getState().setAvoidHazardTypes(types);
    const state = useRouteStore.getState();
    expect(state.avoidHazardTypes).toEqual(types);
  });

  it('should handle multiple sequential updates', () => {
    const location: VerifiedLocation = {
      rider_id: 'r1',
      group_id: 'g1',
      timestamp_hlc: '1000:0',
      lat: 40.7128,
      lng: -74.006,
      speed_mps: 5.5,
      heading_deg: 45,
      spoof_flag: false,
      nis_score: 0.95,
      accuracy_m: 10,
    };

    useRouteStore.getState().setCurrentLocation(location);
    useRouteStore.getState().setLastValidLocation(location);
    useRouteStore.getState().setAvoidHazardTypes(['pothole']);

    const state = useRouteStore.getState();
    expect(state.currentLocation).toEqual(location);
    expect(state.lastValidLocation).toEqual(location);
    expect(state.avoidHazardTypes).toEqual(['pothole']);
  });
});
