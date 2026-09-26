/**
 * StopsScreen — planned stops timeline (spec §3.4).
 * Tab 2. Progress bar + vertical stop timeline; tap current stop → mark done.
 * Data: useStopsStore (stub for now per master spec).
 */
import React, { useEffect } from 'react';
import { ScrollView, View, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WeRideColors, WeRideFonts } from '../theme/theme';
import ScreenHeader from '../components/ScreenHeader';
import Progressbar from '../components/Progressbar';
import StopNode from '../components/StopNode';
import { useStopsStore } from '../store/stopsStore';
import { useRidePlanStore } from '../store/ridePlanStore';
import { useToastStore } from '../store/toastStore';
import { useRouteStore } from '@routing/client/routeStore';
import { haversineMeters } from '../utils/geoUtils';

export default function StopsScreen() {
  const stops = useStopsStore((s) => s.stops);
  const markCurrentDone = useStopsStore((s) => s.markCurrentDone);
  const syncFromPlan = useStopsStore((s) => s.syncFromPlan);
  const planVersion = useRidePlanStore((s) => s.stops.length + (s.destination ? 1 : 0));
  const currentLocation = useRouteStore((s) => s.currentLocation);
  const push = useToastStore((s) => s.push);

  // Re-sync the timeline whenever the ride plan changes
  useEffect(() => {
    syncFromPlan();
  }, [planVersion, syncFromPlan]);

  const doneCount = stops.filter((s) => s.status === 'done').length;
  const currentStop = stops.find((s) => s.status === 'current');

  const onStopPress = (name: string, isCurrent: boolean) => {
    if (!isCurrent) return;
    markCurrentDone();
    push(`✅ Marked "${name}" as reached`);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <ScreenHeader
          eyebrow="02 — Route"
          title="Planned Stops"
        />
        <Progressbar completed={doneCount} total={stops.length} />
        {stops.map((stop, i) => {
          // Demo info pattern: "12 km · next stop" / "19 km away" (real distances).
          const distKm =
            currentLocation != null && stop.lat != null && stop.lng != null
              ? haversineMeters(currentLocation.lat, currentLocation.lng, stop.lat, stop.lng) / 1000
              : null;
          const distText = distKm != null ? `${distKm < 10 ? distKm.toFixed(1) : Math.round(distKm)} km` : null;
          const info =
            stop.status === 'done'
              ? 'reached'
              : stop.status === 'current'
                ? distText ? `${distText} · next stop` : 'next stop'
                : distText ? `${distText} away` : 'upcoming';
          return (
            <StopNode
              key={stop.id}
              stop={stop}
              isLast={i === stops.length - 1}
              info={info}
              onPress={stop.status === 'current' ? () => onStopPress(stop.name, true) : undefined}
            />
          );
        })}
        {!currentStop && stops.length > 0 && (
          <Text style={styles.allDone}>All stops reached 🏁</Text>
        )}
        {stops.length === 0 && <Text style={styles.empty}>No stops yet</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WeRideColors.dark },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 20 },
  counter: { fontFamily: WeRideFonts.mono, fontSize: 10, color: WeRideColors.textSub },
  allDone: {
    fontFamily: WeRideFonts.body,
    fontSize: 13,
    color: WeRideColors.green,
    textAlign: 'center',
    marginTop: 8,
  },
  empty: {
    fontFamily: WeRideFonts.body,
    fontSize: 13,
    color: WeRideColors.textSub,
    textAlign: 'center',
    marginTop: 32,
  },
});