/**
 * AlertsScreen — road alerts tab (spec §3.7).
 * Report chips (Person B hazard report flow) + live alert cards.
 * Data: subscribeToHazardClusters() from @hazard (Person B, unmodified).
 *
 * Known gaps (no contract field / API, so nothing is faked in the UI):
 *  - hazard severity or a free-text note: the hazard_report contract has neither.
 *  - listener errors: subscribeToHazardClusters has no error callback (it only
 *    logs), so the error state below covers a failed subscribe, not a dropped
 *    snapshot stream.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View, StyleSheet, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WeRideColors, WeRideRadius, WeRideSpacing } from '../theme/theme';
import { type } from '../theme/typography';
import ScreenHeader from '../components/ScreenHeader';
import LivePill from '../components/LivePill';
import AlertCard from '../components/AlertCard';
import HazardChip from '../components/HazardChip';
import { useAppStore } from '../store/appStore';
import { useRidersStore } from '../store/ridersStore';
import { useRouteStore } from '@routing/client/routeStore';
import { useToastStore } from '../store/toastStore';
import { subscribeToHazardClusters, submitHazardReport, triggerClustering } from '@hazard/services/hazardService';
import { HazardCluster, HazardType } from '@app/models/hazardCluster';
import { haversineMeters } from '../utils/geoUtils';

export const HAZARD_EMOJI: Record<HazardType, string> = {
  pothole: '🕳️',
  oil_spill: '🛢️',
  accident: '🚨',
  debris: '🧱',
  other: '⚠️',
};

/** The real hazard_report contract types, in the order the chips appear. */
export const HAZARD_OPTIONS: { type: HazardType; label: string }[] = [
  { type: 'pothole', label: 'Pothole' },
  { type: 'oil_spill', label: 'Oil spill' },
  { type: 'accident', label: 'Accident' },
  { type: 'debris', label: 'Debris' },
  { type: 'other', label: 'Other' },
];

const HAZARD_LABEL: Record<string, string> = Object.fromEntries(
  HAZARD_OPTIONS.map((o) => [o.type, o.label]),
);

function hlcPhysical(hlc: string | undefined): number {
  if (!hlc) return 0;
  const physical = Number(hlc.split(':')[0]);
  return Number.isFinite(physical) && physical > 0 ? physical : 0;
}

