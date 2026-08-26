/**
 * Route/ETA panel overlay — owned by Person C.
 * Bottom sheet on the map: collapsed shows ETA + distance + safety bar;
 * expanded shows turn list + "Open in Google Maps" deep link.
 * Auto-updates when route_response changes (no manual refresh).
 * "Avoid hazards" toggle.
 *
 * Integrates:
 * - RoutingClient for POST /route calls
 * - useRouteStore for shared route state
 * - routeToGeoJsonLine for path_points → Mapbox GeoJSON
 * - googleMapsDeepLink for deep-link generation
 * - Mapbox ShapeSource + LineLayer for route visualization
 */
import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Linking, Alert } from 'react-native';
import MapboxGL from '@rnmapbox/maps';

import RoutePanel from '@app/components/RoutePanel';
import { RoutingClient } from '@routing/client/routingClient';
import { useRouteStore } from '@routing/client/routeStore';
import { routeToGeoJsonLine } from '@routing/client/routeLine';
import { googleMapsDeepLink } from '@routing/client/deepLink';

interface Props {
  groupId: string;
}

export default function RouteOverlay({ groupId }: Props) {
  // Store subscriptions
  const route = useRouteStore((state) => state.route);
  const avoidHazardTypes = useRouteStore((state) => state.avoidHazardTypes);
  const setRoute = useRouteStore((state) => state.setRoute);
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

  // Initial route request on mount
  useEffect(() => {
    const fetchInitialRoute = async () => {
      try {
        setIsLoading(true);
        // Mock origin/destination for Phase 5 UI testing
        // Phase 6 will use real verified_location
        const mockOrigin = { lat: 40.7128, lng: -74.006 };
        const mockDestination = { lat: 40.7140, lng: -74.0089 };

        await client.requestRoute({
          group_id: groupId,
          origin: mockOrigin,
          destination: mockDestination,
          avoid_hazard_types: avoidHazardTypes,
        });
      } catch (e) {
        console.error('Route request failed:', e);
        Alert.alert('Error', 'Failed to fetch route');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialRoute();
  }, [groupId, client, setIsLoading, avoidHazardTypes]);

  // Handle toggle avoid hazards
  const handleToggleAvoidHazards = async () => {
    if (!route) return;

    try {
      setIsLoading(true);

      // Toggle between all hazards and none
      const newTypes = avoidHazardTypes.length === 0
        ? ['pothole', 'oil_spill', 'accident', 'debris', 'other']
        : [];

      setAvoidHazardTypes(newTypes);

      // Use current route origin/destination
      const origin = {
        lat: route.path_points[0][0],
        lng: route.path_points[0][1],
      };
      const destination = {
        lat: route.path_points[route.path_points.length - 1][0],
        lng: route.path_points[route.path_points.length - 1][1],
      };

      // Debounced request (500ms)
      client.scheduleRecalculation({
        group_id: groupId,
        origin,
        destination,
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
    if (!route) return;

    try {
      const origin = {
        lat: route.path_points[0][0],
        lng: route.path_points[0][1],
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
            lineColor: '#40916C',
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