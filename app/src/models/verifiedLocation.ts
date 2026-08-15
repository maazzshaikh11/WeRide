/** verified_location model (§6.1). Published by Person A. */

export interface VerifiedLocation {
  rider_id: string;
  group_id: string;
  timestamp_hlc: string;
  lat: number;
  lng: number;
  speed_mps: number;
  heading_deg: number;
  spoof_flag: boolean;
  nis_score: number;
  accuracy_m: number;
}

export function verifiedLocationFromJson(j: Record<string, any>): VerifiedLocation {
  return {
    rider_id: j.rider_id,
    group_id: j.group_id,
    timestamp_hlc: j.timestamp_hlc,
    lat: Number(j.lat),
    lng: Number(j.lng),
    speed_mps: Number(j.speed_mps),
    heading_deg: Number(j.heading_deg),
    spoof_flag: Boolean(j.spoof_flag),
    nis_score: Number(j.nis_score),
    accuracy_m: Number(j.accuracy_m),
  };
}

export function verifiedLocationToJson(v: VerifiedLocation): Record<string, any> {
  return { ...v };
}