function timeAgo(hlc: string | undefined): string {
  const physical = hlcPhysical(hlc);
  if (physical === 0) return '';
  const mins = Math.max(0, Math.round((Date.now() - physical) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)}h ago`;
}

/** Active hazards first, then newest first. */
export function sortClusters(list: HazardCluster[]): HazardCluster[] {
  return [...list].sort((a, b) => {
    const aActive = a.status === 'active' ? 0 : 1;
    const bActive = b.status === 'active' ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return hlcPhysical(b.created_at_hlc) - hlcPhysical(a.created_at_hlc);
  });
}

export default function AlertsScreen() {
  const groupId = useAppStore((s) => s.groupId);
  const userId = useAppStore((s) => s.userId);
  const riders = useRidersStore((s) => s.riders);
  const currentLocation = useRouteStore((s) => s.currentLocation);
  const push = useToastStore((s) => s.push);

  // null until the first hazard snapshot arrives.
  const [clusters, setClusters] = useState<HazardCluster[] | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [submittingType, setSubmittingType] = useState<HazardType | null>(null);
  const knownIds = useRef<Set<string> | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!groupId) return;
    setClusters(null);
    setLoadError(false);
    knownIds.current = null;
    try {
      const unsubscribe = subscribeToHazardClusters(groupId, (next) => {
        const ids = new Set(next.map((c) => c.cluster_id));
        // The first snapshot is the baseline; only later arrivals are "new".
        const prevKnown = knownIds.current;
        setNewIds(prevKnown ? new Set([...ids].filter((id) => !prevKnown.has(id))) : new Set());
        knownIds.current = ids;
        setClusters(next);
      });
      return unsubscribe;
    } catch {
      // Surfaced to the rider via the error state + retry below.
      setLoadError(true);
      return undefined;
    }
  }, [groupId, attempt]);

  const sorted = useMemo(() => (clusters ? sortClusters(clusters) : null), [clusters]);
  const activeCount = useMemo(
    () => (clusters ?? []).filter((c) => c.status === 'active').length,
    [clusters],
  );

  const submitReport = useCallback(
    async (hazardType: HazardType) => {
      if (!groupId || !userId || inFlight.current) return;
      // Use verified location (Person A stream via routeStore) for the report
      const loc = currentLocation ?? riders.get(userId)?.location ?? null;
      const lat = loc?.lat;
      const lng = loc?.lng;
      if (lat == null || lng == null) {
        push('Location not available yet — try again', 'warn');
        return;
      }
      inFlight.current = true;
      setSubmittingType(hazardType);
      try {
        const { queued } = await submitHazardReport(hazardType, lat, lng, userId, groupId, loc?.timestamp_hlc ?? '');
        await triggerClustering(groupId);
        push(queued ? 'Hazard queued — will sync when online' : 'Hazard reported', queued ? 'warn' : undefined);
      } catch (e) {
        console.warn('[AlertsScreen] submitHazardReport failed:', e);
        push('Could not submit hazard — please try again', 'error');
      } finally {
        inFlight.current = false;
        setSubmittingType(null);
      }
    },
    [groupId, userId, currentLocation, riders, push],
  );

  const isLoading = groupId != null && clusters === null && !loadError;
  const submitting = submittingType !== null;

  let pill: React.ReactNode = null;
  if (isLoading) pill = <LivePill variant="gold" label="SYNCING" />;
  else if (clusters) pill = <LivePill variant={activeCount > 0 ? 'live' : 'grey'} label={`${activeCount} ACTIVE`} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Road Alerts" right={pill} />

        <Text style={[type.label, styles.sectionLabel]}>REPORT A HAZARD</Text>
        <View style={styles.chipRow}>
          {HAZARD_OPTIONS.map((opt) => (
            <HazardChip
              key={opt.type}
              emoji={HAZARD_EMOJI[opt.type]}
              label={opt.label}
              disabled={submitting || !groupId}
              busy={submittingType === opt.type}
              onPress={() => submitReport(opt.type)}
            />
          ))}
        </View>
        <Text style={[type.caption, styles.hint]}>
          {submitting
            ? 'Sending your report…'
            : 'Reports use your current location. A hazard is listed once two reports match in the same spot.'}
        </Text>

        <Text style={[type.label, styles.sectionLabel]}>ON THIS RIDE</Text>
        {!groupId ? (
          <EmptyBlock title="No ride selected" body="Open a ride to report and see hazards." />
        ) : loadError ? (
          <View style={styles.block} accessibilityRole="alert">
            <Text style={type.heading}>Could not load hazards</Text>
            <Text style={[type.body, styles.blockBody]}>Check your connection and try again.</Text>
            <Pressable
              style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
              onPress={() => setAttempt((n) => n + 1)}
              accessibilityRole="button"
              accessibilityLabel="Retry loading hazards"
            >
              <Text style={[type.buttonSm, { color: WeRideColors.primary }]}>Retry</Text>
            </Pressable>
          </View>
        ) : sorted === null ? (
          <View style={styles.cardList} accessibilityLabel="Loading hazards" accessibilityState={{ busy: true }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.skeleton} testID="alerts-skeleton" />
            ))}
          </View>
        ) : sorted.length === 0 ? (
          <EmptyBlock
            title="No hazards reported on this ride"
            body="Tap a hazard type above when you pass one."
          />
        ) : (
          <View style={styles.cardList}>
            {sorted.map((c) => {
              const ago = timeAgo(c.created_at_hlc);
              const dist =
                currentLocation != null
                  ? `${(haversineMeters(currentLocation.lat, currentLocation.lng, c.centroid_lat, c.centroid_lng) / 1000).toFixed(1)} km away`
                  : null;
              const reports = `${c.report_count} report${c.report_count !== 1 ? 's' : ''}`;
              const meta = [reports, dist, ago].filter(Boolean).join(' · ');
              const label = HAZARD_LABEL[c.hazard_type] ?? 'Hazard';
              return (
                <AlertCard
                  key={c.cluster_id}
                  emoji={HAZARD_EMOJI[c.hazard_type] ?? HAZARD_EMOJI.other}
                  title={`${label}${c.status === 'resolved' ? ' (resolved)' : ''}`}
                  meta={meta}
                  isNew={newIds.has(c.cluster_id)}
                />
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function EmptyBlock({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.block}>
      <Text style={type.heading}>{title}</Text>
      <Text style={[type.body, styles.blockBody]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WeRideColors.dark },
  content: { paddingHorizontal: WeRideSpacing.lg, paddingBottom: WeRideSpacing.xxl },
  sectionLabel: { marginBottom: WeRideSpacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: WeRideSpacing.sm },
  hint: { marginTop: WeRideSpacing.md, marginBottom: WeRideSpacing.xxl },
  cardList: { gap: WeRideSpacing.md },
  skeleton: {
    height: 74,
    borderRadius: WeRideRadius.xl,
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
  },
  block: {
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: WeRideRadius.xl,
    padding: WeRideSpacing.lg,
    gap: WeRideSpacing.xs,
  },
  blockBody: { color: WeRideColors.textSub },
  retryBtn: {
    minHeight: 44,
    marginTop: WeRideSpacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: WeRideRadius.lg,
    borderWidth: 1,
    borderColor: WeRideColors.primary,
    backgroundColor: WeRideColors.primaryDim,
  },
  pressed: { opacity: 0.85 },
});
