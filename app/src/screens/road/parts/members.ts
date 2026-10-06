/**
 * Who is in a ride and how to show them: order (you first), names, initials, avatar colours and Lead / Sweep roles.
 * Everything comes from the ride doc, the crew's roles and the cached public profiles — never invented.
 */
import type { Crew, Ride, UserProfile } from '../../../models/domain';
import { avatarColor } from '../../../theme/palettes';
import { riderInitials, riderName } from '../../../store/profileStore';

export interface Member {
  uid: string;
  name: string;
  initials: string;
  color: string;
  me: boolean;
  /** 'Lead' | 'Sweep' | undefined */
  role?: string;
}

/** The ride's lead: the crew's `lead` role if a member has it, else whoever created the ride. */
export function leadUid(ride: Pick<Ride, 'created_by' | 'member_ids'> | null, crew: Pick<Crew, 'roles'> | null): string | null {
  if (!ride) return null;
  const fromCrew = crew ? ride.member_ids.find((id) => crew.roles?.[id] === 'lead') : undefined;
  return fromCrew ?? ride.created_by ?? null;
}

export function buildMembers(
  ride: Pick<Ride, 'created_by' | 'member_ids'> | null,
  crew: Pick<Crew, 'roles'> | null,
  byId: Record<string, UserProfile>,
  myUid: string | null,
): Member[] {
  if (!ride) return [];
  const ids = [...new Set(ride.member_ids)];
  const ordered = myUid && ids.includes(myUid) ? [myUid, ...ids.filter((i) => i !== myUid)] : ids;
  const lead = leadUid(ride, crew);
  return ordered.map((uid) => {
    const sweep = crew?.roles?.[uid] === 'sweep';
    return {
      uid,
      name: riderName(byId, uid, myUid),
      initials: riderInitials(byId, uid),
      color: avatarColor(ids.indexOf(uid)),
      me: uid === myUid,
      role: uid === lead ? 'Lead' : sweep ? 'Sweep' : undefined,
    };
  });
}

/** First name in capitals for the roll-out overlay ("MEERA"), or null if unknown. */
export function leadDisplayName(lead: string | null, byId: Record<string, UserProfile>, myUid: string | null): string | null {
  if (!lead) return null;
  const n = lead === myUid ? byId[lead]?.name ?? 'You' : byId[lead]?.name;
  return n ? n.trim().split(/\s+/)[0].toUpperCase() : null;
}
