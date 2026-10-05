/**
 * HistoryScreen — ride history tab (spec §3.8).
 *
 * Known gap: no backend stores completed rides, so past rides cannot be listed.
 * Needs `GET /users/{uid}/rides` (completed rides with distance, duration,
 * rider count, date). Until then this screen shows only the ride in progress
 * (from the live route) or an honest empty state. No totals are shown because
 * none can be computed from real data.
 */
import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WeRideColors, WeRideRadius, WeRideSpacing } from '../theme/theme';
import { type } from '../theme/typography';
import ScreenHeader from '../components/ScreenHeader';
import HistoryCard from '../components/HistoryCard';
import { useRouteStore } from '@routing/client/routeStore';
import { useRidersStore } from '../store/ridersStore';
import { useAppStore } from '../store/appStore';

export default function HistoryScreen() {
  const route = useRouteStore((s) => s.route);
  const riders = useRidersStore((s) => s.riders);
  const groupId = useAppStore((s) => s.groupId);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Ride History" />

        {route != null ? (
          <View style={styles.stack}>
          <HistoryCard
            name={`Ride ${groupId?.slice(0, 8) ?? ''}`.trim()}
            meta="In progress"
            active
            stats={[
              { label: 'km', value: route.distance_km.toFixed(1) },
              { label: 'min eta', value: String(Math.round(route.eta_minutes)) },
              { label: 'riders', value: String(riders.size) },
            ]}
          />
          <Text style={type.caption}>Completed rides are not saved yet, so only this ride is shown.</Text>
          </View>
        ) : (
          <View style={styles.block}>
            <Text style={type.heading}>No completed rides yet</Text>
            <Text style={[type.body, styles.blockBody]}>Rides you finish will be listed here.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WeRideColors.dark },
  content: { paddingHorizontal: WeRideSpacing.lg, paddingBottom: WeRideSpacing.xxl },
  stack: { gap: WeRideSpacing.md },
  block: {
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: WeRideRadius.xl,
    padding: WeRideSpacing.lg,
    gap: WeRideSpacing.xs,
  },
  blockBody: { color: WeRideColors.textSub },
});
