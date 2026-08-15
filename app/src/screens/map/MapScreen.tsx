/**
 * Live Map (core screen) — owned by Person A (base layer + rider markers).
 * B, C, D register overlays here.
 * Replaces map_screen.dart.
 *
 * Overlays (each owner contributes a child component):
 *   - RiderMarkerOverlay (A)
 *   - HazardOverlay (B)
 *   - SosOverlay (B)
 *   - RouteOverlay (C)
 *   - VoxOverlay (D)
 *   - FlStatusOverlay (D)
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapboxGL from '@rnmapbox/maps';

import RiderMarkerOverlay from './overlays/RiderMarkerOverlay';
import HazardOverlay from './overlays/HazardOverlay';
import SosOverlay from './overlays/SosOverlay';
import RouteOverlay from './overlays/RouteOverlay';
import VoxOverlay from './overlays/VoxOverlay';
import FlStatusOverlay from './overlays/FlStatusOverlay';
import { useAppStore } from '../../store/appStore';

MapboxGL.setAccessToken(process.env.MAPBOX_TOKEN ?? ''); // TODO: set at build time

export default function MapScreen({ route }: any) {
  const groupId = (route?.params?.groupId as string) ?? useAppStore.getState().groupId ?? 'demo-group';

  return (
    <View style={styles.container}>
      {/* Base map layer — Person A owns this */}
      <MapboxGL.MapView style={styles.map}>
        {/* TODO: rider markers (A), hazard markers (B), route line (C) as Mapbox shape sources */}
      </MapboxGL.MapView>

      {/* Overlays stacked on top */}
      <SosOverlay groupId={groupId} />
      <HazardOverlay groupId={groupId} />
      <VoxOverlay groupId={groupId} />
      <RouteOverlay groupId={groupId} />
      <FlStatusOverlay />
      <RiderMarkerOverlay groupId={groupId} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});