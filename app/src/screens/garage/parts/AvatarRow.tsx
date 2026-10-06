/** Overlapping rider avatars from real profiles (initials from the profile name; the rider themself in the accent). */
import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { avatarColor } from '../../../theme/palettes';
import { useStyles } from '../../../theme/ThemeProvider';
import { Avatar } from '../../../ui';
import { riderInitials, useProfileStore } from '../../../store/profileStore';

export default function AvatarRow({ uids, myUid, size = 28, max = 5 }: { uids: string[]; myUid: string | null; size?: number; max?: number }) {
  const byId = useProfileStore((s) => s.byId);
  const ensure = useProfileStore((s) => s.ensure);
  const key = uids.join('|');
  useEffect(() => {
    void ensure(uids);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the id list
  }, [key, ensure]);
  const styles = useStyles(({ colors: c, type: t }) => ({
    row: { flexDirection: 'row', alignItems: 'center' },
    more: { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card2, borderWidth: 2.5, borderColor: c.bg, marginLeft: -9 },
    moreText: { ...t.statKey, letterSpacing: 0, color: c.ink2 },
  }));
  // The rider first, like the demo's "AR" leading the stack.
  const ordered = myUid && uids.includes(myUid) ? [myUid, ...uids.filter((u) => u !== myUid)] : uids;
  const shown = ordered.slice(0, max);
  const extra = ordered.length - shown.length;
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="avatar-row">
      {shown.map((u, i) => (
        <Avatar key={u} size={size} me={u === myUid} initials={riderInitials(byId, u)} color={avatarColor(i + 1)} style={i === 0 ? undefined : { marginLeft: -9 }} />
      ))}
      {extra > 0 ? (
        <View style={styles.more}>
          <Text style={styles.moreText}>+{extra}</Text>
        </View>
      ) : null}
    </View>
  );
}
