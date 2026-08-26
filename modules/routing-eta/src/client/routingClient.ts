/**
 * Client for POST /route. Calls the Node.js backend.
 * Ported from routing_client.dart.
 *
 * Recalculation is debounced on the client side (batch hazard changes within 500ms
 * into one request).
 *
 * Phase 6: Supports distance-based recalculation to prevent origin-churn storms.
 */

import { RouteResponse, RouteRequest, routeResponseFromJson, routeRequestToJson } from '@app/models/routeResponse';

export interface RoutingClientParams {
  baseUrl?: string;
  onUpdate?: (route: RouteResponse) => void;
  debounceMs?: number;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export class RoutingClient {
  private _baseUrl: string;
  private _onUpdate?: (route: RouteResponse) => void;
  readonly debounce: number;
  private _debounceTimer?: ReturnType<typeof setTimeout>;
  private _pendingRequest?: Partial<RouteRequest>;
  private _lastRequestOrigin?: { lat: number; lng: number };

  constructor(params: RoutingClientParams = {}) {
    this._baseUrl = params.baseUrl ?? process.env.SERVER_URL ?? 'http://localhost:3000';
    this._onUpdate = params.onUpdate;
    this.debounce = params.debounceMs ?? 500;
  }

  /** Request a route (immediate, no debounce). */
  async requestRoute(req: Omit<RouteRequest, 'avoid_hazard_types'> & { avoid_hazard_types?: string[] }): Promise<RouteResponse> {
    const fullReq: RouteRequest = {
      group_id: req.group_id,
      origin: req.origin,
      destination: req.destination,
      avoid_hazard_types: req.avoid_hazard_types ?? [],
    };
    const res = await fetch(`${this._baseUrl}/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(routeRequestToJson(fullReq)),
    });
    if (!res.ok) throw new Error(`Route request failed: ${res.status}`);
    const route = routeResponseFromJson(await res.json() as Record<string, any>);
    this._lastRequestOrigin = req.origin;
    this._onUpdate?.(route);
    return route;
  }

  /** Debounced request — batch hazard changes within `debounce` ms into one request. */
  scheduleRecalculation(req: Omit<RouteRequest, 'avoid_hazard_types'> & { avoid_hazard_types?: string[] }): void {
    this._pendingRequest = req;
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      if (this._pendingRequest) this.requestRoute(this._pendingRequest as any).catch(console.error);
      this._pendingRequest = undefined;
    }, this.debounce);
  }

  /**
   * Phase 6: Distance-based recalculation.
   * Only triggers a new /route request if the rider has moved > thresholdMeters.
   * Prevents recalc storms from GPS jitter.
   */
  scheduleOriginRecalcIfMoved(
    newLocation: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    groupId: string,
    avoidHazardTypes: string[],
    thresholdMeters = 100
  ): void {
    if (!this._lastRequestOrigin) {
      // First location, trigger immediately
      this.scheduleRecalculation({
        group_id: groupId,
        origin: newLocation,
        destination,
        avoid_hazard_types: avoidHazardTypes,
      });
      return;
    }

    const distanceM = haversineMeters(
      this._lastRequestOrigin.lat,
      this._lastRequestOrigin.lng,
      newLocation.lat,
      newLocation.lng
    );

    if (distanceM > thresholdMeters) {
      this.scheduleRecalculation({
        group_id: groupId,
        origin: newLocation,
        destination,
        avoid_hazard_types: avoidHazardTypes,
      });
    }
  }
}