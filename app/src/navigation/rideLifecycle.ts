/**
 * The ride lifecycle as the phone sees it (docs/DEMO_PARITY_SPEC.md §2): `planned → meetup → live → finished`, one writer per
 * transition, everyone else reacts to the snapshot. `decideLifecycle` is the pure decision the root bridge acts on; it
 * remembers the last status it saw per ride so a snapshot replay (listener re-attach, app start on a ride that is already
 * live) never re-navigates.
 */
import type { Ride, RideStatus } from '../models/domain';
import { useAppStore } from '../store/appStore';
import { resetRideSession } from '../store/rideSession';
import { resetRideFlow } from '../services/rideFlow';
import { navigationRef } from './navigationRef';

export const ROAD_ROUTES = ['Live', 'Stop', 'Arrive'] as const;
export type StatusMemory = Record<string, RideStatus>;

export type LifecycleAction = { type: 'rollout'; rideId: string } | { type: 'recap'; rideId: string } | null;

export interface LifecycleInput {
  rides: readonly Ride[];
  uid: string | null;
  /** The app's active ride (appStore.groupId). */
  groupId: string | null;
  /** The screen the rider is on right now. */
  routeName: string | null;
  /** That screen's `groupId` param, if it has one. */
  routeGroupId: string | null;
  memory: StatusMemory;
  /** This device is itself ending that ride (Arrive's end-ride hold), so it navigates on its own. */
  endingOwn?: (rideId: string) => boolean;
  /** A roll-out countdown is already on screen. */
  rolloutShowing?: boolean;
}

/** The ride the rider is in: the app's active ride, else their most recent ride that is in roll call or live. */
export function primaryRide(rides: readonly Ride[], uid: string | null, groupId: string | null): Ride | null {
  const mine = rides.filter((r) => uid != null && r.member_ids?.includes(uid));
  const active = groupId ? mine.find((r) => r.id === groupId) : undefined;
  if (active) return active;
  const open = mine.filter((r) => r.status === 'meetup' || r.status === 'live');
  open.sort((a, b) => (b.started_ms ?? b.start_time_ms ?? b.created_ms ?? 0) - (a.started_ms ?? a.start_time_ms ?? a.created_ms ?? 0));
  return open[0] ?? null;
}

export function decideLifecycle(input: LifecycleInput): { action: LifecycleAction; memory: StatusMemory } {
  const { rides, uid, groupId, routeName, routeGroupId, endingOwn, rolloutShowing } = input;
  const memory: StatusMemory = { ...input.memory };
  const prevOf = (id: string) => input.memory[id];
  const primary = primaryRide(rides, uid, groupId);
  let action: LifecycleAction = null;

  if (primary) {
    const prev = prevOf(primary.id);
    const onRoad = routeName != null && (ROAD_ROUTES as readonly string[]).includes(routeName);
    if (primary.status === 'live' && prev !== 'live') {
      // first sight of a ride that is ALREADY live is a replay, unless the rider is sitting in its roll call
      const inRollCall = routeName === 'Meetup' && routeGroupId === primary.id;
      if ((prev !== undefined || inRollCall) && !onRoad && !rolloutShowing) action = { type: 'rollout', rideId: primary.id };
    } else if (primary.status === 'finished' && prev !== undefined && prev !== 'finished') {
      if (onRoad && !endingOwn?.(primary.id)) action = { type: 'recap', rideId: primary.id };
    }
  }
  for (const r of rides) memory[r.id] = r.status;
  return { action, memory };
}

/** Back to the Garage with the Recap on top (one atomic reset, so Back from Recap lands on the Garage), and the session cleared. */
export function leaveRoadToRecap(rideId: string): void {
  if (navigationRef.isReady()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the generic overload is awkward to satisfy here
    (navigationRef as any).reset({ index: 1, routes: [{ name: 'GarageTabs' }, { name: 'Recap', params: { rideId } }] });
  }
  useAppStore.getState().setGroupId(null);
  resetRideSession();
  resetRideFlow();
}
