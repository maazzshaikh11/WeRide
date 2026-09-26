/**
 * HistoryScreen — ride history tab (spec §3.8).
 * Stats row + history cards. Past ride history is NOT available in any
 * backend per master spec — show active ride from current route data +
 * empty state.
 */
import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WeRideColors, WeRideFonts } from '../theme/theme';
import ScreenHeader from '../components/ScreenHeader';
import StatBox from '../components/StatBox';
import HistoryCard from '../components/HistoryCard';
import { useRouteStore } from '@routing/client/routeStore';
import { useRidersStore } from '../store/ridersStore';
import { useAppStore } from '../store/appStore';

export default function HistoryScreen() {
  const route = useRouteStore((s) => s.route);
  const riders = useRidersStore((s) => s.riders);
  const groupId = useAppStore((s) => s.groupId);

  const hasActiveRide = route != null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader eyebrow="04 — Logbook" title="Ride History" />

        {/* Stats row — data unavailable → "—" per spec §3.8 */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>—</Text>
            <Text style={styles.statLabel}>TOTAL KM</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{hasActiveRide ? '1' : '0'}</Text>
            <Text style={styles.statLabel}>RIDES</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>—</Text>
            <Text style={styles.statLabel}>CITIES</Text>
          </View>
        </View>

        {hasActiveRide ? (
          <HistoryCard
            name={`Ride ${groupId?.slice(0, 8) ?? ''}`}
            meta="In progress · today"
            active
            stats={[
              { label: 'km', value: route.distance_km.toFixed(1) },
              { label: 'min eta', value: String(Math.round(route.eta_minutes)) },
              { label: 'riders', value: String(riders.size) },
            ]}
          />
        ) : null}

        {/* No completed rides backend — empty state per spec */}
        {!hasActiveRide && (
          <Text style={styles.empty}>Your ride history will appear here after you complete your first ride.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WeRideColors.dark },
  content: { paddingHorizontal: 18, paddingBottom: 20 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statBox: {
    flex: 1,
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  statValue: { fontFamily: WeRideFonts.heading, fontSize: 22, color: WeRideColors.primary },
  statLabel: { fontFamily: WeRideFonts.body, fontSize: 8, color: WeRideColors.textSub, marginTop: 2, letterSpacing: 0.5 },
  empty: {
    fontFamily: WeRideFonts.body,
    fontSize: 13,
    color: WeRideColors.textSub,
    textAlign: 'center',
    marginTop: 48,
    paddingHorizontal: 20,
    lineHeight: 19,
  },
});