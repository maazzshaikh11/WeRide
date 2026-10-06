/**
 * RideLifecycleBridge — follows the ride the rider is in, from the root (mounted once in App.tsx):
 *  - it turns `live` (the lead rolled out) and the rider is not already on Live / Stop / Arrive -> the roll-out countdown
 *    overlay, which then opens Live;
 *  - it turns `finished` while the rider is on a Road screen -> their own recording is finished and saved, then the Recap.
 * Also retries ride logs that could not be saved at the end of a ride. Decisions are pure (`rideLifecycle.ts`).
 */
import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { useCrewsStore } from '../store/crewsStore';
import { useOverlayStore } from '../store/overlayStore';
import { useProfileStore } from '../store/profileStore';
import { useRidesStore } from '../store/ridesStore';
import { resetRideSession } from '../store/rideSession';
import { finishOwnRide, isEndingOwnRide } from '../services/rideFlow';
import { flushPending } from '../services/pendingLogs';
import { leadDisplayName, leadUid } from '../screens/road/parts/members';
import { warn } from '../utils/log';
import { navigationRef } from './navigationRef';
import { StatusMemory, decideLifecycle, leaveRoadToRecap } from './rideLifecycle';

export default function RideLifecycleBridge() {
  const rides = useRidesStore((s) => s.rides);
  const uid = useAppStore((s) => s.userId);
  const groupId = useAppStore((s) => s.groupId);
  const memory = useRef<StatusMemory>({});

  // Logs that could not be saved when a ride ended: try again whenever the rider is signed in (app launch).
  useEffect(() => {
    if (uid) flushPending(uid).catch((e) => warn('[Bridge] pending log retry failed:', e));
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const ready = navigationRef.isReady();
    const current = ready ? navigationRef.getCurrentRoute() : undefined;
    const params = current?.params as { groupId?: string } | undefined;
    const { action, memory: next } = decideLifecycle({
      rides,
      uid,
      groupId,
      routeName: current?.name ?? null,
      routeGroupId: params?.groupId ?? null,
      memory: memory.current,
      endingOwn: isEndingOwnRide,
      rolloutShowing: useOverlayStore.getState().current?.kind === 'rollout',
    });
    memory.current = next;
    if (!action) return;
    const ride = rides.find((r) => r.id === action.rideId);
    if (!ride) return;

    if (action.type === 'rollout') {
      if (useAppStore.getState().groupId !== ride.id) {
        resetRideSession();
        useAppStore.getState().setGroupId(ride.id);
      }
      const crew = useCrewsStore.getState().crews.find((c) => c.id === ride.crew_id) ?? null;
      const lead = leadUid(ride, crew);
      const show = () =>
        useOverlayStore.getState().show({
          kind: 'rollout',
          groupId: ride.id,
          leadName: leadDisplayName(lead, useProfileStore.getState().byId, uid) ?? undefined,
        });
      if (lead && !useProfileStore.getState().byId[lead]) {
        // a beat to learn the lead's name, never longer: the countdown must not wait on the network
        Promise.race([useProfileStore.getState().ensure([lead]), new Promise((r) => setTimeout(r, 600))]).then(show, show);
      } else {
        show();
      }
    } else {
      // someone else ended the ride: finish and save OUR recording too, then show the recap
      finishOwnRide(uid, ride.id, ride.member_ids.length)
        .catch((e) => warn('[Bridge] could not finish own recording:', e))
        .then(() => leaveRoadToRecap(ride.id));
    }
  }, [rides, uid, groupId]);

  return null;
}
