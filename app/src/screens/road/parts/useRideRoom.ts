/**
 * Live data shared by the Road screens that look at the whole crew: the ride, its roll call, presence docs, the
 * members' profiles and the crew roles. One hook, cleaned up on unmount.
 */
import { useEffect, useMemo, useState } from 'react';
import type { PresenceDoc, Ride, RollCallDoc } from '../../../models/domain';
import { subscribePresence, subscribeRide, subscribeRollCall } from '../../../services/rideService';
import { useCrewsStore } from '../../../store/crewsStore';
import { useProfileStore } from '../../../store/profileStore';
import { useRidesStore } from '../../../store/ridesStore';
import { Member, buildMembers, leadUid } from './members';

export interface RideRoom {
  ride: Ride | null;
  members: Member[];
  lead: string | null;
  rollCall: RollCallDoc[];
  presence: PresenceDoc[];
}

export function useRideRoom(groupId: string, uid: string | null): RideRoom {
  const stored = useRidesStore((s) => s.rides.find((r) => r.id === groupId) ?? null);
  const [live, setLive] = useState<Ride | null>(null);
  const [rollCall, setRollCall] = useState<RollCallDoc[]>([]);
  const [presence, setPresence] = useState<PresenceDoc[]>([]);
  const crews = useCrewsStore((s) => s.crews);
  const byId = useProfileStore((s) => s.byId);
  const ride = live ?? stored;

  useEffect(() => {
    const offs = [
      subscribeRide(groupId, (r) => r && setLive(r)),
      subscribeRollCall(groupId, setRollCall),
      subscribePresence(groupId, setPresence),
    ];
    return () => offs.forEach((off) => off());
  }, [groupId]);

  useEffect(() => {
    if (ride?.member_ids?.length) useProfileStore.getState().ensure(ride.member_ids);
  }, [ride?.member_ids]);

  const crew = useMemo(() => crews.find((c) => c.id === ride?.crew_id) ?? null, [crews, ride?.crew_id]);
  const members = useMemo(() => buildMembers(ride, crew, byId, uid), [ride, crew, byId, uid]);
  return { ride, members, lead: leadUid(ride, crew), rollCall, presence };
}
