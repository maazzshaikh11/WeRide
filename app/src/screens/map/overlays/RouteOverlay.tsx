/**
 * Route/ETA panel overlay — owned by Person C.
 * Bottom sheet on the map: collapsed shows ETA + distance + safety bar;
 * expanded shows turn list + "Open in Google Maps" deep link.
 * Auto-updates when route_response changes (no manual refresh).
 * "Avoid hazards" toggle.
 *
 * Phase 6: Integrates real Person A (verified_location) and Person B (hazard_cluster) streams.
 * - Origin: Real EKF-verified location from Person A (Socket.io location:update)
 * - Hazards: Real active clusters from Person B (Firestore listener)
 * - Prevents origin churn: Only recalcs when moved > 100m
 */
import React, { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import MapboxGL from '@rnmapbox/maps';

import { WeRideColors } from '@app/theme/theme';
import { ROUTING_URL } from '@env';
import { RoutingClient } from '@routing/client/routingClient';
import { useRouteStore } from '@routing/client/routeStore';
import { routeToGeoJsonLine } from '@routing/client/routeLine';
import { VerifiedLocation, verifiedLocationFromJson } from '@app/models/verifiedLocation';
import { HazardCluster } from '@app/models/hazardCluster';
import { getLocationSocket } from '@app/services/socketService';
import { subscribeToHazardClusters } from '@hazard/services/hazardService';
import { useRidePlanStore } from '@app/store/ridePlanStore';
import { registerToggleAvoidHazards } from './routeControls';

interface Props {
  groupId: string;
}

// Accuracy threshold: only use locations with accuracy < 50m (Phase 6 T-16)
const ACCEPTABLE_ACCURACY_M = 50;
// Distance threshold: only trigger recalc if moved > 100m (Phase 6 T-16)
const RECALC_DISTANCE_THRESHOLD_M = 100;

export default function RouteOverlay({ groupId }: Props) {
  // Store subscriptions
  const route = useRouteStore((state) => state.route);
  const currentLocation = useRouteStore((state) => state.currentLocation);
  const lastValidLocation = useRouteStore((state) => state.lastValidLocation);
  const activeClusters = useRouteStore((state) => state.activeClusters);
  const avoidHazardTypes = useRouteStore((state) => state.avoidHazardTypes);

  // Ride plan (Create Ride modal) — destination chosen by the user
  const destination = useRidePlanStore((s) => s.destination);

  const setRoute = useRouteStore((state) => state.setRoute);
  const setCurrentLocation = useRouteStore((state) => state.setCurrentLocation);
  const setLastValidLocation = useRouteStore((state) => state.setLastValidLocation);
  const setActiveClusters = useRouteStore((state) => state.setActiveClusters);
  const setAvoidHazardTypes = useRouteStore((state) => state.setAvoidHazardTypes);
  const setIsLoading = useRouteStore((state) => state.setIsLoading);

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

  // Phase 6 T-16: Listen to real verified_location stream (Person A)
  useEffect(() => {
    const socket = getLocationSocket();

    const handleLocationUpdate = (payload: any) => {
      try {
        const location = verifiedLocationFromJson(payload);

        // Only accept non-spoofed locations with acceptable accuracy
        if (location.spoof_flag) {
          console.warn('Location spoofed, skipping origin update');
          return;
        }

        if (location.accuracy_m > ACCEPTABLE_ACCURACY_M) {
          console.warn(`Location accuracy too poor (${location.accuracy_m}m > ${ACCEPTABLE_ACCURACY_M}m), skipping`);
          return;
        }

        // Update current location
        setCurrentLocation(location);
        setLastValidLocation(location);

        // No destination chosen yet (Create Ride modal) — nothing to route to.
        if (!destination) return;

        // Trigger recalculation if moved > 100m (prevent jitter storms)
        if (lastValidLocation) {
          client.scheduleOriginRecalcIfMoved(
            { lat: location.lat, lng: location.lng },
            destination,
            groupId,
            avoidHazardTypes,
            RECALC_DISTANCE_THRESHOLD_M
          );
        } else {
          // First valid location, trigger initial route
          client.scheduleRecalculation({
            group_id: groupId,
            origin: { lat: location.lat, lng: location.lng },
            destination,
            avoid_hazard_types: avoidHazardTypes,
          });
        }
      } catch (e) {
        console.error('Failed to process location update:', e);
      }
    };

    socket.on('location:update', handleLocationUpdate);

    return () => {
      socket.off('location:update', handleLocationUpdate);
    };
  }, [groupId, client, avoidHazardTypes, lastValidLocation, destination, setCurrentLocation, setLastValidLocation]);

  // Phase 6 T-17: Listen to real hazard_cluster stream (Person B)
  useEffect(() => {
    const unsubscribe = subscribeToHazardClusters(groupId, (clusters: HazardCluster[]) => {
      setActiveClusters(clusters);

      // Trigger recalculation on hazard changes (Phase 6 T-17 marquee test)
      if (lastValidLocation && destination) {
        client.scheduleRecalculation({
          group_id: groupId,
          origin: { lat: lastValidLocation.lat, lng: lastValidLocation.lng },
          destination,
          avoid_hazard_types: avoidHazardTypes,
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [groupId, client, avoidHazardTypes, lastValidLocation, destination, setActiveClusters]);

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

  if (!route) {
    return null;
  }

  // Route line only — the bottom sheet (RoutePanel) is rendered by MapScreen.
  return (
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
  );
}

const styles = StyleSheet.create({});