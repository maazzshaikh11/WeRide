/** route_request / route_response model (§6.4). Published by Person C's REST API. */

export interface RouteRequestHazard {
  centroid_lat: number;
  centroid_lng: number;
  hazard_type: string;
  hazard_score?: number;
}

export interface RouteRequest {
  group_id: string;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  avoid_hazard_types: string[];
  /**
   * Optional extension (not in the frozen §6.4 contract): live hazard clusters
   * so the server can route around them. Omitted from the payload when empty.
   */
  active_hazards?: RouteRequestHazard[];
}

/** One route option from POST /route (`alternatives`; the first is the same route as the top-level fields). */
export interface RouteAlternative {
  route_id: string;
  path_points: number[][];
  distance_km: number;
  eta_minutes: number;
  /** 0..1 */
  safety_score: number;
  hazard_count: number;
  /** Only 'Fastest' / 'Safest' when genuinely so, otherwise 'Alternative'. */
  label: 'Fastest' | 'Safest' | 'Alternative';
}

export interface RouteResponse {
  route_id: string;
  path_points: number[][];
  distance_km: number;
  eta_minutes: number;
  safety_score: number;
  recalculated_at_hlc: string;
  /** Optional extension: up to three route options (absent from older servers). */
  alternatives?: RouteAlternative[];
}

export function routeAlternativeFromJson(j: Record<string, any>): RouteAlternative {
  const label = j.label === 'Fastest' || j.label === 'Safest' ? j.label : 'Alternative';
  return {
    route_id: String(j.route_id),
    path_points: ((j.path_points as any[][]) ?? []).map((p) => p.map(Number)),
    distance_km: Number(j.distance_km),
    eta_minutes: Number(j.eta_minutes),
    safety_score: Number(j.safety_score),
    hazard_count: Number(j.hazard_count) || 0,
    label,
  };
}

export function routeResponseFromJson(j: Record<string, any>): RouteResponse {
  const alternatives = Array.isArray(j.alternatives)
    ? j.alternatives.filter((a: any) => a && Array.isArray(a.path_points)).map(routeAlternativeFromJson)
    : undefined;
  return {
    route_id: j.route_id,
    path_points: (j.path_points as any[][]).map((p) => p.map(Number)),
    distance_km: Number(j.distance_km),
    eta_minutes: Number(j.eta_minutes),
    safety_score: Number(j.safety_score),
    recalculated_at_hlc: j.recalculated_at_hlc,
    ...(alternatives && alternatives.length > 0 ? { alternatives } : {}),
  };
}

export function routeRequestToJson(r: RouteRequest): Record<string, any> {
  const json: Record<string, any> = {
    group_id: r.group_id,
    origin: r.origin,
    destination: r.destination,
    avoid_hazard_types: r.avoid_hazard_types,
  };
  if (r.active_hazards && r.active_hazards.length > 0) {
    json.active_hazards = r.active_hazards;
  }
  return json;
}