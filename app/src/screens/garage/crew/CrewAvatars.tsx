/** Overlapping member avatars for the Crews screens (demo `.avs`): profiles come from profileStore, fetched on demand. */
import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { avatarColor } from '../../../theme/palettes';
import { useTheme } from '../../../theme/ThemeProvider';
import { Avatar } from '../../../ui';
import { useProfileStore, riderInitials } from '../../../store/profileStore';

/** A stable avatar colour per rider id, the same on every Crews screen. */
export function colorForUid(uid: string): string {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  return avatarColor(h);
}

export default function CrewAvatars({ uids, meUid, size = 28, max = 6, overlap = -9, ring = true, testID }: {
  uids: string[]; meUid?: string | null; size?: number; max?: number; overlap?: number; ring?: boolean; testID?: string;
}) {
  const { colors, type } = useTheme();
  const byId = useProfileStore((s) => s.byId);
  const key = uids.slice(0, max).join(',');
  useEffect(() => {
    if (key) void useProfileStore.getState().ensure(key.split(','));
  }, [key]);
  const shown = uids.slice(0, max);
  const extra = uids.length - shown.length;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }} testID={testID} accessibilityLabel={`${uids.length} riders`}>
      {shown.map((u, i) => (
        <Avatar key={u} initials={riderInitials(byId, u)} color={colorForUid(u)} size={size} me={u === meUid} ring={ring} style={i === 0 ? undefined : { marginLeft: overlap }} />
      ))}
      {extra > 0 ? (
        <View style={{ width: size, height: size, borderRadius: size / 2, marginLeft: overlap, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card2, borderWidth: ring ? 2.5 : 0, borderColor: colors.bg }}>
          <Text style={[type.pill, { color: colors.ink2, letterSpacing: 0 }]}>+{extra}</Text>
        </View>
      ) : null}
    </View>
  );
}
