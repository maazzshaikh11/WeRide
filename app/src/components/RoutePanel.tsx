/**
 * RoutePanel — dark bottom sheet on the map (spec §3.3.8, §4.6).
 * Collapsed: ETA + distance as the two primary numbers, next stop as a
 * secondary row, riders-live row. With no route it shows a real empty state
 * (waiting for a fix / no destination) instead of placeholder numbers.
 * Expanded: safety bar, avoid-hazards control, Google Maps deep link.
 * Guidance is destination-level (route line, distance, ETA); turn-by-turn is
 * handed off to Google Maps — no turn list is ever invented.
 * Data: useRouteStore() (Person C), useRidersStore() (Person A).
 *
 * Motion: ETA / distance pop briefly (opacity + scale, native driver) when they
 * change and pulse like a skeleton while the route recalculates (the numbers
 * stay in place — only a route-less recalculation shows skeleton blocks);
 * empty states fade in; the avoid-hazards toggle cross-fades its colours and
 * pops its status dot.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, ActivityIndicator } from 'react-native';
import { WeRideColors, WeRideRadius, safetyScoreColor } from '@app/theme/theme';
import { type } from '@app/theme/typography';
import { useRouteStore } from '@routing/client/routeStore';
import { useRidersStore } from '@app/store/ridersStore';
import { useAppStore } from '@app/store/appStore';
import { useRidePlanStore } from '@app/store/ridePlanStore';
import { useStopsStore } from '@app/store/stopsStore';
import { Button, FadeIn, PressableScale, Skeleton, useReducedMotion } from '../ui';
import BottomSheet from './BottomSheet';
import AvatarStack from './AvatarStack';
import { COLLAPSED_HEIGHT, MAX_HEIGHT, EMPTY_STATE_COPY, routePanelMode } from './routePanelState';

export { COLLAPSED_HEIGHT };

interface Props {
  avoidHazards?: boolean;
  onToggleAvoidHazards?: () => void;
  onOpenInGoogleMaps?: () => void;
  /** Lets the screen move floating controls out of the way of the expanded sheet. */
  onExpandedChange?: (expanded: boolean) => void;
}

/**
 * A primary number. Pops (opacity 0.35 -> 1, scale 1.12 -> 1) when `value`
 * changes after mount; while `pulsing` it breathes like a skeleton so the
 * rider sees the old value is being refreshed. Transform/opacity only, and the
 * wrapper hugs the text so scaling never moves the layout.
 */
function StatNumber({ value, pulsing }: { value: string; pulsing: boolean }) {
  const reduced = useReducedMotion();
  const pop = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    if (reduced) return;
    pop.setValue(0);
    const anim = Animated.timing(pop, { toValue: 1, duration: 260, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [value, pop, reduced]);

  useEffect(() => {
    if (!pulsing) {
      pulse.setValue(1);
      return;
    }
    if (reduced || typeof Animated.loop !== 'function' || typeof Animated.sequence !== 'function') {
      pulse.setValue(0.55);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.9, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulsing, pulse, reduced]);

  return (
    <Animated.View style={[styles.statNumber, { opacity: pulse }]}>
      <Animated.View
        style={{
          opacity: pop.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
          transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1.12, 1] }) }],
        }}
      >
        <Text style={styles.statValue} numberOfLines={1}>
          {value}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Avoid-hazards switch: a PressableScale ('select' haptic) whose green state
 * cross-fades over the neutral one (surface + border) and whose status dot
 * fades to green with a small pop. Opacity/transform only.
 */
function AvoidToggle({ on, onPress }: { on: boolean; onPress?: () => void }) {
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(on ? 1 : 0)).current;
  const dotPop = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) {
      t.setValue(on ? 1 : 0);
      return;
    }
    const fade = Animated.timing(t, { toValue: on ? 1 : 0, duration: 200, useNativeDriver: true });
    dotPop.setValue(0.6);
    const pop = Animated.spring(dotPop, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true });
    fade.start();
    pop.start();
    return () => {
      fade.stop();
      pop.stop();
    };
  }, [on, t, dotPop, reduced]);

  return (
    <PressableScale
      style={styles.toggleBtn}
      haptic="select"
      onPress={onPress}
      accessibilityLabel={on ? 'Avoiding hazards: on. Tap to disable' : 'Avoiding hazards: off. Tap to enable'}
      accessibilityRole="button"
    >
      <Animated.View pointerEvents="none" style={[styles.toggleOn, { opacity: t }]} />
      <View style={styles.dotBox}>
        <View style={styles.toggleDot} />
        <Animated.View style={[styles.toggleDot, styles.toggleDotOn, { opacity: t, transform: [{ scale: dotPop }] }]} />
      </View>
      <Text style={[styles.toggleText, on ? styles.toggleTextActive : null]}>
        {on ? 'Avoiding hazards' : 'Hazards ignored'}
      </Text>
    </PressableScale>
  );
}

