/**
 * Tests for RoutingClient (Phase 6 extension).
 * Verifies distance-based recalculation, location validation, and debouncing.
 */
import { RoutingClient } from '../src/client/routingClient';

// Mock fetch
global.fetch = jest.fn();

describe('RoutingClient (Phase 6)', () => {
  let client: RoutingClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new RoutingClient({
      baseUrl: 'http://localhost:3000',
      debounceMs: 100,
    });
  });

  it('should initialize with default values', () => {
    expect(client.debounce).toBe(100);
  });

  it('should trigger recalc on first location (no distance check)', (done) => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        route_id: 'r1',
        path_points: [[40.7128, -74.006], [40.7140, -74.0089]],
        distance_km: 1.5,
        eta_minutes: 25,
        safety_score: 0.85,
        recalculated_at_hlc: '1000:0',
      }),
    });

    const location = { lat: 40.7128, lng: -74.006 };
    const destination = { lat: 40.7140, lng: -74.0089 };

    client.scheduleOriginRecalcIfMoved(location, destination, 'g1', [], 100);

    setTimeout(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
      done();
    }, 150);
  });

  it('should not recalc if moved < 100m', (done) => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        route_id: 'r1',
        path_points: [[40.7128, -74.006], [40.7140, -74.0089]],
        distance_km: 1.5,
        eta_minutes: 25,
        safety_score: 0.85,
        recalculated_at_hlc: '1000:0',
      }),
    });

    const location1 = { lat: 40.7128, lng: -74.006 };
    const destination = { lat: 40.7140, lng: -74.0089 };

    // First location (triggers)
    client.scheduleOriginRecalcIfMoved(location1, destination, 'g1', [], 100);

    setTimeout(() => {
      // Reset mock
      (global.fetch as jest.Mock).mockClear();

      // Second location: 50m away (should NOT trigger)
      const location2 = { lat: 40.71334, lng: -74.00591 }; // ~50m away
      client.scheduleOriginRecalcIfMoved(location2, destination, 'g1', [], 100);

      setTimeout(() => {
        expect(global.fetch).not.toHaveBeenCalled();
        done();
      }, 150);
    }, 150);
  });

  it('should recalc if moved > 100m', (done) => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        route_id: 'r1',
        path_points: [[40.7128, -74.006], [40.7140, -74.0089]],
        distance_km: 1.5,
        eta_minutes: 25,
        safety_score: 0.85,
        recalculated_at_hlc: '1000:0',
      }),
    });

    const location1 = { lat: 40.7128, lng: -74.006 };
    const destination = { lat: 40.7140, lng: -74.0089 };

    // First location
    client.scheduleOriginRecalcIfMoved(location1, destination, 'g1', [], 100);

    setTimeout(() => {
      (global.fetch as jest.Mock).mockClear();

      // Second location: ~200m away (should trigger)
      const location2 = { lat: 40.71474, lng: -74.00355 }; // ~200m away
      client.scheduleOriginRecalcIfMoved(location2, destination, 'g1', [], 100);

      setTimeout(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
        done();
      }, 150);
    }, 150);
  });

  it('should debounce multiple recalcs within debounce window', (done) => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        route_id: 'r1',
        path_points: [[40.7128, -74.006], [40.7140, -74.0089]],
        distance_km: 1.5,
        eta_minutes: 25,
        safety_score: 0.85,
        recalculated_at_hlc: '1000:0',
      }),
    });

    const location1 = { lat: 40.7128, lng: -74.006 };
    const destination = { lat: 40.7140, lng: -74.0089 };

    // First location
    client.scheduleOriginRecalcIfMoved(location1, destination, 'g1', [], 100);

    setTimeout(() => {
      (global.fetch as jest.Mock).mockClear();

      // Multiple rapid recalcs (should batch into one)
      const location2 = { lat: 40.71474, lng: -74.00355 }; // ~200m away

      client.scheduleRecalculation({
        group_id: 'g1',
        origin: location2,
        destination,
        avoid_hazard_types: [],
      });

      client.scheduleRecalculation({
        group_id: 'g1',
        origin: location2,
        destination,
        avoid_hazard_types: [],
      });

      client.scheduleRecalculation({
        group_id: 'g1',
        origin: location2,
        destination,
        avoid_hazard_types: [],
      });

      setTimeout(() => {
        // Only one fetch should be made (debounced)
        expect(global.fetch).toHaveBeenCalledTimes(1);
        done();
      }, 150);
    }, 150);
  });

  it('should include avoid_hazard_types in request', (done) => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        route_id: 'r1',
        path_points: [[40.7128, -74.006], [40.7140, -74.0089]],
        distance_km: 1.5,
        eta_minutes: 25,
        safety_score: 0.85,
        recalculated_at_hlc: '1000:0',
      }),
    });

    const location = { lat: 40.7128, lng: -74.006 };
    const destination = { lat: 40.7140, lng: -74.0089 };
    const avoidTypes = ['pothole', 'oil_spill'];

    client.scheduleOriginRecalcIfMoved(location, destination, 'g1', avoidTypes, 100);

    setTimeout(() => {
      expect(global.fetch).toHaveBeenCalled();
      const call = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.avoid_hazard_types).toEqual(avoidTypes);
      done();
    }, 150);
  });
});
