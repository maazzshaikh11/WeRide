/**
 * DBSCAN clustering for hazard reports.
 * Pure logic — no Firestore, no RN. Testable standalone.
 * Ported from dbscan.dart.
 *
 * Clusters nearby reports of the same hazard_type.
 * Reports near a cluster boundary must cluster together (density-reachable).
 */

export interface HazardReport {
  report_id: string;
  rider_id: string;
  group_id: string;
  hazard_type: string;
  lat: number;
  lng: number;
  timestamp_hlc: string;
  reported_at_hlc: string;
}

export interface DBCluster {
  reports: HazardReport[];
  cluster_id: string;
}

/** @deprecated Use HazardReport (snake_case) instead. Kept for backward compatibility. */
export interface HazardReportLegacy {
  reportId: string;
  riderId: string;
  groupId: string;
  hazardType: string;
  lat: number;
  lng: number;
  timestampHlc: string;
  reportedAtHlc: string;
}

/** @deprecated Use DBCluster instead. Kept for backward compatibility. */
export interface HazardClusterResult {
  clusterId: string;
  hazardType: string;
  centroidLat: number;
  centroidLng: number;
  polygonPoints: number[][];
  reportCount: number;
  reports: HazardReportLegacy[];
}

/** @deprecated Use calculateHazardScore instead. Kept for backward compatibility. */
export function hazardScore(
  reportCount: number,
  createdAt: Date,
  now?: Date
): number {
  const n = now ?? new Date();
  const ageMin = (n.getTime() - createdAt.getTime()) / 60000;
  const recencyDecay = Math.max(0, 1 - ageMin / 60.0);
  return Math.min(1.0, reportCount / 5.0) * recencyDecay;
}

/** @deprecated Use clusterByType instead. Kept for backward compatibility. */
export function dbscanByType(
  reports: HazardReportLegacy[],
  params: { epsMeters: number; minSamples: number; newClusterId: () => string }
): HazardClusterResult[] {
  const adaptedReports: HazardReport[] = reports.map(r => ({
    report_id: r.reportId,
    rider_id: r.riderId,
    group_id: r.groupId,
    hazard_type: r.hazardType,
    lat: r.lat,
    lng: r.lng,
    timestamp_hlc: r.timestampHlc,
    reported_at_hlc: r.reportedAtHlc,
  }));
  const clusters = clusterByType(adaptedReports, params.epsMeters, params.minSamples);
  return clusters.map(c => ({
    clusterId: c.cluster_id,
    hazardType: c.reports[0]?.hazard_type ?? '',
    centroidLat: calculateCentroid(c.reports).lat,
    centroidLng: calculateCentroid(c.reports).lng,
    polygonPoints: calculateBoundingBox(c.reports),
    reportCount: c.reports.length,
    reports: c.reports.map(r => ({
      reportId: r.report_id,
      riderId: r.rider_id,
      groupId: r.group_id,
      hazardType: r.hazard_type,
      lat: r.lat,
      lng: r.lng,
      timestampHlc: r.timestamp_hlc,
      reportedAtHlc: r.reported_at_hlc,
    })),
  }));
}

/** @deprecated HazardType enum kept for backward compatibility. Use string hazard_type values. */
export type HazardType = 'pothole' | 'oil_spill' | 'accident' | 'debris' | 'other';

const EARTH_RADIUS_METERS = 6371000;

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Haversine distance in meters between two lat/lng points.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
}

/**
 * Standard DBSCAN algorithm using Haversine distance.
 * Noise points become single-report clusters (not discarded).
 * Does not mutate the input reports.
 */
