/**
 * Client-side routing tests.
 * The server-side A* tests live in server/test/astar.test.js (Node, untouched).
 */

import { RoutingClient } from '../src/client/routingClient';

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
});