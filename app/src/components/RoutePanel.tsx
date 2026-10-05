/**
 * RoutePanel — dark bottom sheet on the map (spec §3.3.8, §4.6).
 * Collapsed: ETA + distance as the two primary numbers, next stop as a
 * secondary row, riders-live row. With no route it shows a real empty state
 * (waiting for a fix / no destination) instead of placeholder numbers.
 * Expanded: safety bar, avoid-hazards control, Google Maps deep link.
 * Guidance is destination-level (route line, distance, ETA); turn-by-turn is
 * handed off to Google Maps — no turn list is ever invented.
 * Data: useRouteStore() (Person C), useRidersStore() (Person A).
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { WeRideColors, WeRideRadius, safetyScoreColor } from '@app/theme/theme';
import { type } from '@app/theme/typography';
import { useRouteStore } from '@routing/client/routeStore';
import { useRidersStore } from '@app/store/ridersStore';
import { useAppStore } from '@app/store/appStore';
import { useRidePlanStore } from '@app/store/ridePlanStore';
import { useStopsStore } from '@app/store/stopsStore';
import BottomSheet from './BottomSheet';
import AvatarStack from './AvatarStack';
import { COLLAPSED_HEIGHT, MAX_HEIGHT, EMPTY_STATE_COPY, routePanelMode } from './routePanelState';

export { COLLAPSED_HEIGHT };

interface Props {
  avoidHazards?: boolean;
  onToggleAvoidHazards?: () => void;
  onOpenInGoogleMaps?: () => void;
}

export default function RoutePanel({
  avoidHazards = false,
  onToggleAvoidHazards,
  onOpenInGoogleMaps,
}: Props) {
  const route = useRouteStore((s) => s.route);
  const isLoading = useRouteStore((s) => s.isLoading);
  const lastValidLocation = useRouteStore((s) => s.lastValidLocation);
  const riders = useRidersStore((s) => s.riders);
  const rideStartedAt = useAppStore((s) => s.rideStartedAt);
  const planStart = useRidePlanStore((s) => s.start);
  const planDestination = useRidePlanStore((s) => s.destination);
  const stops = useStopsStore((s) => s.stops);

  const riderNames = Array.from(riders.keys());
  // Riders actually reporting (not stale/grey) plus this device. Seeded
  // last-known positions of offline members must not inflate the count.
  const liveRiders = Array.from(riders.values()).filter((r) => r.markerState !== 'GREY').length + 1;
  const eta = route ? Math.round(route.eta_minutes) : null;
  const distance = route ? route.distance_km.toFixed(1) : null;
  const safety = route?.safety_score ?? null;

  const mode = routePanelMode({
    hasRoute: route != null,
    isLoading,
    hasFix: lastValidLocation != null,
    hasDestination: planDestination != null,
  });

  // Meta: "Pune → Lonavala · started 38 min ago" (spec §3.3.8), only real parts.
  const shortLabel = (label?: string | null) => label?.split(',')[0] ?? null;
  const originLabel = shortLabel(planStart?.label);
  const destLabel = shortLabel(planDestination?.label);
  const routeLabel =
    originLabel && destLabel ? `${originLabel} → ${destLabel}` : destLabel ? `→ ${destLabel}` : null;
  const startedAgo =
    rideStartedAt != null ? `started ${Math.max(1, Math.round((Date.now() - rideStartedAt) / 60000))} min ago` : null;
  const metaText = [routeLabel, startedAgo].filter(Boolean).join(' · ');

  // Next stop from the real stops store.
  const currentStop = stops.find((s) => s.status === 'current') ?? stops.find((s) => s.status === 'upcoming');

  const empty = mode === 'ready' || mode === 'loading' ? null : EMPTY_STATE_COPY[mode];

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
            {metaText ? (
              <Text style={styles.meta} numberOfLines={1}>
                {metaText}
              </Text>
            ) : null}

            {/* Primary numbers, or the loading / empty state */}
            {mode === 'loading' ? (
              <View style={styles.stateRow}>
                <ActivityIndicator color={WeRideColors.primary} size="small" />
                <Text style={styles.stateTitle}>Recalculating route…</Text>
              </View>
            ) : empty ? (
              <View style={styles.stateBox}>
                <Text style={styles.stateTitle}>{empty.title}</Text>
                <Text style={styles.stateDetail}>{empty.detail}</Text>
              </View>
            ) : (
              <>
                <View style={styles.statRow}>
                  <View style={styles.stat}>
                    <Text style={styles.statValue} numberOfLines={1}>
                      {eta != null ? String(eta) : ''}
                    </Text>
                    <Text style={styles.statLabel}>MIN LEFT</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.stat}>
                    <Text style={styles.statValue} numberOfLines={1}>
                      {distance ?? ''}
                    </Text>
                    <Text style={styles.statLabel}>KM LEFT</Text>
                  </View>
                </View>
                {currentStop ? (
                  <View style={styles.nextRow}>
                    <Text style={styles.statLabel}>NEXT STOP</Text>
                    <Text style={styles.nextValue} numberOfLines={1}>
                      {`${currentStop.icon} ${currentStop.name}`}
                    </Text>
                  </View>
                ) : null}
              </>
            )}

            {/* Riders live */}
            <View style={styles.ridersRow}>
              <AvatarStack names={riderNames} max={4} />
              <Text style={styles.ridersText}>
                {liveRiders} rider{liveRiders !== 1 ? 's' : ''} live
              </Text>
            </View>

            {/* Expanded content */}
            {expanded && (
              <ScrollView style={styles.expanded} pointerEvents="box-none">
                <View style={styles.safetyBlock}>
                  <View style={styles.safetyHead}>
                    <Text style={styles.sectionLabel}>Safety score</Text>
                    <Text style={styles.safetyValue}>
                      {safety != null ? `${Math.round(safety * 100)}%` : 'Not rated'}
                    </Text>
                  </View>
                  <View style={styles.safetyTrack}>
                    <View
                      style={[
                        styles.safetyFill,
                        {
                          backgroundColor: safety != null ? safetyScoreColor(safety) : WeRideColors.muted,
                          width: `${Math.max(0, Math.min(1, safety ?? 0)) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.controls} pointerEvents="box-none">
                  <TouchableOpacity
                    style={[styles.toggleBtn, avoidHazards ? styles.toggleActive : styles.toggleInactive]}
                    onPress={onToggleAvoidHazards}
                    accessibilityLabel={avoidHazards ? 'Avoiding hazards: on. Tap to disable' : 'Avoiding hazards: off. Tap to enable'}
                    accessibilityRole="button"
                  >
                    <View style={[styles.toggleDot, avoidHazards && styles.toggleDotOn]} />
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

                <Text style={styles.tbtPlaceholder}>
                  Turn-by-turn isn't built in. Open the route in Google Maps for step-by-step directions.
                </Text>
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
    paddingBottom: 16,
    gap: 12,
  },
  meta: { ...type.caption },
  statRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1 },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: WeRideColors.border,
    marginRight: 16,
  },
  statValue: { ...type.stat },
  statLabel: { ...type.label },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextValue: { ...type.bodyStrong, flex: 1 },
  stateRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stateBox: { minHeight: 44, justifyContent: 'center' },
  stateTitle: { ...type.heading },
  stateDetail: { ...type.caption },
  ridersRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ridersText: { ...type.captionStrong, color: WeRideColors.text },
  expanded: { maxHeight: MAX_HEIGHT - COLLAPSED_HEIGHT - 8 },
  safetyBlock: { gap: 8 },
  safetyHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { ...type.label, textTransform: 'uppercase' },
  safetyValue: { ...type.bodyStrong },
  safetyTrack: {
    height: 8,
    borderRadius: WeRideRadius.pill,
    backgroundColor: WeRideColors.dark3,
    overflow: 'hidden',
  },
  safetyFill: { height: 8, borderRadius: WeRideRadius.pill },
  controls: { gap: 12, marginTop: 16 },
  toggleBtn: {
    minHeight: 48,
    borderRadius: WeRideRadius.xl,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
  },
  toggleActive: { backgroundColor: WeRideColors.greenDim, borderColor: WeRideColors.green },
  toggleInactive: { backgroundColor: WeRideColors.dark3, borderColor: WeRideColors.border },
  toggleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: WeRideColors.muted },
  toggleDotOn: { backgroundColor: WeRideColors.green },
  toggleText: { ...type.bodyStrong, color: WeRideColors.textSub },
  toggleTextActive: { color: WeRideColors.text },
  gmapsBtn: {
    minHeight: 48,
    backgroundColor: WeRideColors.primary,
    borderRadius: WeRideRadius.xl,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gmapsText: { ...type.button },
  tbtPlaceholder: {
    ...type.caption,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 4,
  },
});
