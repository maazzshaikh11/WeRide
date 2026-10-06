/**
 * "Crew pulse": the latest rsvp / roll-call / presence updates of a ride as short sentences, newest first.
 * The rider's own updates are left out (it is a feed about the crew). Names come from real profiles.
 */
import type { PresenceDoc, RollCallDoc, RsvpDoc } from '../models/domain';

export interface PulseItem {
  key: string;
  uid: string;
  text: string;
  at: number;
}

const PRESENCE_TEXT: Record<PresenceDoc['state'], string> = {
  riding: 'is riding',
  stopped: 'has stopped',
  fuel: 'is fuelling up',
  ready: 'is ready to roll',
  arrived: 'has arrived',
};
const RSVP_TEXT: Record<RsvpDoc['status'], string> = {
  going: 'confirmed',
  maybe: 'might come',
  no: 'can’t make it',
};

export function buildPulse(
  docs: { rsvp: RsvpDoc[]; rollCall: RollCallDoc[]; presence: PresenceDoc[] },
  nameOf: (uid: string) => string,
  myUid: string | null,
  limit = 5,
): PulseItem[] {
  const items: PulseItem[] = [];
  for (const d of docs.rsvp) if (d.uid !== myUid && d.updated_ms > 0) items.push({ key: `rsvp-${d.uid}`, uid: d.uid, text: `${nameOf(d.uid)} ${RSVP_TEXT[d.status]}`, at: d.updated_ms });
  for (const d of docs.rollCall) {
    if (d.uid === myUid || d.updated_ms <= 0) continue;
    items.push({ key: `roll-${d.uid}`, uid: d.uid, text: `${nameOf(d.uid)} ${d.state === 'ready' ? 'is ready' : 'is not ready yet'}`, at: d.updated_ms });
  }
  for (const d of docs.presence) if (d.uid !== myUid && d.updated_ms > 0) items.push({ key: `presence-${d.uid}`, uid: d.uid, text: `${nameOf(d.uid)} ${PRESENCE_TEXT[d.state]}`, at: d.updated_ms });
  return items.sort((a, b) => b.at - a.at).slice(0, limit);
}
