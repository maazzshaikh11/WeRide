/**
 * Draws the route line on the map from route_response.path_points.
 * Re-drawn on recalculated_at_hlc change.
 * Ported from route_line.dart.
 *
 * TODO: wire to route_response stream, rebuild Mapbox LineLayer on change.
 * For RN+Mapbox, the route is a GeoJSON LineString in a ShapeSource.
 */

import { RouteResponse } from '@app/models/routeResponse';

export function routeToGeoJsonLine(route: RouteResponse): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    properties: { recalculated_at_hlc: route.recalculated_at_hlc },
    geometry: {
      type: 'LineString',
      coordinates: route.path_points.map((p) => [p[1], p[0]]), // [lng, lat] for GeoJSON
    },
  };
}