/**
 * Ride-session reset.
 *
 * Route, plan, stops and rider positions belong to ONE ride. They live in
 * module-level stores that outlive screens, so without an explicit reset the
 * next ride inherits the previous one: its route line and destination (when the
 * new group has no saved plan), a pre-filled Create Ride form, stale stop
 * progress and ghost riders. Call this before starting or opening any ride.
 */
import { useRouteStore } from '@routing/client/routeStore';
import { useRidePlanStore } from './ridePlanStore';
import { useStopsStore } from './stopsStore';
import { useRidersStore } from './ridersStore';

export function resetRideSession(): void {
  useRouteStore.setState({
    route: null,
    avoidHazardTypes: [],
    isLoading: false,
    currentLocation: null,
    lastValidLocation: null,
    activeClusters: [],
  });
  useRidePlanStore.getState().clearPlan();
  useStopsStore.getState().reset();
  useRidersStore.getState().clear();
}
