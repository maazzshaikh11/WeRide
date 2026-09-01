/**
 * Mock Hazard Cluster Producer (Phase 1).
 * Generates mock hazard_cluster matching contracts/hazard_cluster.json.
 * For development/testing only. Real implementation comes in later phases.
 */

import { HLC } from '../hlc/hlc';

// Hazard types from contract
const HAZARD_TYPES = ['pothole', 'oil_spill', 'accident', 'debris', 'other'] as const;

/**
 * Generate a mock hazard_cluster matching the exact contract schema.
 * Pure function - no Firebase dependency. Tests use this directly.
 * @param groupId - The group ID for this hazard cluster
 * @returns Generated hazard cluster object
 */
export function generateMockHazardCluster(groupId: string) {
  const hlc = HLC.fresh();
  
  // Generate random values
  const clusterId = `mock_cluster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const hazardType = HAZARD_TYPES[Math.floor(Math.random() * HAZARD_TYPES.length)];
  
  // Random coordinates (roughly within a typical region)
  const baseLat = 37.7749; // San Francisco area as example
  const baseLng = -122.4194;
  const centroidLat = baseLat + (Math.random() - 0.5) * 0.1;
  const centroidLng = baseLng + (Math.random() - 0.5) * 0.1;
  
  // Generate bounding box (4 points around centroid)
  const offset = 0.0005; // roughly 50m
  const polygonPoints: [number, number][] = [
    [centroidLat - offset, centroidLng - offset], // bottom-left
    [centroidLat - offset, centroidLng + offset], // bottom-right
    [centroidLat + offset, centroidLng + offset], // top-right
    [centroidLat + offset, centroidLng - offset], // top-left
  ];
  
  // Random report count (1-5 for mock)
  const reportCount = Math.floor(Math.random() * 5) + 1;
  
  // Calculate hazard score: min(1, reportCount / 5) * recencyDecay
  // For mock, recencyDecay = 1 (just created)
  const hazardScore = Math.min(1.0, reportCount / 5);
  
  const cluster = {
    cluster_id: clusterId,
    group_id: groupId,
    hazard_type: hazardType,
    centroid_lat: centroidLat,
    centroid_lng: centroidLng,
    polygon_points: polygonPoints,
    report_count: reportCount,
    hazard_score: hazardScore,
    created_at_hlc: hlc.now(),
    status: 'active' as const,
  };
  
  return cluster;
}

/**
 * Write a mock hazard cluster to Firestore (Phase 2+).
 * Requires Firebase to be initialized - imported dynamically only when needed.
 * @param groupId - The group ID for this hazard cluster
 * @returns Promise that resolves when written
 */
export async function writeMockHazardCluster(groupId: string): Promise<void> {
  // Lazy-load Firebase only when writing (not for pure mock data generation)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const firestore = require('@react-native-firebase/firestore').default;
  
  const cluster = generateMockHazardCluster(groupId);
  const db = firestore();
  
  // Write to Firestore hazards/{cluster_id} per contract transport
  await db.collection('hazards').doc(cluster.cluster_id).set(cluster);
  
  console.log(`[MockHazardService] Generated mock hazard cluster: ${cluster.cluster_id} (${cluster.hazard_type})`);
}

/**
 * Start periodic mock hazard cluster emission.
 * Emits a new mock cluster approximately every 10 seconds.
 * Requires Firebase to be initialized.
 * @param groupId - The group ID for mock clusters
 * @returns Stop function to clear the interval
 */
export function startMockHazardEmission(groupId: string): () => void {
  const interval = setInterval(() => {
    writeMockHazardCluster(groupId).catch((err) => {
      console.error('[MockHazardService] Failed to write mock cluster:', err);
    });
  }, 10000); // Every 10 seconds
  
  console.log('[MockHazardService] Started mock hazard emission for group:', groupId);
  
  return () => {
    clearInterval(interval);
    console.log('[MockHazardService] Stopped mock hazard emission');
  };
}
