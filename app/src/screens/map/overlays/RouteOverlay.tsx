/**
 * Route/ETA panel overlay — owned by Person C.
 * Bottom sheet on the map: collapsed shows ETA + distance + safety bar;
 * expanded shows turn list + "Open in Google Maps" deep link.
 * Auto-updates when route_response changes (no manual refresh).
 * "Avoid hazards" toggle.
 *
 * Phase 6: Integrates real Person A (verified_location) and Person B (hazard_cluster) streams.
 * - Origin: the rider's own EKF-verified fix from Person A (via OwnLocationPublisher)
 * - Hazards: Real active clusters from Person B (Firestore listener)
 * - Prevents origin churn: Only recalcs when moved > 100m
 */
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapboxGL from '@rnmapbox/maps';

import { WeRideColors } from '@app/theme/theme';
import { ROUTING_URL } from '@env';
import { RoutingClient } from '@routing/client/routingClient';
import { useRouteStore } from '@routing/client/routeStore';
import { routeToGeoJsonLine } from '@routing/client/routeLine';
import { HazardCluster } from '@app/models/hazardCluster';
import { subscribeToHazardClusters } from '@hazard/services/hazardService';
import { useRidePlanStore } from '@app/store/ridePlanStore';
import { registerToggleAvoidHazards } from './routeControls';

interface Props {
  groupId: string;
}

// Distance threshold: only trigger recalc if moved > 100m (Phase 6 T-16)
const RECALC_DISTANCE_THRESHOLD_M = 100;

