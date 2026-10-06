/**
 * The rider's own avatar on the live map, with the floating distance label to
 * its RIGHT (e.g. "100m" to the nearest crew member). The label lives inside
 * the same map marker as the avatar, so it moves with it and re-renders with
 * every position update. A transparent spacer of the same width on the left
 * keeps the avatar itself centred on the coordinate.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { useStyles, useTheme } from '../../../theme/ThemeProvider';
import { CAP } from '../../../theme/textPolicy';

export const GAP_LABEL_W = 68;
export const LIVE_AVATAR_SIZE = 40;

export default function LiveAvatar({ label, talking }: { label: string | null; talking?: boolean }) {
  const { road, roadType } = useTheme();
  const s = useStyles(({ road: r, roadType: t }) => ({
    row: { flexDirection: 'row', alignItems: 'center' },
    spacer: { width: GAP_LABEL_W },
    labelSlot: { width: GAP_LABEL_W, alignItems: 'flex-start', paddingLeft: 8 },
    // demo `.ld .gp`: mono 12, ink on the page colour at 78%
    label: {
      ...t.num, fontSize: 12, lineHeight: 14,
      color: r.ink, backgroundColor: r.bg + 'C7', paddingVertical: 2, paddingHorizontal: 5, borderRadius: 5, overflow: 'hidden',
    },
    dot: {
      width: LIVE_AVATAR_SIZE, height: LIVE_AVATAR_SIZE, borderRadius: LIVE_AVATAR_SIZE / 2,
      alignItems: 'center', justifyContent: 'center', backgroundColor: r.pri,
      // demo `.ld.me .dot`: 3px page ring, then a 3px ink ring
      borderWidth: 3, borderColor: r.ink,
    },
    ring: { position: 'absolute', width: LIVE_AVATAR_SIZE + 6, height: LIVE_AVATAR_SIZE + 6, borderRadius: (LIVE_AVATAR_SIZE + 6) / 2, borderWidth: 3, borderColor: r.bg },
    // demo `.ld.talk .dot`: a green ring while the push-to-talk key is held
    talkRing: { borderColor: r.ok },
  }));
  return (
    <View style={s.row} pointerEvents="none" testID="live-avatar" accessible accessibilityLabel={label ? `You. Nearest rider ${label} away` : 'You'}>
      <View style={s.spacer} />
      <View style={{ width: LIVE_AVATAR_SIZE + 6, height: LIVE_AVATAR_SIZE + 6, alignItems: 'center', justifyContent: 'center' }}>
        <View style={s.ring} />
        <View style={[s.dot, talking && s.talkRing]} testID={talking ? 'live-avatar-talking' : undefined}>
          <Text style={[roadType.num, { fontSize: 11.5, lineHeight: 13, color: road.priInk, letterSpacing: 0 }]} maxFontSizeMultiplier={CAP.fixed}>YOU</Text>
        </View>
      </View>
      <View style={s.labelSlot}>
        {label ? (
          <Text style={s.label} numberOfLines={1} testID="live-gap-label" maxFontSizeMultiplier={CAP.fixed}>
            {label}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
