/** route_request / route_response model (§6.4). Published by Person C's REST API. */

export interface RouteRequest {
  group_id: string;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  avoid_hazard_types: string[];
}

export interface RouteResponse {
  route_id: string;
  path_points: number[][];
  distance_km: number;
  eta_minutes: number;
  safety_score: number;
  recalculated_at_hlc: string;
}

export function routeResponseFromJson(j: Record<string, any>): RouteResponse {
  return {
    route_id: j.route_id,
    path_points: (j.path_points as any[][]).map((p) => p.map(Number)),
    distance_km: Number(j.distance_km),
    eta_minutes: Number(j.eta_minutes),
    safety_score: Number(j.safety_score),
    recalculated_at_hlc: j.recalculated_at_hlc,
  };
}

export function routeRequestToJson(r: RouteRequest): Record<string, any> {
  return {
    group_id: r.group_id,
    origin: r.origin,
    destination: r.destination,
    avoid_hazard_types: r.avoid_hazard_types,
  };
}