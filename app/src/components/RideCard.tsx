/**
 * RideCard — the ride summary card (route map thumbnail on top, badge + date,
 * title, from → to, a stat row, avatar stack and "View →"), laid out like the
 * Ember home design. Presentational: GroupListScreen supplies real data and the
 * actions. Press = sink + warm tint + lit border (PressableCard).
 *
 *  hero      taller map, used for "Up next"
 *  standard  map thumbnail
 *  compact   no map (rides with no plan / earlier rides)
 */
import React from 'react';
import { AccessibilityActionEvent, AccessibilityActionInfo, StyleSheet, Text, View } from 'react-native';
import { WeRideColors, WeRideFonts, WeRideRadius, WeRideSpacing } from '../theme/theme';
import { type } from '../theme/typography';
import { PressableCard } from '../ui';
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

const AVATAR_COLORS = [WeRideColors.primary, WeRideColors.blue, WeRideColors.green, WeRideColors.gold];
const MAX_AVATARS = 4;

const TONE: Record<BadgeTone, { bg: string; fg: string }> = {
  ice: { bg: 'rgba(94,178,255,0.13)', fg: '#5EB2FF' },
  go: { bg: 'rgba(47,209,128,0.13)', fg: '#2FD180' },
  dim: { bg: WeRideColors.border, fg: WeRideColors.textSub },
};

export default function RideCard({
  variant = 'standard', badge, dateLabel, title, from, to, stats, mapPoints, memberCount,
  selfInitial, headerRight, footerActions, onPress, accessibilityLabel, accessibilityHint,
  accessibilityActions, onAccessibilityAction,
}: RideCardProps) {
  const showMap = variant !== 'compact' && !!mapPoints && mapPoints.length > 0;
  const shown = Math.min(Math.max(memberCount, 1), MAX_AVATARS);
  const extra = memberCount - shown;
  const tone = TONE[badge.tone];
  const route = from && to ? `${from}  →  ${to}` : to ? `To ${to}` : null;

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
          <RideMapPreview points={mapPoints!} height={variant === 'hero' ? 172 : 148} />
          {/* Over the map: keeps the header row free for the badge and the full date. */}
          {headerRight ? <View style={styles.mapPill}>{headerRight}</View> : null}
        </View>
      ) : null}

      <View style={styles.body}>
        <View style={styles.headRow}>
          <View style={styles.headLeft}>
            <View style={[styles.badge, { backgroundColor: tone.bg }]}>
              <Text style={[styles.badgeText, { color: tone.fg }]}>{badge.label}</Text>
            </View>
            {dateLabel ? <Text style={styles.date} numberOfLines={1}>{dateLabel}</Text> : null}
          </View>
        </View>

        {/* No map to overlay: the code sits beside the title, not in the badge/date row. */}
        <View style={styles.titleRow}>
          <Text style={[styles.title, styles.titleFlex]} numberOfLines={1}>{title}</Text>
          {showMap ? null : headerRight}
        </View>
        {route ? <Text style={styles.route} numberOfLines={1}>{route}</Text> : null}

        {stats.length > 0 ? (
          <View style={styles.stats}>
            {stats.map((s) => (
              <View key={s.label} style={styles.stat}>
                <Text style={styles.statValue} numberOfLines={1}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.foot}>
          <View style={styles.avatars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {Array.from({ length: shown }).map((_, i) => (
              <View
                key={i}
                style={[styles.avatar, { backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length], marginLeft: i === 0 ? 0 : -9 }]}
              >
                {i === 0 && selfInitial ? <Text style={styles.avatarText}>{selfInitial}</Text> : null}
              </View>
            ))}
            {extra > 0 ? (
              <View style={[styles.avatar, styles.more, { marginLeft: -9 }]}>
                <Text style={[styles.avatarText, { color: WeRideColors.textSub }]}>+{extra}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.footRight}>
            {footerActions}
            <Text style={styles.view}>View  →</Text>
          </View>
        </View>
      </View>
    </PressableCard>
  );
}

const RADIUS = 20;

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS },
  body: { padding: WeRideSpacing.lg },
  mapPill: {
    position: 'absolute',
    top: WeRideSpacing.md,
    right: WeRideSpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10,10,10,0.82)',
    borderRadius: WeRideRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: WeRideColors.border,
    paddingLeft: WeRideSpacing.md,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: WeRideSpacing.sm },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: WeRideSpacing.sm, flexShrink: 1 },
  badge: { borderRadius: WeRideRadius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { ...type.labelStrong, fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase' },
  date: { ...type.label, flexShrink: 1, textTransform: 'uppercase' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: WeRideSpacing.sm, marginTop: WeRideSpacing.sm + 2 },
  titleFlex: { flex: 1, minWidth: 0 },
  title: { ...type.titleSm },
  route: { ...type.caption, color: WeRideColors.textSub, fontSize: 13, lineHeight: 18, marginTop: 4 },
  stats: {
    flexDirection: 'row', gap: WeRideSpacing.sm, marginTop: WeRideSpacing.md,
    paddingTop: WeRideSpacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: WeRideColors.border,
  },
  stat: { flex: 1, minWidth: 0 },
  statValue: { fontFamily: WeRideFonts.bodyBold, fontSize: 15, lineHeight: 20, color: WeRideColors.text, fontVariant: ['tabular-nums'] },
  statLabel: { ...type.label, marginTop: 2, letterSpacing: 0.8, textTransform: 'uppercase' },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: WeRideSpacing.md, gap: WeRideSpacing.sm },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 2.5, borderColor: WeRideColors.dark3,
    alignItems: 'center', justifyContent: 'center',
  },
  more: { backgroundColor: WeRideColors.dark },
  avatarText: { fontFamily: WeRideFonts.bodyBold, fontSize: 11, lineHeight: 14, color: WeRideColors.onPrimary },
  footRight: { flexDirection: 'row', alignItems: 'center', gap: WeRideSpacing.md },
  view: { ...type.eyebrow },
});
