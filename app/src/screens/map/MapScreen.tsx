/**
 * Live Map (core screen) — owned by Person A (base layer + rider markers).
 * B, C, D register overlays here.
 * Replaces map_screen.dart.
 *
 * Overlays (each owner contributes a child component):
 *   - RiderMarkerOverlay (A) — inside MapView (Mapbox layers)
 *   - RiderInfoCard (A) — outside MapView (React Native View)
 *   - HazardOverlay (B)
 *   - SosOverlay (B)
 *   - RouteOverlay (C)
 *   - VoxOverlay (D)
 *   - FlStatusOverlay (D)
 *
 * Phase 6: TrackingService is constructed and started on MapScreen mount.
 *   - Uses loadHlc() from @tracking/hlcStore (Phase 3) for persistence-aware HLC.
 *   - Reads userId + groupId from useAppStore.
 *   - Stops on unmount (cleanup).
 *   - Does NOT start if groupId or userId is null/empty.
 *
 * Tasks 6.4 / 6.5 (coordination):
 *   - Person C reads the rider's current origin from the Socket.io 'location:update'
 *     event or ridersStore. No new API from Person A is required.
 *   - Person B reads the rider's current verified_location from the same
 *     'location:update' event or ridersStore for attaching to hazard/SOS reports.
 *     No new API from Person A is required.
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import MapboxGL from '@rnmapbox/maps';

import { MAPBOX_TOKEN } from '@env';
import RiderMarkerOverlay, { RiderInfoCard } from './overlays/RiderMarkerOverlay';
import { HazardOverlayMapLayer as HazardOverlay, HazardOverlayInfoCard } from './overlays/HazardOverlay';
import { SosOverlayMapLayer as SosOverlay, SosOverlayInfoCards } from './overlays/SosOverlay';
import RouteOverlay from './overlays/RouteOverlay';
import VoxOverlay from './overlays/VoxOverlay';
import FlStatusOverlay from './overlays/FlStatusOverlay';
import { useAppStore } from '../../store/appStore';

// Phase 6 — tracking service wiring
import { Ekf } from '@tracking/ekf';
import { SensorStream } from '@tracking/sensorStream';
import { LocationPublisher } from '@tracking/locationPublisher';
import { TrackingService } from '@tracking/trackingService';
import { loadHlc } from '@tracking/hlcStore';
import { getLocationSocket } from '../../services/socketService';

MapboxGL.setAccessToken(MAPBOX_TOKEN ?? '');

export default function MapScreen({ route }: any) {
  const groupId = (route?.params?.groupId as string) ?? useAppStore.getState().groupId ?? 'demo-group';
  const userId  = useAppStore.getState().userId;

  // Keep a stable ref to the service so useEffect cleanup can always call .stop()
  const serviceRef = useRef<TrackingService | null>(null);

  useEffect(() => {
    // Guard: do not start tracking without a valid identity.
    // 'demo-group' is allowed for development; null/empty userId is not.
    if (!userId || !groupId) {
      return;
    }

    // Prevent double-start if the effect fires more than once (StrictMode).
    if (serviceRef.current) {
      return;
    }

    const ekf      = new Ekf({ lat: 0, lng: 0 });
    const sensors  = new SensorStream();
    const socket   = getLocationSocket();
    const hlc      = loadHlc();           // Phase 3: restore from MMKV or create fresh

    const publisher = new LocationPublisher({
      socket,
      riderId: userId,
      groupId,
    });

    const service = new TrackingService({ ekf, sensors, publisher, hlc });
    serviceRef.current = service;

    // Start is async; fire-and-forget — permissions flow is handled inside TrackingService.
    service.start().catch((err: unknown) => {
      console.error('[MapScreen] TrackingService.start failed:', err);
    });

    return () => {
      // Stop on unmount (navigation away, app background).
      service.stop().catch((err: unknown) => {
        console.error('[MapScreen] TrackingService.stop failed:', err);
      });
      serviceRef.current = null;
    };
    // groupId and userId are read once on mount; navigation params don't change in-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <MapboxGL.MapView style={styles.map}>
        <MapboxGL.Camera
          defaultSettings={{
            centerCoordinate: [-122.4194, 37.7749],
            zoomLevel: 14,
          }}
        />
        {/* Rider markers — Person A owns this Mapbox overlay */}
        <RiderMarkerOverlay groupId={groupId} />
        {/* TODO: hazard markers (B), route line (C) as Mapbox shape sources */}
      </MapboxGL.MapView>

      {/* UI overlays stacked on top of map */}
      <SosOverlay groupId={groupId} userId={userId ?? undefined} />
      <HazardOverlay groupId={groupId} />
      <VoxOverlay groupId={groupId} />
      <RouteOverlay groupId={groupId} />
      <FlStatusOverlay />
      {/* Rider info card — React Native View outside MapView */}
      <RiderInfoCard />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});