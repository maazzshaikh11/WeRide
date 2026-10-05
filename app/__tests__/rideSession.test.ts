jest.mock('../src/services/socketService', () => ({
  getLocationSocket: () => ({ on: jest.fn(), off: jest.fn(), emit: jest.fn(), connected: false }),
}));

import { resetRideSession } from '../src/store/rideSession';
import { useRouteStore } from '@routing/client/routeStore';
import { useRidePlanStore } from '../src/store/ridePlanStore';
import { useStopsStore } from '../src/store/stopsStore';
import { useRidersStore } from '../src/store/ridersStore';

describe('resetRideSession', () => {
  it('clears everything the previous ride left behind', () => {
    useRouteStore.setState({
      route: {
        route_id: 'old',
        path_points: [[18.5, 73.8], [18.7, 73.4]],
        distance_km: 60,
        eta_minutes: 70,
        safety_score: 0.8,
        recalculated_at_hlc: '1:0',
      },
      avoidHazardTypes: ['pothole'],
      isLoading: true,
    });
    useRidePlanStore.getState().setDestination({ label: 'Lonavala', lat: 18.75, lng: 73.4 });
    useRidePlanStore.getState().setStart({ label: 'Pune', lat: 18.52, lng: 73.85 });
    useRidePlanStore.getState().addStop({ id: 's1', label: 'Chai', lat: 18.6, lng: 73.6, icon: '☕' });
    useStopsStore.getState().syncFromPlan();
    useStopsStore.getState().markCurrentDone();
    useRidersStore.getState().upsertRider({
      rider_id: 'r9', group_id: 'g', timestamp_hlc: `${Date.now()}:0`,
      lat: 18.5, lng: 73.8, speed_mps: 1, heading_deg: 0, spoof_flag: false, nis_score: 0, accuracy_m: 5,
    });
    expect(useRidersStore.getState().riders.size).toBe(1);

    resetRideSession();

    const route = useRouteStore.getState();
    expect(route.route).toBeNull();
    expect(route.avoidHazardTypes).toEqual([]);
    expect(route.isLoading).toBe(false);
    expect(route.lastValidLocation).toBeNull();
    const plan = useRidePlanStore.getState();
    expect(plan.destination).toBeNull();
    expect(plan.start).toBeNull();
    expect(plan.stops).toEqual([]);
    expect(useStopsStore.getState().stops.map((s) => s.status)).toEqual(['current']);
    expect(useRidersStore.getState().riders.size).toBe(0);
  });
});