export default function RoutePanel({
  avoidHazards = false,
  onToggleAvoidHazards,
  onOpenInGoogleMaps,
  onExpandedChange,
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

  const recalculating = mode === 'loading';
  const showStats = mode === 'ready' || recalculating;
  // Recalculating with nothing to show yet: skeleton blocks instead of numbers.
  const placeholderStats = recalculating && route == null;

  return (
    <BottomSheet collapsedHeight={COLLAPSED_HEIGHT} maxHeight={MAX_HEIGHT} onExpandedChange={onExpandedChange}>
      {({ expanded, toggle }) => (
        <PressableScale
          scaleTo={0.99}
          haptic={false}
          onPress={toggle}
          accessibilityLabel={expanded ? 'Collapse ride details' : 'Expand ride details'}
          accessibilityRole="button"
        >
          <View style={styles.inner} pointerEvents="box-none">
            {recalculating ? (
              <View style={styles.recalcRow}>
                <ActivityIndicator color={WeRideColors.primary} size="small" style={styles.recalcSpinner} />
                <Text style={styles.recalcText} numberOfLines={1}>
                  Recalculating route…
                </Text>
              </View>
            ) : metaText ? (
              <Text style={styles.meta} numberOfLines={1}>
                {metaText}
              </Text>
            ) : null}

            {/* Primary numbers (kept in place while recalculating), or the empty state */}
            {showStats ? (
              <>
                <View style={styles.statRow}>
                  <View style={styles.stat}>
                    {placeholderStats ? (
                      <Skeleton width={64} height={28} style={styles.statSkeleton} />
                    ) : (
                      <StatNumber value={eta != null ? String(eta) : ''} pulsing={recalculating} />
                    )}
                    <Text style={styles.statLabel}>MIN LEFT</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.stat}>
                    {placeholderStats ? (
                      <Skeleton width={64} height={28} style={styles.statSkeleton} />
                    ) : (
                      <StatNumber value={distance ?? ''} pulsing={recalculating} />
                    )}
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
            ) : empty ? (
              <FadeIn key={mode} style={styles.stateBox}>
                <Text style={styles.stateTitle}>{empty.title}</Text>
                <Text style={styles.stateDetail}>{empty.detail}</Text>
              </FadeIn>
            ) : null}

            {/* Riders live */}
            <View style={styles.ridersRow}>
              <AvatarStack names={riderNames} max={4} />
              <Text style={styles.ridersText}>
                {liveRiders} rider{liveRiders !== 1 ? 's' : ''} live
              </Text>
            </View>

            {/* Expanded content */}
            {expanded && (
              <FadeIn delay={40}>
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
                    <AvoidToggle on={avoidHazards} onPress={onToggleAvoidHazards} />

                    <Button
                      label="Open in Google Maps"
                      accessibilityLabel="Open route in Google Maps"
                      haptic="tap"
                      onPress={onOpenInGoogleMaps}
                    />
                  </View>

                  <Text style={styles.tbtPlaceholder}>
                    Turn-by-turn isn't built in. Open the route in Google Maps for step-by-step directions.
                  </Text>
                </ScrollView>
              </FadeIn>
            )}
          </View>
        </PressableScale>
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
  statNumber: { alignSelf: 'flex-start' },
  statSkeleton: { alignSelf: 'flex-start' },
  statLabel: { ...type.label },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextValue: { ...type.bodyStrong, flex: 1 },
  // Same height as the meta caption it replaces, so recalculating never shifts the rows below.
  recalcRow: { height: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  recalcSpinner: { width: 16, height: 16, transform: [{ scale: 0.7 }] },
  recalcText: { ...type.caption, color: WeRideColors.primary, flex: 1 },
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
    borderColor: WeRideColors.border,
    backgroundColor: WeRideColors.dark3,
  },
  // Green state, fading in over the neutral surface (inset -1 covers the border).
  toggleOn: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: WeRideRadius.xl,
    borderWidth: 1,
    borderColor: WeRideColors.green,
    backgroundColor: WeRideColors.greenDim,
  },
  dotBox: { width: 8, height: 8 },
  toggleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: WeRideColors.muted },
  toggleDotOn: { position: 'absolute', top: 0, left: 0, backgroundColor: WeRideColors.green },
  toggleText: { ...type.bodyStrong, color: WeRideColors.textSub },
  toggleTextActive: { color: WeRideColors.text },
  tbtPlaceholder: {
    ...type.caption,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 4,
  },
});
