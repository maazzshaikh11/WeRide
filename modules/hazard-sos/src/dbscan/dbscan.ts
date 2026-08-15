/**
 * DBSCAN clustering for hazard reports.
 * Pure logic — no Firestore, no RN. Testable standalone.
 * Ported from dbscan.dart.
 *
 * Clusters nearby reports of the same hazard_type.
 * Reports near a cluster boundary must cluster together (density-reachable).
 */

export type HazardType = 'pothole' | 'oil_spill' | 'accident' | 'debris' | 'other';

export interface HazardReport {
  reportId: string;
  riderId: string;
  groupId: string;
  hazardType: HazardType;
  lat: number;
  lng: number;
  timestampHlc: string;
  reportedAtHlc: string;
}

export interface HazardClusterResult {
  clusterId: string;
  hazardType: HazardType;
  centroidLat: number;
  centroidLng: number;
  polygonPoints: number[][];
  reportCount: number;
  reports: HazardReport[];
}

/** Haversine distance in meters. */
function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export interface DbscanParams {
  epsMeters: number;
  minSamples: number;
  newClusterId: () => string;
}

/** Run DBSCAN over reports of a single hazard_type. Noise → single-report cluster. */
export function dbscanByType(reports: HazardReport[], params: DbscanParams): HazardClusterResult[] {
  const results: HazardClusterResult[] = [];
  const visited = new Array(reports.length).fill(false);
  const clusterLabels = new Array(reports.length).fill(-1); // -1 = unassigned
  let clusterIdx = 0;

  for (let i = 0; i < reports.length; i++) {
    if (visited[i]) continue;
    visited[i] = true;
    const neighbors = rangeQuery(reports, i, params.epsMeters);

    if (neighbors.length < params.minSamples) {
      clusterLabels[i] = clusterIdx;
      results.push(makeCluster(reports, [i], clusterIdx, params.newClusterId));
      clusterIdx++;
    } else {
      clusterLabels[i] = clusterIdx;
      const clusterMembers = [i];
      const queue = neighbors.filter((n) => n !== i);
      while (queue.length > 0) {
        const q = queue.shift()!;
        if (!visited[q]) {
          visited[q] = true;
          const qNeighbors = rangeQuery(reports, q, params.epsMeters);
          if (qNeighbors.length >= params.minSamples) {
            for (const n of qNeighbors) {
              if (!queue.includes(n) && clusterLabels[n] === -1) queue.push(n);
            }
          }
        }
        if (clusterLabels[q] === -1) {
          clusterLabels[q] = clusterIdx;
          clusterMembers.push(q);
        }
      }
      results.push(makeCluster(reports, clusterMembers, clusterIdx, params.newClusterId));
      clusterIdx++;
    }
  }
  return results;
}

function rangeQuery(reports: HazardReport[], idx: number, eps: number): number[] {
  const center = reports[idx];
  const result: number[] = [];
  for (let i = 0; i < reports.length; i++) {
    if (i === idx) continue;
    if (reports[i].hazardType !== center.hazardType) continue; // per-type clustering
    const d = distanceM(center.lat, center.lng, reports[i].lat, reports[i].lng);
    if (d <= eps) result.push(i);
  }
  return result;
}

function makeCluster(
  reports: HazardReport[],
  members: number[],
  clusterIdx: number,
  newClusterId: () => string
): HazardClusterResult {
  const lat = members.reduce((sum, i) => sum + reports[i].lat, 0) / members.length;
  const lng = members.reduce((sum, i) => sum + reports[i].lng, 0) / members.length;
  // Bounding box polygon (4 points) — ponytail: bbox, convex hull if fidelity demanded
  const lats = members.map((i) => reports[i].lat).sort((a, b) => a - b);
  const lngs = members.map((i) => reports[i].lng).sort((a, b) => a - b);
  const minLat = lats[0], maxLat = lats[lats.length - 1];
  const minLng = lngs[0], maxLng = lngs[lngs.length - 1];
  return {
    clusterId: newClusterId(),
    hazardType: reports[members[0]].hazardType,
    centroidLat: lat,
    centroidLng: lng,
    polygonPoints: [
      [minLat, minLng],
      [minLat, maxLng],
      [maxLat, maxLng],
      [maxLat, minLng],
    ],
    reportCount: members.length,
    reports: members.map((i) => reports[i]),
  };
}

/** hazard_score: f(report_count, recency). Simple formula for MVP. */
export function hazardScore(reportCount: number, createdAt: Date, now?: Date): number {
  const n = now ?? new Date();
  const ageMin = (n.getTime() - createdAt.getTime()) / 60000;
  const recencyDecay = Math.max(0, 1 - ageMin / 60.0); // decay over 60 min
  return Math.min(1.0, reportCount / 5.0) * recencyDecay;
}