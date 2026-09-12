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
import { View, StyleSheet, Linking, Alert } from 'react-native';
import MapboxGL from '@rnmapbox/maps';

import RoutePanel from '@app/components/RoutePanel';
import { WeRideColors } from '@app/theme/theme';
import { RoutingClient } from '@routing/client/routingClient';
import { useRouteStore } from '@routing/client/routeStore';
import { routeToGeoJsonLine } from '@routing/client/routeLine';
import { googleMapsDeepLink } from '@routing/client/deepLink';
import { VerifiedLocation, verifiedLocationFromJson } from '@app/models/verifiedLocation';
import { HazardCluster, hazardClusterFromJson } from '@app/models/hazardCluster';
import { getLocationSocket } from '@app/services/socketService';
import { firebaseFirestore } from '@app/services/firebaseService';
import { HazardService } from '@hazard/services/hazardService';
import { HLC } from '@hazard/hlc/hlc';

interface Props {
  groupId: string;
}

// Accuracy threshold: only use locations with accuracy < 50m (Phase 6 T-16)
const ACCEPTABLE_ACCURACY_M = 50;
// Distance threshold: only trigger recalc if moved > 100m (Phase 6 T-16)
const RECALC_DISTANCE_THRESHOLD_M = 100;
// Destination: mock for Phase 6 testing (Phase 7 will use real verified_location)
const MOCK_DESTINATION = { lat: 40.7140, lng: -74.0089 };

export default function RouteOverlay({ groupId }: Props) {
  // Store subscriptions
  const route = useRouteStore((state) => state.route);
  const currentLocation = useRouteStore((state) => state.currentLocation);
  const lastValidLocation = useRouteStore((state) => state.lastValidLocation);
  const activeClusters = useRouteStore((state) => state.activeClusters);
  const avoidHazardTypes = useRouteStore((state) => state.avoidHazardTypes);

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
      baseUrl: process.env.SERVER_URL ?? 'http://localhost:3000',
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

        // Trigger recalculation if moved > 100m (prevent jitter storms)
        if (lastValidLocation) {
          client.scheduleOriginRecalcIfMoved(
            { lat: location.lat, lng: location.lng },
            MOCK_DESTINATION,
            groupId,
            avoidHazardTypes,
            RECALC_DISTANCE_THRESHOLD_M
          );
        } else {
          // First valid location, trigger initial route
          client.scheduleRecalculation({
            group_id: groupId,
            origin: { lat: location.lat, lng: location.lng },
            destination: MOCK_DESTINATION,
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
  }, [groupId, client, avoidHazardTypes, lastValidLocation, setCurrentLocation, setLastValidLocation]);

  // Phase 6 T-17: Listen to real hazard_cluster stream (Person B)
  useEffect(() => {
    const hlc = HLC.fresh();
    const hazardService = new HazardService(hlc);
    const unsubscribe = hazardService.watchClusters(groupId).onSnapshot((snapshot: any) => {
      try {
        const clusters = snapshot.docs.map((doc: any) =>
          hazardClusterFromJson(doc.data() as Record<string, any>)
        );
        setActiveClusters(clusters);

        // Trigger recalculation on hazard changes (Phase 6 T-17 marquee test)
        if (lastValidLocation) {
          client.scheduleRecalculation({
            group_id: groupId,
            origin: { lat: lastValidLocation.lat, lng: lastValidLocation.lng },
            destination: MOCK_DESTINATION,
            avoid_hazard_types: avoidHazardTypes,
          });
        }
      } catch (e) {
        console.error('Failed to process hazard update:', e);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [groupId, client, avoidHazardTypes, lastValidLocation, setActiveClusters]);

  // Handle toggle avoid hazards
  const handleToggleAvoidHazards = async () => {
    if (!lastValidLocation) return;

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
        destination: MOCK_DESTINATION,
        avoid_hazard_types: newTypes,
      });
    } catch (e) {
      console.error('Toggle avoid hazards failed:', e);
      Alert.alert('Error', 'Failed to update route');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle open in Google Maps
  const handleOpenInGoogleMaps = async () => {
    if (!route || !lastValidLocation) return;

    try {
      const origin = {
        lat: lastValidLocation.lat,
        lng: lastValidLocation.lng,
      };
      const destination = {
        lat: route.path_points[route.path_points.length - 1][0],
        lng: route.path_points[route.path_points.length - 1][1],
      };

      const url = googleMapsDeepLink(origin, destination);

      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Google Maps is not available on this device');
      }
    } catch (e) {
      console.error('Failed to open Google Maps:', e);
      Alert.alert('Error', 'Failed to open Google Maps');
    }
  };

  // Route line GeoJSON — re-compute when recalculated_at_hlc changes
  const routeGeoJson = useMemo(() => {
    if (!route) return null;
    return routeToGeoJsonLine(route);
  }, [route?.recalculated_at_hlc, route]);

  if (!route) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Route line on map */}
      <MapboxGL.ShapeSource id="routeSource" shape={routeGeoJson}>
        <MapboxGL.LineLayer
          id="routeLine"
          style={{
            lineColor: WeRideColors.accent,
            lineWidth: 4,
            lineOpacity: 0.8,
          }}
        />
      </MapboxGL.ShapeSource>

      {/* Route/ETA panel (bottom sheet) */}
      <View style={styles.panel}>
        <RoutePanel
          etaMinutes={route.eta_minutes}
          distanceKm={route.distance_km}
          safetyScore={route.safety_score}
          avoidHazards={avoidHazardTypes.length > 0}
          onToggleAvoidHazards={handleToggleAvoidHazards}
          onOpenInGoogleMaps={handleOpenInGoogleMaps}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});