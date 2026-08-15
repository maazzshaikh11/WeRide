/** hazard_cluster model (§6.2). Published by Person B. */

export type HazardType = 'pothole' | 'oil_spill' | 'accident' | 'debris' | 'other';
export type HazardStatus = 'active' | 'resolved';

export interface HazardCluster {
  cluster_id: string;
  group_id: string;
  hazard_type: HazardType;
  centroid_lat: number;
  centroid_lng: number;
  polygon_points: number[][];
  report_count: number;
  hazard_score: number;
  created_at_hlc: string;
  status: HazardStatus;
}

export function hazardClusterFromJson(j: Record<string, any>): HazardCluster {
  return {
    cluster_id: j.cluster_id,
    group_id: j.group_id,
    hazard_type: j.hazard_type,
    centroid_lat: Number(j.centroid_lat),
    centroid_lng: Number(j.centroid_lng),
    polygon_points: (j.polygon_points as any[][]).map((p) => p.map(Number)),
    report_count: Number(j.report_count),
    hazard_score: Number(j.hazard_score),
    created_at_hlc: j.created_at_hlc,
    status: j.status,
  };
}

export function hazardClusterToJson(h: HazardCluster): Record<string, any> {
  return { ...h };
}