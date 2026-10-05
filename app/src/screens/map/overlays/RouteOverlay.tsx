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
import MapboxGL from '@rnmapbox/maps';

import { ROUTING_BASE_URL } from '@app/services/endpoints';
import { RoutingClient } from '@routing/client/routingClient';
import { useRouteStore } from '@routing/client/routeStore';
import { routeToGeoJsonLine } from '@routing/client/routeLine';
import { HazardCluster } from '@app/models/hazardCluster';
import { subscribeToHazardClusters } from '@hazard/services/hazardService';
import { useRidePlanStore } from '@app/store/ridePlanStore';
import { registerToggleAvoidHazards } from './routeControls';
import { buildRidePins, routeLatLngs } from '../rideGeometry';
import { ROUTE_CASING_COLOR, ROUTE_COLOR, PIN_DARK, PIN_LIGHT } from '../mapStyle';

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
      // Platform-aware dev default (see endpoints.ts). Physical devices: set
      // ROUTING_URL (e.g. http://<LAN-IP>:3000) in app/.env.
      baseUrl: ROUTING_BASE_URL,
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
      // Drop the route to the previous destination so it is neither drawn nor
      // used to frame the camera while the new one is being fetched.
      setRoute(null);
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
  }, [groupId, client, avoidHazardTypes, activeHazards, lastValidLocation, destination, setRoute]);

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
    if (!route || routeLatLngs(route).length < 2) return null;
    return routeToGeoJsonLine(route);
  }, [route?.recalculated_at_hlc, route]);

  // Start / numbered stops / destination from the ride plan (real data only).
  const pins = useMemo(
    () =>
      buildRidePins(
        { start: planStart, stops: planStops, destination },
        route,
      ),
    [planStart, planStops, destination, route],
  );

  // Draw order = z-order: casing < route < pins < labels.
  return (
    <>
      {routeGeoJson && (
        <MapboxGL.ShapeSource id="routeSource" shape={routeGeoJson as any}>
          <MapboxGL.LineLayer
            id="routeCasing"
            style={{
              lineColor: ROUTE_CASING_COLOR,
              lineWidth: ['interpolate', ['linear'], ['zoom'], 6, 4, 12, 8, 17, 13],
              lineCap: 'round',
              lineJoin: 'round',
              lineOpacity: 0.9,
            }}
          />
          <MapboxGL.LineLayer
            id="routeLine"
            aboveLayerID="routeCasing"
            style={{
              lineColor: ROUTE_COLOR,
              lineWidth: ['interpolate', ['linear'], ['zoom'], 6, 2.5, 12, 5, 17, 9],
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </MapboxGL.ShapeSource>
      )}
      {pins.features.length > 0 && (
        <MapboxGL.ShapeSource id="ridePinsSource" shape={pins as any}>
          {/* Stops: dark disc, ember ring, number inside */}
          <MapboxGL.CircleLayer
            id="pinStop"
            filter={['==', ['get', 'kind'], 'stop']}
            style={{
              circleRadius: 10,
              circleColor: PIN_DARK,
              circleStrokeColor: ROUTE_COLOR,
              circleStrokeWidth: 2,
            }}
          />
          <MapboxGL.SymbolLayer
            id="pinStopNumber"
            filter={['==', ['get', 'kind'], 'stop']}
            style={{
              textField: ['get', 'n'],
              textSize: 11,
              textColor: PIN_LIGHT,
              textFont: ['DIN Pro Bold', 'Arial Unicode MS Bold'],
              textAllowOverlap: true,
            }}
          />
          {/* Start: white disc, ember ring */}
          <MapboxGL.CircleLayer
            id="pinStart"
            filter={['==', ['get', 'kind'], 'start']}
            style={{
              circleRadius: 8,
              circleColor: PIN_LIGHT,
              circleStrokeColor: ROUTE_COLOR,
              circleStrokeWidth: 4,
            }}
          />
          {/* Destination: ember disc inside a white ring — larger than the start */}
          <MapboxGL.CircleLayer
            id="pinEndRing"
            filter={['==', ['get', 'kind'], 'end']}
            style={{ circleRadius: 14, circleColor: PIN_LIGHT }}
          />
          <MapboxGL.CircleLayer
            id="pinEnd"
            filter={['==', ['get', 'kind'], 'end']}
            style={{ circleRadius: 9.5, circleColor: ROUTE_COLOR }}
          />
          <MapboxGL.SymbolLayer
            id="pinLabels"
            filter={['!=', ['get', 'kind'], 'stop']}
            style={{
              textField: ['get', 'label'],
              textSize: 12,
              textColor: PIN_LIGHT,
              textHaloColor: PIN_DARK,
              textHaloWidth: 1.5,
              textFont: ['DIN Pro Medium', 'Arial Unicode MS Regular'],
              textAnchor: 'top',
              textOffset: [0, 1.4],
              textMaxWidth: 8,
              textOptional: true,
            }}
          />
        </MapboxGL.ShapeSource>
      )}
    </>
  );
}
