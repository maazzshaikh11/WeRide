/** MemberSheet — one rider: name, bike, "Verified GPS" (only with logged rides), role, and public lifetime stats. */
import React from 'react';
import { Text, View } from 'react-native';
import type { CrewRole, UserProfile } from '../models/domain';
import { colorForUid } from '../screens/garage/crew/CrewAvatars';
import IconPill from '../screens/garage/crew/CrewIconPill';
import { riderInitials } from '../store/profileStore';
import { usePrefsStore } from '../store/prefsStore';
import { useTheme } from '../theme/ThemeProvider';
import { Avatar, KV, Pill, Sheet } from '../ui';
import { toUnitDistance } from '../utils/units';
import { togetherPct } from '../utils/crewRides';

export interface MemberSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Public profile (null while it loads or when the rider has none). */
  profile: UserProfile | null | undefined;
  uid?: string;
  role?: CrewRole;
  isMe?: boolean;
}

export default function MemberSheet({ visible, onClose, profile, uid, role, isMe }: MemberSheetProps) {
  const { type } = useTheme();
  const units = usePrefsStore((s) => s.prefs.units);
  const stats = profile?.stats ?? { km: 0, rides: 0, together_sum: 0 };
  const together = togetherPct(stats);
  const id = uid ?? profile?.uid ?? '';
  const name = profile?.name ?? (id ? `Rider ${id.slice(-4)}` : 'Rider');
  const byId = profile ? { [id]: profile } : {};
  return (
    <Sheet visible={visible} onClose={onClose} testID="sheet-Member" accessibilityLabel={`${name}, crew member`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Avatar initials={riderInitials(byId, id)} color={colorForUid(id)} size={76} me={isMe} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={type.h2} numberOfLines={2} accessibilityRole="header">{isMe ? `${name} (you)` : name}</Text>
          {profile?.bike ? <Text style={[type.sm, { marginTop: 8 }]} numberOfLines={1}>{profile.bike}</Text> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
            {stats.rides > 0 ? <IconPill icon="shield" label="Verified GPS" /> : null}
            {role ? <Pill tone="ink" label={role === 'lead' ? 'Lead' : 'Sweep'} /> : null}
          </View>
        </View>
      </View>
      <KV
        style={{ marginTop: 24 }}
        items={[
          { value: Math.round(toUnitDistance(stats.km, units)).toLocaleString('en-US'), label: units === 'mi' ? 'mi logged' : 'km logged' },
          { value: String(stats.rides), label: 'rides' },
          { value: together == null ? '--' : `${together}%`, label: 'stays together' },
        ]}
      />
    </Sheet>
  );
}
