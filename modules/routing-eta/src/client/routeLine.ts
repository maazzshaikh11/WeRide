/**
 * Draws the route line on the map from route_response.path_points.
 * Re-drawn on recalculated_at_hlc change.
 * Ported from route_line.dart.
 *
 * Converts path_points [lat, lng] to GeoJSON LineString [lng, lat] for Mapbox.
 */

import { RouteResponse } from '@app/models/routeResponse';

type GeoJSONFeature = {
  type: 'Feature';
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  properties: { recalculated_at_hlc: string };
};

export function routeToGeoJsonLine(route: RouteResponse): GeoJSONFeature {
  return {
    type: 'Feature',
    properties: { recalculated_at_hlc: route.recalculated_at_hlc },
    geometry: {
      type: 'LineString',
      coordinates: route.path_points.map((p) => [p[1], p[0]]) as [number, number][],
    },
  };
}