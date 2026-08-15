/**
 * Client for POST /route. Calls the Node.js backend.
 * Ported from routing_client.dart.
 *
 * Recalculation is debounced on the client side (batch hazard changes within 500ms
 * into one request).
 */

import { RouteResponse, RouteRequest, routeResponseFromJson, routeRequestToJson } from '@app/models/routeResponse';

export interface RoutingClientParams {
  baseUrl?: string;
  onUpdate?: (route: RouteResponse) => void;
  debounceMs?: number;
}

export class RoutingClient {
  private _baseUrl: string;
  private _onUpdate?: (route: RouteResponse) => void;
  readonly debounce: number;
  private _debounceTimer?: ReturnType<typeof setTimeout>;
  private _pendingRequest?: Partial<RouteRequest>;

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
    const route = routeResponseFromJson(await res.json());
    this._onUpdate?.(route);
    return route;
  }

  /** Debounced request — batch hazard changes within `debounce` ms into one request. */
  scheduleRecalculation(req: Parameters<RoutingClient['requestRoute']>[0]): void {
    this._pendingRequest = req;
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      if (this._pendingRequest) this.requestRoute(this._pendingRequest).catch(console.error);
      this._pendingRequest = undefined;
    }, this.debounce);
  }
}