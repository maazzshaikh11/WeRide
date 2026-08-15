// Road graph loader.
// Option A: use Mapbox/Google Directions API for base route (no custom graph needed)
// Option B: load OSM road graph for the ride bbox, build adjacency list
//
// TODO: implement based on Day 1 decision

export function loadRoadGraph(bbox) {
  // bbox: { minLat, minLng, maxLat, maxLng }
  // Option B: fetch OSM data via Overpass API or a local GeoJSON extract,
  // build { nodes: { id: {lat,lng} }, edges: { id: [{to, weight}] } }
  //
  // For MVP (Option A): this is not needed — use Directions API directly
  throw new Error('Not implemented — decide Option A vs B on Day 1');
}