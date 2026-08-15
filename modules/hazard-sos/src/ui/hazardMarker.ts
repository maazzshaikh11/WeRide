/**
 * Hazard marker overlay for Mapbox.
 * Renders from hazard_cluster Firestore listener. Color by hazard_type.
 * Tap → info card (type, report_count, hazard_score, status).
 * Resolved → faded color.
 * Ported from hazard_marker.dart.
 *
 * TODO: wire to HazardService.watchClusters stream, render Mapbox ShapeSources
 */

import type { HazardType } from '../dbscan/dbscan';

export interface HazardMarkerData {
  clusterId: string;
  hazardType: HazardType;
  lat: number;
  lng: number;
  reportCount: number;
  hazardScore: number;
  status: 'active' | 'resolved';
}

/** Returns a hex color for the marker from the shared theme. */
export function hazardMarkerColor(marker: HazardMarkerData): string {
  // Lazy import to avoid pulling the theme in test environments.
  // In RN, the theme module is always available.
  const { hazardColor } = require('@app/theme/theme') as typeof import('@app/theme/theme');
  if (marker.status === 'resolved') return marker.status;
  return hazardColor(marker.hazardType);
}