export function dbscan(
  reports: HazardReport[],
  eps = 30,
  minSamples = 2
): DBCluster[] {
  if (reports.length === 0) return [];

  const visited = new Array(reports.length).fill(false);
  const clusterLabels = new Array(reports.length).fill(-1);
  const clusters: DBCluster[] = [];
  let clusterIdx = 0;

  const rangeQuery = (idx: number): number[] => {
    const center = reports[idx];
    const result: number[] = [];
    for (let i = 0; i < reports.length; i++) {
      if (i === idx) continue;
      if (reports[i].hazard_type !== center.hazard_type) continue;
      const d = haversineDistance(
        center.lat,
        center.lng,
        reports[i].lat,
        reports[i].lng
      );
      if (d <= eps) result.push(i);
    }
    return result;
  };

  const expandCluster = (startIdx: number, neighbors: number[]): number[] => {
    const clusterMembers = [startIdx];
    const queue = [...neighbors];

    while (queue.length > 0) {
      const q = queue.shift()!;
      if (!visited[q]) {
        visited[q] = true;
        const qNeighbors = rangeQuery(q);
        if (qNeighbors.length + 1 >= minSamples) {
          for (const n of qNeighbors) {
            if (!queue.includes(n) && clusterLabels[n] === -1) {
              queue.push(n);
            }
          }
        }
      }
      if (clusterLabels[q] === -1) {
        clusterLabels[q] = clusterIdx;
        clusterMembers.push(q);
      }
    }
    return clusterMembers;
  };

  for (let i = 0; i < reports.length; i++) {
    if (visited[i]) continue;
    visited[i] = true;
    const neighbors = rangeQuery(i);

    if (neighbors.length + 1 < minSamples) {
      clusterLabels[i] = clusterIdx;
      clusters.push({
        reports: [reports[i]],
        cluster_id: `cluster_${clusterIdx}`,
      });
      clusterIdx++;
    } else {
      clusterLabels[i] = clusterIdx;
      const members = expandCluster(i, neighbors);
      clusters.push({
        reports: members.map((idx) => reports[idx]),
        cluster_id: `cluster_${clusterIdx}`,
      });
      clusterIdx++;
    }
  }

  return clusters;
}

/**
 * Group reports by hazard_type, then run DBSCAN independently per type.
 */
export function clusterByType(
  reports: HazardReport[],
  eps: number,
  minSamples: number
): DBCluster[] {
  const byType = new Map<string, HazardReport[]>();
  for (const report of reports) {
    const arr = byType.get(report.hazard_type) ?? [];
    arr.push(report);
    byType.set(report.hazard_type, arr);
  }

  const allClusters: DBCluster[] = [];
  for (const typeReports of byType.values()) {
    const clusters = dbscan(typeReports, eps, minSamples);
    allClusters.push(...clusters);
  }
  return allClusters;
}

/**
 * Calculate the centroid (arithmetic mean) of a set of reports.
 */
export function calculateCentroid(
  reports: HazardReport[]
): { lat: number; lng: number } {
  if (reports.length === 0) {
    return { lat: 0, lng: 0 };
  }
  const lat = reports.reduce((sum, r) => sum + r.lat, 0) / reports.length;
  const lng = reports.reduce((sum, r) => sum + r.lng, 0) / reports.length;
  return { lat, lng };
}

/**
 * Calculate bounding box as 4 corner points:
 * [[minLat, minLng], [minLat, maxLng], [maxLat, maxLng], [maxLat, minLng]]
 */
export function calculateBoundingBox(
  reports: HazardReport[]
): [number, number][] {
  if (reports.length === 0) {
    return [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ];
  }
  const lats = reports.map((r) => r.lat);
  const lngs = reports.map((r) => r.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return [
    [minLat, minLng],
    [minLat, maxLng],
    [maxLat, maxLng],
    [maxLat, minLng],
  ];
}

/**
 * Calculate hazard score based on report count and recency.
 * score = min(1.0, reportCount / 5) * exp(-age_hours / 24)
 * Result is clamped to [0, 1].
 */
export function calculateHazardScore(
  reportCount: number,
  latestReportTime: number | Date
): number {
  const now = Date.now();
  const latestTime = latestReportTime instanceof Date ? latestReportTime.getTime() : latestReportTime;
  const ageMs = now - latestTime;
  const ageHours = ageMs / 3600000;

  if (ageHours < 0) {
    return Math.min(1.0, reportCount / 5);
  }

  const reportCountFactor = Math.min(1.0, reportCount / 5);
  const recencyDecay = Math.exp(-ageHours / 24);
  const score = reportCountFactor * recencyDecay;

  return Math.max(0, Math.min(1, score));
}