export default function RouteOverlay({ groupId }: Props) {
  // Store subscriptions
  const route = useRouteStore((state) => state.route);
  const lastValidLocation = useRouteStore((state) => state.lastValidLocation);
  const activeClusters = useRouteStore((state) => state.activeClusters);
  const avoidHazardTypes = useRouteStore((state) => state.avoidHazardTypes);

  // Ride plan (Create Ride modal) — destination chosen by the user
  const destination = useRidePlanStore((s) => s.destination);
  const planStart = useRidePlanStore((s) => s.start);
  const planStops = useRidePlanStore((s) => s.stops);

  const setRoute = useRouteStore((state) => state.setRoute);
  const setActiveClusters = useRouteStore((state) => state.setActiveClusters);
  const setAvoidHazardTypes = useRouteStore((state) => state.setAvoidHazardTypes);
  const setIsLoading = useRouteStore((state) => state.setIsLoading);

  // Live hazard clusters → the shape POST /route expects (C-P0-5).
  const activeHazards = React.useMemo(
    () =>
      activeClusters.map((c) => ({
        centroid_lat: c.centroid_lat,
        centroid_lng: c.centroid_lng,
        hazard_type: c.hazard_type,
        hazard_score: c.hazard_score,
      })),
    [activeClusters]
  );

  // RoutingClient instance
  const clientRef = React.useRef<RoutingClient | null>(null);
  if (!clientRef.current) {
    clientRef.current = new RoutingClient({
      // Physical devices cannot reach the dev machine's localhost.
      // Set ROUTING_URL (e.g. http://<LAN-IP>:3000) in app/.env for real devices.
      baseUrl: ROUTING_URL || 'http://10.0.2.2:3000',
      onUpdate: (r) => setRoute(r),
    });
  }
  const client = clientRef.current;

  // Latest route inputs for callbacks that must not re-subscribe on every fix.
  const latestRef = React.useRef({
    origin: null as { lat: number; lng: number } | null,
    destination,
    avoidHazardTypes,
  });
  latestRef.current = {
    origin: lastValidLocation ? { lat: lastValidLocation.lat, lng: lastValidLocation.lng } : null,
    destination,
    avoidHazardTypes,
  };

  // Route origin = the rider's OWN verified fix. MapScreen's OwnLocationPublisher
  // writes it to the route store (the socket never echoes our own fix back, and
  // other riders' fixes must never become our origin).
  const lastDestKey = React.useRef<string | null>(null);
  useEffect(() => {
    // No fix yet, or no destination chosen in the Create Ride modal.
    if (!lastValidLocation || !destination) return;
    const origin = { lat: lastValidLocation.lat, lng: lastValidLocation.lng };

    // New/changed destination → always recompute; the origin-moved gate below
    // would otherwise keep serving a route to the previous destination.
    const destKey = `${destination.lat},${destination.lng}`;
    if (lastDestKey.current !== destKey) {
      lastDestKey.current = destKey;
      client.scheduleRecalculation({
        group_id: groupId,
        origin,
        destination,
        avoid_hazard_types: avoidHazardTypes,
        active_hazards: activeHazards,
      });
      return;
    }

    // Same destination: only recalc once the rider has moved > 100m (jitter guard).
    client.scheduleOriginRecalcIfMoved(
      origin,
      destination,
      groupId,
      avoidHazardTypes,
      RECALC_DISTANCE_THRESHOLD_M,
      activeHazards
    );
  }, [groupId, client, avoidHazardTypes, activeHazards, lastValidLocation, destination]);

  // Phase 6 T-17: Listen to real hazard_cluster stream (Person B).
  // Subscribes once per group; reads current origin/destination from latestRef
  // so a 1 Hz location stream does not tear down the Firestore listener.
  useEffect(() => {
    const unsubscribe = subscribeToHazardClusters(groupId, (clusters: HazardCluster[]) => {
      setActiveClusters(clusters);

      // Trigger recalculation on hazard changes (Phase 6 T-17 marquee test)
      const { origin, destination: dest, avoidHazardTypes: avoid } = latestRef.current;
      if (origin && dest) {
        client.scheduleRecalculation({
          group_id: groupId,
          origin,
          destination: dest,
          avoid_hazard_types: avoid,
          active_hazards: clusters.map((c) => ({
            centroid_lat: c.centroid_lat,
            centroid_lng: c.centroid_lng,
            hazard_type: c.hazard_type,
            hazard_score: c.hazard_score,
          })),
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [groupId, client, setActiveClusters]);

  // Handle toggle avoid hazards (invoked from MapScreen's RoutePanel via routeControls)
  const handleToggleAvoidHazards = async () => {
    if (!lastValidLocation || !destination) return;

    try {
      setIsLoading(true);

      // Toggle between all hazards and none
      const newTypes = avoidHazardTypes.length === 0
        ? ['pothole', 'oil_spill', 'accident', 'debris', 'other']
        : [];

      setAvoidHazardTypes(newTypes);

      // Trigger recalculation with new avoid types
      client.scheduleRecalculation({
        group_id: groupId,
        origin: { lat: lastValidLocation.lat, lng: lastValidLocation.lng },
        destination,
        avoid_hazard_types: newTypes,
        active_hazards: activeHazards,
      });
    } catch (e) {
      console.error('Toggle avoid hazards failed:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Register the avoid-hazards toggle so MapScreen's RoutePanel can call it.
  useEffect(() => {
    registerToggleAvoidHazards(handleToggleAvoidHazards);
  });

  // Route line GeoJSON — re-compute when recalculated_at_hlc changes
  const routeGeoJson = useMemo(() => {
    if (!route) return null;
    return routeToGeoJsonLine(route);
  }, [route?.recalculated_at_hlc, route]);

  // Stop pins from the ride plan (demo shows numbered/emoji pins on the map).
  const stopPins = useMemo(() => {
    const pins: { id: string; lat: number; lng: number; icon: string; label: string }[] = [];
    if (planStart) pins.push({ id: 'plan-start', lat: planStart.lat, lng: planStart.lng, icon: '🟢', label: planStart.label });
    planStops.forEach((s, i) =>
      pins.push({ id: s.id, lat: s.lat, lng: s.lng, icon: s.icon || `${i + 1}️⃣`, label: s.label })
    );
    if (destination) pins.push({ id: 'plan-destination', lat: destination.lat, lng: destination.lng, icon: '🏁', label: destination.label });
    return pins;
  }, [planStart, planStops, destination]);

  // Route line + stop pins — the bottom sheet (RoutePanel) is rendered by MapScreen.
  return (
    <>
      {routeGeoJson && (
        <MapboxGL.ShapeSource id="routeSource" shape={routeGeoJson as any}>
          <MapboxGL.LineLayer
            id="routeLine"
            style={{
              lineColor: WeRideColors.primary,
              lineWidth: 4,
              lineOpacity: 0.8,
            }}
          />
        </MapboxGL.ShapeSource>
      )}
      {stopPins.map((pin) => (
        <MapboxGL.PointAnnotation
          key={pin.id}
          id={pin.id}
          coordinate={[pin.lng, pin.lat]}
          title={pin.label}
        >
          <View style={styles.pin}>
            <Text style={styles.pinIcon}>{pin.icon}</Text>
          </View>
        </MapboxGL.PointAnnotation>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  pin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: WeRideColors.dark2,
    borderWidth: 2,
    borderColor: WeRideColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinIcon: { fontSize: 14 },
});