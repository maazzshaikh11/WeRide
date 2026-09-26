/**
 * RoutePanel — dark bottom sheet on the map (spec §3.3.8, §4.6).
 * Collapsed: ride name/meta, avatar stack, stat row (km left, min eta, next stop).
 * Expanded: music player, safety score bar, avoid-hazards toggle,
 * Google Maps deep link, turn-by-turn placeholder.
 * Data: useRouteStore() (Person C), useRidersStore() (Person A).
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { WeRideColors, WeRideFonts, safetyScoreColor } from '@app/theme/theme';
import { useRouteStore } from '@routing/client/routeStore';
import { useRidersStore } from '@app/store/ridersStore';
import BottomSheet from './BottomSheet';
import StatBox from './StatBox';
import AvatarStack from './AvatarStack';
import MusicPlayer from './MusicPlayer';

interface Props {
  avoidHazards?: boolean;
  onToggleAvoidHazards?: () => void;
  onOpenInGoogleMaps?: () => void;
  /** SOS/music duck integration (spec: music ducks on SOS) */
  duckReason?: string | null;
}

const COLLAPSED_HEIGHT = 150;
const MAX_HEIGHT = 320;

export default function RoutePanel({
  avoidHazards = false,
  onToggleAvoidHazards,
  onOpenInGoogleMaps,
  duckReason,
}: Props) {
  const route = useRouteStore((s) => s.route);
  const isLoading = useRouteStore((s) => s.isLoading);
  const riders = useRidersStore((s) => s.riders);

  const riderNames = Array.from(riders.keys());
  const eta = route ? Math.round(route.eta_minutes) : null;
  const distance = route ? route.distance_km.toFixed(1) : null;
  const safety = route?.safety_score ?? null;

  return (
    <BottomSheet collapsedHeight={COLLAPSED_HEIGHT} maxHeight={MAX_HEIGHT}>
      {({ expanded, toggle }) => (
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={toggle}
          accessibilityLabel={expanded ? 'Collapse ride details' : 'Expand ride details'}
          accessibilityRole="button"
        >
          <View style={styles.inner} pointerEvents="box-none">
            {/* Row 1: ride name + meta */}
            <View style={styles.titleRow}>
              <Text style={styles.rideName}>
                {riderNames.length} rider{riderNames.length !== 1 ? 's' : ''} · Convoy synced
              </Text>
              <Text style={styles.rideMeta}>
                {isLoading ? 'Recalculating…' : 'Route active'}
              </Text>
            </View>

            {/* Row 2: avatar stack */}
            <AvatarStack names={riderNames} max={4} />

            {/* Row 3: stat row */}
            <View style={styles.statRow}>
              {isLoading ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator color={WeRideColors.primary} size="small" />
                  <Text style={styles.loadingText}>Recalculating route…</Text>
                </View>
              ) : (
                <>
                  <StatBox value={distance ?? '—'} label="km left" />
                  <StatBox value={eta != null ? String(eta) : '—'} label="min eta" />
                  <StatBox value="☕ —" label="next stop" display={false} />
                </>
              )}
            </View>

            {/* Expanded content */}
            {expanded && (
              <ScrollView style={styles.expanded} pointerEvents="box-none">
                <MusicPlayer duckReason={duckReason} />

                {/* Safety score bar (spec §4.6) */}
                <View style={styles.safetyRow}>
                  <Text style={styles.safetyLabel}>Safety score</Text>
                  <View style={styles.safetyTrack}>
                    <View
                      style={[
                        styles.safetyFill,
                        { backgroundColor: safety != null ? safetyScoreColor(safety) : '#333333', width: `${(safety ?? 0) * 100}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.safetyValue}>
                    {safety != null ? `${Math.round(safety * 100)}%` : '—'}
                  </Text>
                </View>

                <View style={styles.controls} pointerEvents="box-none">
                  <TouchableOpacity
                    style={[styles.toggleBtn, avoidHazards ? styles.toggleActive : styles.toggleInactive]}
                    onPress={onToggleAvoidHazards}
                    accessibilityLabel={avoidHazards ? 'Avoiding hazards: on. Tap to disable' : 'Avoiding hazards: off. Tap to enable'}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.toggleText, avoidHazards ? styles.toggleTextActive : null]}>
                      {avoidHazards ? 'Avoiding hazards' : 'Hazards ignored'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.gmapsBtn}
                    onPress={onOpenInGoogleMaps}
                    accessibilityLabel="Open route in Google Maps"
                    accessibilityRole="button"
                  >
                    <Text style={styles.gmapsText}>Open in Google Maps</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.tbtPlaceholder}>Turn-by-turn navigation (coming soon)</Text>
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  inner: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rideName: {
    fontFamily: WeRideFonts.body,
    fontSize: 13,
    fontWeight: '700',
    color: WeRideColors.white,
  },
  rideMeta: {
    fontFamily: WeRideFonts.body,
    fontSize: 10,
    color: WeRideColors.textSub,
  },
  statRow: { flexDirection: 'row', gap: 8 },
  loadingWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  loadingText: { fontFamily: WeRideFonts.body, fontSize: 11, color: WeRideColors.textSub },
  expanded: { maxHeight: 170, marginTop: 2 },
  safetyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  safetyLabel: { fontFamily: WeRideFonts.body, fontSize: 10, color: WeRideColors.textSub },
  safetyTrack: {
    flex: 1,
    height: 8,
    borderRadius: 99,
    backgroundColor: WeRideColors.dark3,
    overflow: 'hidden',
  },
  safetyFill: { height: 8, borderRadius: 99 },
  safetyValue: { fontFamily: WeRideFonts.mono, fontSize: 10, color: WeRideColors.text },
  controls: { gap: 8, marginTop: 10 },
  toggleBtn: {
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  toggleActive: { backgroundColor: WeRideColors.green },
  toggleInactive: {
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
  },
  toggleText: { fontFamily: WeRideFonts.body, fontSize: 12.5, fontWeight: '700', color: WeRideColors.textSub },
  toggleTextActive: { color: WeRideColors.white },
  gmapsBtn: {
    backgroundColor: WeRideColors.blue,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  gmapsText: { fontFamily: WeRideFonts.body, fontSize: 12.5, fontWeight: '700', color: WeRideColors.white },
  tbtPlaceholder: {
    fontFamily: WeRideFonts.body,
    fontSize: 12,
    color: WeRideColors.textSub,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
});