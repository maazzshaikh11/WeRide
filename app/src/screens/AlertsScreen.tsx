/**
 * AlertsScreen — road alerts tab (spec §3.7).
 * Report chips (Person B hazard report flow) + live alert cards.
 * Data: subscribeToHazardClusters() from @hazard (Person B, unmodified).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WeRideColors, WeRideFonts, hazardColor } from '../theme/theme';
import ScreenHeader from '../components/ScreenHeader';
import LivePill from '../components/LivePill';
import AlertCard from '../components/AlertCard';
import HazardChip from '../components/HazardChip';
import { useAppStore } from '../store/appStore';
import { useRidersStore } from '../store/ridersStore';
import { useRouteStore } from '@routing/client/routeStore';
import { useToastStore } from '../store/toastStore';
import { subscribeToHazardClusters, submitHazardReport, triggerClustering } from '@hazard/services/hazardService';
import { HazardCluster } from '@app/models/hazardCluster';

// Spec §3.7 report chips
const CHIPS = [
  { emoji: '🕳️', label: 'Pothole', type: 'pothole' as const },
  { emoji: '🐄', label: 'Animal', type: 'other' as const },
  { emoji: '👮', label: 'Checkpoint', type: 'other' as const },
  { emoji: '🌧️', label: 'Rain', type: 'other' as const },
];

const HAZARD_EMOJI: Record<string, string> = {
  pothole: '🕳️',
  oil_spill: '🛢️',
  accident: '🚨',
  debris: '🧱',
  other: '⚠️',
};

function timeAgo(hlcOrIso: string | undefined): string {
  if (!hlcOrIso) return '';
  const physical = Number(hlcOrIso.split(':')[0]);
  if (!Number.isFinite(physical) || physical <= 0) return '';
  const mins = Math.max(0, Math.round((Date.now() - physical) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)}h ago`;
}

export default function AlertsScreen() {
  const groupId = useAppStore((s) => s.groupId);
  const userId = useAppStore((s) => s.userId);
  const riders = useRidersStore((s) => s.riders);
  const currentLocation = useRouteStore((s) => s.currentLocation);
  const push = useToastStore((s) => s.push);
  const [clusters, setClusters] = useState<HazardCluster[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!groupId) return;
    const unsubscribe = subscribeToHazardClusters(groupId, (next) => {
      setNewIds((prev) => {
        const known = new Set(clusters.map((c) => c.cluster_id));
        const fresh = new Set(next.map((c) => c.cluster_id).filter((id) => !known.has(id)));
        if (prev.size === 0 && fresh.size > 0) {
          // skip alertPop on first snapshot load
          return new Set<string>();
        }
        return fresh;
      });
      setClusters(next);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const activeCount = useMemo(
    () => clusters.filter((c) => c.status === 'active').length,
    [clusters],
  );

  const submitReport = async (chip: typeof CHIPS[number]) => {
    if (!groupId || !userId) return;
    // Use verified location (Person A stream via routeStore) for the report
    const loc = currentLocation ?? riders.get(userId ?? '')?.location ?? null;
    const lat = loc?.lat;
    const lng = loc?.lng;
    if (lat == null || lng == null) {
      push('📡 Location not available yet — try again', 'warn');
      return;
    }
    try {
      await submitHazardReport(chip.type, lat, lng, userId, groupId, loc?.timestamp_hlc ?? '');
      await triggerClustering(groupId);
      push(`Hazard reported`);
    } catch (e) {
      console.warn('[AlertsScreen] submitHazardReport failed:', e);
      push('Hazard queued — will sync when online', 'warn');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          eyebrow="Live · shared by group"
          title="Road Alerts"
          right={activeCount > 0 ? <LivePill variant="live" label={`${activeCount} ACTIVE`} /> : undefined}
        />

        <View style={styles.chipRow}>
          {CHIPS.map((chip) => (
            <HazardChip key={chip.label} emoji={chip.emoji} label={chip.label} onPress={() => submitReport(chip)} />
          ))}
        </View>

        <View style={styles.cardList}>
          {clusters.map((c) => (
            <AlertCard
              key={c.cluster_id}
              emoji={HAZARD_EMOJI[c.hazard_type] ?? '⚠️'}
              title={`${c.hazard_type.charAt(0).toUpperCase() + c.hazard_type.slice(1)}${c.status === 'resolved' ? ' (Resolved)' : ''}`}
              meta={`by group · ${c.report_count} report${c.report_count !== 1 ? 's' : ''} · score ${Math.round(c.hazard_score * 100)}%`}
              isNew={newIds.has(c.cluster_id)}
            />
          ))}
          {clusters.length === 0 && <Text style={styles.empty}>No alerts yet</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WeRideColors.dark },
  content: { paddingHorizontal: 18, paddingBottom: 20 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  cardList: { gap: 9 },
  empty: { fontFamily: WeRideFonts.body, fontSize: 13, color: WeRideColors.textSub, textAlign: 'center', marginTop: 24 },
});