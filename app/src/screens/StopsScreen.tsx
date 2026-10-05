/**
 * StopsScreen — planned stops timeline (spec §3.4).
 * Tab 2. Progress bar + vertical stop timeline; tap the next stop → mark reached.
 * Data: useStopsStore, derived from the ride plan (useRidePlanStore).
 *
 * stopsStore always falls back to a single "Destination" stop, even when the
 * ride has no plan. We do not show that placeholder: with no destination and no
 * planned stops the screen renders an empty state instead.
 */
import React, { useEffect } from 'react';
import { ScrollView, View, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WeRideColors, WeRideRadius, WeRideSpacing } from '../theme/theme';
import { type } from '../theme/typography';
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

  const hasPlan = planVersion > 0;
  const shownStops = hasPlan ? stops : [];
  const doneCount = shownStops.filter((s) => s.status === 'done').length;
  const currentStop = shownStops.find((s) => s.status === 'current');

  const onStopPress = (name: string) => {
    markCurrentDone();
    push(`Marked "${name}" as reached`);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <ScreenHeader title="Planned Stops" />

        {shownStops.length === 0 ? (
          <View style={styles.block}>
            <Text style={type.heading}>This ride has no planned stops</Text>
            <Text style={[type.body, styles.blockBody]}>
              Set a destination and stops when you create a ride and they will be listed here.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.progress}>
              <Text style={type.caption}>
                {doneCount} of {shownStops.length} {shownStops.length === 1 ? 'stop' : 'stops'} reached
              </Text>
              <Progressbar completed={doneCount} total={shownStops.length} />
            </View>

            {currentStop ? (
              <Text style={[type.caption, styles.hint]}>
                Tap the next stop when you arrive to mark it as reached.
              </Text>
            ) : null}

            {shownStops.map((stop, i) => {
              // Real straight-line distance from the verified position, when we have one.
              const distKm =
                currentLocation != null && stop.lat != null && stop.lng != null
                  ? haversineMeters(currentLocation.lat, currentLocation.lng, stop.lat, stop.lng) / 1000
                  : null;
              const distText = distKm != null ? `${distKm < 10 ? distKm.toFixed(1) : Math.round(distKm)} km away` : undefined;
              return (
                <StopNode
                  key={stop.id}
                  stop={stop}
                  isLast={i === shownStops.length - 1}
                  info={stop.status === 'done' ? undefined : distText}
                  onPress={stop.status === 'current' ? () => onStopPress(stop.name) : undefined}
                />
              );
            })}

            {!currentStop ? <Text style={[type.bodyStrong, styles.allDone]}>All stops reached</Text> : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WeRideColors.dark },
  scroll: { flex: 1 },
  content: { paddingHorizontal: WeRideSpacing.lg, paddingBottom: WeRideSpacing.xxl },
  progress: { gap: WeRideSpacing.sm, marginBottom: WeRideSpacing.md },
  hint: { marginBottom: WeRideSpacing.lg },
  allDone: { color: WeRideColors.green, marginTop: WeRideSpacing.lg },
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
