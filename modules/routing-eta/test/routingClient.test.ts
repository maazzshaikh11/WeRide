/**
 * Client-side routing tests.
 * The server-side A* tests live in server/test/astar.test.js (Node, untouched).
 */

import { RoutingClient } from '../src/client/routingClient';
import { routeResponseFromJson } from '@app/models/routeResponse';

describe('RoutingClient', () => {
  test('debounce schedules a single request', (done) => {
    const client = new RoutingClient({ baseUrl: 'http://stub', debounceMs: 50 });
    // Mock fetch
    const calls: any[] = [];
    (global as any).fetch = (url: string, opts: any) => {
      calls.push({ url, body: JSON.parse(opts.body) });
      return Promise.resolve({
        ok: true,
        json: async () => ({
          route_id: 'r1',
          path_points: [[0, 0], [1, 1]],
          distance_km: 10,
          eta_minutes: 5,
          safety_score: 0.9,
          recalculated_at_hlc: '1:0',
        }),
      });
    };
    client.scheduleRecalculation({
      group_id: 'g', origin: { lat: 0, lng: 0 }, destination: { lat: 1, lng: 1 }, avoid_hazard_types: [],
    });
    client.scheduleRecalculation({
      group_id: 'g', origin: { lat: 0, lng: 0 }, destination: { lat: 2, lng: 2 }, avoid_hazard_types: [],
    });
    setTimeout(() => {
      expect(calls.length).toBe(1); // debounced to one call
      done();
    }, 120);
  });

  test('requestRoute parses mock response correctly (T-04 round-trip)', async () => {
    const client = new RoutingClient({ baseUrl: 'http://stub' });

    // Mock fetch to return a schema-valid mock response
    const mockResponse = {
      route_id: 'route-12345',
      path_points: [[40.7128, -74.006], [40.7140, -74.0089]],
      distance_km: 1.5,
      eta_minutes: 5.2,
      safety_score: 0.85,
      recalculated_at_hlc: '1692374400000:0',
    };

    (global as any).fetch = (url: string, opts: any) => {
      expect(url).toBe('http://stub/route');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body);
      expect(body.group_id).toBe('group-123');
      expect(body.origin).toEqual({ lat: 40.7128, lng: -74.006 });
      expect(body.destination).toEqual({ lat: 40.7140, lng: -74.0089 });
      expect(Array.isArray(body.avoid_hazard_types)).toBe(true);

      return Promise.resolve({
        ok: true,
        json: async () => mockResponse,
      });
    };

    // Track onUpdate callback
    let updateCalled = false;
    const client2 = new RoutingClient({
      baseUrl: 'http://stub',
      onUpdate: (route) => {
        updateCalled = true;
        expect(route.route_id).toBe('route-12345');
        expect(route.safety_score).toBe(0.85);
      },
    });

    (global as any).fetch = (url: string, opts: any) =>
      Promise.resolve({
        ok: true,
        json: async () => mockResponse,
      });

    const result = await client2.requestRoute({
      group_id: 'group-123',
      origin: { lat: 40.7128, lng: -74.006 },
      destination: { lat: 40.7140, lng: -74.0089 },
    });

    expect(result.route_id).toBe('route-12345');
    expect(result.path_points).toEqual([[40.7128, -74.006], [40.7140, -74.0089]]);
    expect(result.distance_km).toBe(1.5);
    expect(result.eta_minutes).toBe(5.2);
    expect(result.safety_score).toBe(0.85);
    expect(result.recalculated_at_hlc).toBe('1692374400000:0');
    expect(updateCalled).toBe(true);
  });

  test('routeResponseFromJson parses correctly', () => {
    const json = {
      route_id: 'route-abc',
      path_points: [['40.7128', '-74.006'], ['40.7140', '-74.0089']],
      distance_km: '1.5',
      eta_minutes: '5.2',
      safety_score: '0.85',
      recalculated_at_hlc: '1692374400000:0',
    };

    const parsed = routeResponseFromJson(json);

    expect(parsed.route_id).toBe('route-abc');
    expect(parsed.path_points).toEqual([[40.7128, -74.006], [40.7140, -74.0089]]);
    expect(parsed.distance_km).toBe(1.5);
    expect(parsed.eta_minutes).toBe(5.2);
    expect(parsed.safety_score).toBe(0.85);
    expect(parsed.recalculated_at_hlc).toBe('1692374400000:0');
  });
});