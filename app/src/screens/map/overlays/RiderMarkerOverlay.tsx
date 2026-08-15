/**
 * Rider markers overlay — owned by Person A.
 * Renders rider markers on the map, color-coded by spoof_flag:
 *   green = verified, red = flagged, grey = stale (>10s old)
 *
 * TODO: wire to Socket.io location:update listener, render Mapbox shape sources
 */
import React from 'react';
import { View } from 'react-native';

export default function RiderMarkerOverlay({ groupId }: { groupId: string }) {
  // Placeholder — real implementation renders Mapbox CircleLayers for each rider
  return <View />;
}