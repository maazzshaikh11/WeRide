/** Live rsvp / roll-call / presence docs of one ride (empty while loading or when not a member). */
import { useEffect, useState } from 'react';
import type { PresenceDoc, RollCallDoc, RsvpDoc } from '../../../models/domain';
import { subscribePresence, subscribeRollCall, subscribeRsvp } from '../../../services/rideService';

export interface RideDocs {
  rsvp: RsvpDoc[];
  rollCall: RollCallDoc[];
  presence: PresenceDoc[];
}
const EMPTY: RideDocs = { rsvp: [], rollCall: [], presence: [] };

export function useRideDocs(rideId: string | null): RideDocs {
  const [docs, setDocs] = useState<RideDocs>(EMPTY);
  useEffect(() => {
    setDocs(EMPTY);
    if (!rideId) return undefined;
    const noop = () => undefined;
    const stops = [
      subscribeRsvp(rideId, (rsvp) => setDocs((d) => ({ ...d, rsvp })), noop),
      subscribeRollCall(rideId, (rollCall) => setDocs((d) => ({ ...d, rollCall })), noop),
      subscribePresence(rideId, (presence) => setDocs((d) => ({ ...d, presence })), noop),
    ];
    return () => stops.forEach((s) => s());
  }, [rideId]);
  return docs;
}
