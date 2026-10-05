/**
 * RideCard — the demo's "ride pass" ticket: route map on top, a dashed
 * perforation with the two side notches, then pass pill + date, title,
 * from → to, a mono stats row, avatar stack and "View →".
 * Presentational: GroupListScreen supplies real data and the actions.
 * Press = sink + warm tint + lit border (PressableCard). Only the colours
 * come from the theme; the geometry is the demo's.
 *
 *  hero      taller map, used for "Up next"
 *  standard  map thumbnail
 *  compact   no map (rides with no plan / earlier rides)
 */
import React from 'react';
import { AccessibilityActionEvent, AccessibilityActionInfo, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { withAlpha, avatarColor } from '../theme/palettes';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import { Avatar, Icon, Pill, PillTone, PressableCard } from '../ui';
import type { BadgeTone } from '../utils/rides';
import type { LatLng } from '../utils/mapFit';
import RideMapPreview from './RideMapPreview';

export interface RideStat { value: string; label: string }

export interface RideCardProps {
  variant?: 'hero' | 'standard' | 'compact';
  badge: { label: string; tone: BadgeTone };
  dateLabel?: string | null;
  title: string;
  from?: string | null;
  to?: string | null;
  stats: RideStat[];
  /** Planned waypoints for the thumbnail (omit/empty → no map). */
  mapPoints?: LatLng[];
  memberCount: number;
  /** Letter for the current user's avatar. */
  selfInitial?: string;
  /** Right side of the header row (e.g. the join-code chip). */
  headerRight?: React.ReactNode;
  /** Left of "View →" in the footer (e.g. Leave). */
  footerActions?: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** The card's inner buttons are separate pressables; screen readers reach them as actions. */
  accessibilityActions?: readonly AccessibilityActionInfo[];
  onAccessibilityAction?: (e: AccessibilityActionEvent) => void;
}

const MAX_AVATARS = 4;
const RADIUS = 26;

const PILL_TONE: Record<BadgeTone, PillTone> = { ice: 'accent', go: 'ok', dim: 'default' };

/** Dashed tear line with the two half-circle notches (demo `.perf`). */
function Perforation() {
  const { colors } = useTheme();
  const styles = useStyles(({ colors: c }) => ({
    perf: { height: 2, marginHorizontal: 18 },
    notch: {
      position: 'absolute', top: -11, width: 24, height: 24, borderRadius: 12,
      backgroundColor: c.bg, borderWidth: 1.5, borderColor: c.line,
    },
  }));
  return (
    <View style={styles.perf} pointerEvents="none" testID="ride-perforation">
      <Svg width="100%" height={2}>
        <Line x1="0" y1="1" x2="100%" y2="1" stroke={colors.line2} strokeWidth={2} strokeDasharray="6 4" />
      </Svg>
      <View style={[styles.notch, { left: -30 }]} />
      <View style={[styles.notch, { right: -30 }]} />
    </View>
  );
}

export default function RideCard({
  variant = 'standard', badge, dateLabel, title, from, to, stats, mapPoints, memberCount,
  selfInitial, headerRight, footerActions, onPress, accessibilityLabel, accessibilityHint,
  accessibilityActions, onAccessibilityAction,
}: RideCardProps) {
  const { colors } = useTheme();
  const styles = useStyles(({ colors: c, type: t }) => ({
    card: { borderRadius: RADIUS },
    body: { paddingTop: 16, paddingHorizontal: 18, paddingBottom: 18 },
    mapPill: {
      position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center',
      backgroundColor: withAlpha(c.card, 0.92), borderRadius: 22, borderWidth: 1.5, borderColor: c.line,
      paddingLeft: 14,
    },
    headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    date: { ...t.sm, flexShrink: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12 },
    titleFlex: { flex: 1, minWidth: 0 },
    title: { ...t.h2 },
    route: { ...t.sm, marginTop: 8 },
    stats: { flexDirection: 'row', marginTop: 16 },
    stat: { flex: 1, minWidth: 0 },
    statValue: { ...t.statValue },
    statKey: { ...t.statKey, marginTop: 6 },
    foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, gap: 8 },
    avatars: { flexDirection: 'row', alignItems: 'center' },
    more: {
      width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.card2, borderWidth: 2.5, borderColor: c.bg, marginLeft: -9,
    },
    moreText: { ...t.statKey, letterSpacing: 0, color: c.ink2 },
    footRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    view: { ...t.smStrong },
  }));
  const showMap = variant !== 'compact' && !!mapPoints && mapPoints.length > 0;
  const shown = Math.min(Math.max(memberCount, 1), MAX_AVATARS);
  const extra = memberCount - shown;
  const route = from && to ? `${from}  →  ${to}` : to ? `To ${to}` : null;
  // Four stats still fit one row if the numerals step down a little.
  const valueSize = stats.length > 3 ? { fontSize: 21, lineHeight: 25 } : null;

  return (
    <PressableCard
      onPress={onPress}
      radius={RADIUS}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
    >
      {showMap ? (
        <View>
          <RideMapPreview points={mapPoints!} height={variant === 'hero' ? 158 : 124} />
          {/* Over the map: keeps the header row free for the pill and the full date. */}
          {headerRight ? <View style={styles.mapPill}>{headerRight}</View> : null}
        </View>
      ) : null}
      {showMap ? <Perforation /> : null}

      <View style={styles.body}>
        <View style={styles.headRow}>
          <Pill label={badge.label} tone={PILL_TONE[badge.tone]} />
          {dateLabel ? <Text style={styles.date} numberOfLines={1}>{dateLabel}</Text> : null}
        </View>

        {/* No map to overlay: the code sits beside the title, not in the pill/date row. */}
        <View style={styles.titleRow}>
          <Text style={[styles.title, styles.titleFlex]} numberOfLines={1}>{title}</Text>
          {showMap ? null : headerRight}
        </View>
        {route ? <Text style={styles.route} numberOfLines={1}>{route}</Text> : null}

        {stats.length > 0 ? (
          <View style={styles.stats}>
            {stats.map((s) => (
              <View key={s.label} style={styles.stat}>
                <Text style={[styles.statValue, valueSize]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {s.value}
                </Text>
                <Text style={styles.statKey} numberOfLines={1}>{s.label.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.foot}>
          <View style={styles.avatars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {Array.from({ length: shown }).map((_, i) => (
              <Avatar
                key={i}
                size={28}
                me={i === 0 && !!selfInitial}
                initials={i === 0 && selfInitial ? selfInitial : ''}
                color={avatarColor(i + 1)}
                style={i === 0 ? undefined : { marginLeft: -9 }}
              />
            ))}
            {extra > 0 ? (
              <View style={styles.more}>
                <Text style={styles.moreText}>+{extra}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.footRight}>
            {footerActions}
            <Text style={styles.view}>View</Text>
            <Icon name="chev" size={18} color={colors.ink} />
          </View>
        </View>
      </View>
    </PressableCard>
  );
}
