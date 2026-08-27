/**
 * Route line / GeoJSON conversion tests (T-14, Phase 5 UI).
 */

import { routeToGeoJsonLine } from '../src/client/routeLine';
import { RouteResponse } from '@app/models/routeResponse';

describe('Route Line GeoJSON Conversion', () => {
  test('converts path_points to GeoJSON LineString with correct coord order [lng,lat]', () => {
    const route: RouteResponse = {
      route_id: 'r1',
      path_points: [[40.7128, -74.006], [40.7140, -74.0089]],
      distance_km: 1.5,
      eta_minutes: 5,
      safety_score: 0.9,
      recalculated_at_hlc: '1:0',
    };

    const geojson = routeToGeoJsonLine(route);

    expect(geojson.type).toBe('Feature');
    expect(geojson.geometry.type).toBe('LineString');

    // Verify coordinates are [lng, lat] order (swapped from input [lat, lng])
    expect(geojson.geometry.coordinates).toEqual([
      [-74.006, 40.7128],
      [-74.0089, 40.7140],
    ]);
  });

  test('includes recalculated_at_hlc in properties', () => {
    const route: RouteResponse = {
      route_id: 'r1',
      path_points: [[0, 0], [1, 1]],
      distance_km: 1,
      eta_minutes: 2,
      safety_score: 0.8,
      recalculated_at_hlc: '12345:67',
    };

    const geojson = routeToGeoJsonLine(route);

    expect(geojson.properties).toEqual({ recalculated_at_hlc: '12345:67' });
  });

  test('handles multiple waypoints correctly', () => {
    const route: RouteResponse = {
      route_id: 'r1',
      path_points: [[0, 0], [1, 1], [2, 2], [3, 3]],
      distance_km: 10,
      eta_minutes: 15,
      safety_score: 0.85,
      recalculated_at_hlc: '1:0',
    };

    const geojson = routeToGeoJsonLine(route);

    expect(geojson.geometry.coordinates.length).toBe(4);
    expect(geojson.geometry.coordinates).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
    ]);
  });

  test('preserves coordinate precision', () => {
    const route: RouteResponse = {
      route_id: 'r1',
      path_points: [[40.71289156, -74.00603449], [40.71401234, -74.00893456]],
      distance_km: 1.5,
      eta_minutes: 5,
      safety_score: 0.9,
      recalculated_at_hlc: '1:0',
    };

    const geojson = routeToGeoJsonLine(route);

    expect(geojson.geometry.coordinates[0][0]).toBe(-74.00603449);
    expect(geojson.geometry.coordinates[0][1]).toBe(40.71289156);
  });

  test('returns valid GeoJSON Feature structure', () => {
    const route: RouteResponse = {
      route_id: 'r1',
      path_points: [[0, 0], [1, 1]],
      distance_km: 1,
      eta_minutes: 2,
      safety_score: 0.8,
      recalculated_at_hlc: '1:0',
    };

    const geojson = routeToGeoJsonLine(route);

    // Feature must have required fields
    expect(geojson).toHaveProperty('type');
    expect(geojson).toHaveProperty('geometry');
    expect(geojson).toHaveProperty('properties');

    expect(geojson.type).toBe('Feature');
    expect(geojson.geometry).toHaveProperty('type');
    expect(geojson.geometry).toHaveProperty('coordinates');
  });
});
