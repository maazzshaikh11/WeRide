// Safety-Weighted A* routing.
// Pure logic — testable without Express.
//
// Graph: adjacency list { node_id: { lat, lng }, edges: { id: [{ to, weight }] } }
// Units: METERS everywhere. Edge weights must be meters; the heuristic is
// haversineMeters. Mixing km weights with the meter heuristic overestimates
// 1000x and voids A* optimality (fixed in Phase 3).
// Heuristic: Haversine straight-line distance (admissible → optimal path)

import { haversineMeters, densifySegment } from './geo.js';
// Re-exported for existing importers (tests import it from here).
export { haversineMeters };

import { v4 as uuidv4 } from 'uuid';
import { extractEtaFeatures, predictEta } from './eta_model.js';
import { fetchMapboxRoutes, getMapboxToken } from './mapbox_directions.js';
import {
  calculateSafetyScoreForPoints,
  countHazardsNearPoints,
  DEFAULT_HAZARD_RADIUS_M,
} from './safety_score.js';

// Min-heap for A* open set (simple array-based — ponytail: use a real heap if graph is large)
class MinHeap {
  constructor() { this.items = []; }
  push(item, priority) {
    this.items.push({ item, priority });
    this.items.sort((a, b) => a.priority - b.priority); // ponytail: O(n log n) sort, real heap if needed
  }
  pop() { return this.items.shift()?.item; }
  get isEmpty() { return this.items.length === 0; }
}

/**
 * A* search.
 * @param {Object} graph - { nodes: { id: {lat,lng} }, edges: { id: [{to, weight}] } }
 * @param {string} start - node id
 * @param {string} goal - node id
 * @returns { path: [nodeIds], cost: number } or null
 */
export function astar(graph, start, goal) {
  const open = new MinHeap();
  open.push(start, 0);
  const cameFrom = {};
  const gScore = { [start]: 0 };
  const goalNode = graph.nodes[goal];

  while (!open.isEmpty) {
    const current = open.pop();
    if (current === goal) {
      // Reconstruct path
      const path = [current];
      let n = current;
      while (cameFrom[n]) { n = cameFrom[n]; path.unshift(n); }
      return { path, cost: gScore[current] };
    }

    for (const edge of (graph.edges[current] || [])) {
      const tentative = gScore[current] + edge.weight;
      if (tentative < (gScore[edge.to] ?? Infinity)) {
        cameFrom[edge.to] = current;
        gScore[edge.to] = tentative;
        const h = haversineMeters(
          graph.nodes[edge.to].lat, graph.nodes[edge.to].lng,
          goalNode.lat, goalNode.lng
        );
        open.push(edge.to, tentative + h);
      }
    }
  }
  return null;
}

/**
 * Hazard penalty + safety score: single source of truth lives in
 * hazard_penalty.js / safety_score.js. Re-exported here so existing
 * importers (tests) keep working.
 *
 * NOTE: the penalty functions mutate edge weights in place (documented).
 * Clone the graph first (cloneGraph from road_graph.js) when the base
 * graph is shared.
 */
export { applyHazardPenaltiesToGraph as applyHazardPenalties } from './hazard_penalty.js';
export { calculateSafetyScore as routeSafetyScore } from './safety_score.js';

/**
 * Validate route_response against the contract schema (T-03, Phase 1).
 * Ensures mock/real responses are schema-exact.
 */
function validateRouteResponse(payload) {
  const requiredFields = [
    'route_id',
    'path_points',
    'distance_km',
    'eta_minutes',
    'safety_score',
    'recalculated_at_hlc',
  ];

  for (const field of requiredFields) {
    if (!(field in payload)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Type checks
  if (typeof payload.route_id !== 'string' || !payload.route_id) {
    throw new Error('route_id must be a non-empty string');
  }

  if (!Array.isArray(payload.path_points)) {
    throw new Error('path_points must be an array');
  }

  for (const point of payload.path_points) {
    if (!Array.isArray(point) || point.length !== 2) {
      throw new Error('Each path_point must be [lat, lng]');
    }
    if (typeof point[0] !== 'number' || typeof point[1] !== 'number') {
      throw new Error('path_point coordinates must be numbers');
    }
  }

  if (typeof payload.distance_km !== 'number' || payload.distance_km < 0) {
    throw new Error('distance_km must be a non-negative number');
  }

  if (typeof payload.eta_minutes !== 'number' || payload.eta_minutes < 0) {
    throw new Error('eta_minutes must be a non-negative number');
  }

  if (
    typeof payload.safety_score !== 'number' ||
    payload.safety_score < 0 ||
    payload.safety_score > 1
  ) {
    throw new Error('safety_score must be a number in [0, 1]');
  }

  if (typeof payload.recalculated_at_hlc !== 'string' || !payload.recalculated_at_hlc) {
    throw new Error('recalculated_at_hlc must be a non-empty string (HLC timestamp)');
  }
}

// Express handler

/**
 * Generate HLC-format timestamp (physical:counter).
 * 
 * Server is plain Node.js (no TypeScript support).
 * Real HLC is used by the client (TypeScript) when requesting routes.
 * Server generates valid HLC-format timestamps using milliseconds + counter.
 * 
 * Format: "milliseconds:counter" (matches real HLC string format)
 * This ensures response timestamps are valid and comparable.
 */
let _counter = 0;

function generateHlcTimestamp() {
  // Use current timestamp in milliseconds as physical component
  // Increment counter to ensure monotonicity within same millisecond
  const physical = Date.now();
  const hlcTimestamp = `${physical}:${_counter}`;
  _counter = (_counter + 1) % 1000000; // Reset counter to avoid overflow
  return hlcTimestamp;
}

export async function handleRoute(req, res) {
  try {
    // Validate required request fields (T-04.2)
    const { group_id, origin, destination, avoid_hazard_types, active_hazards } = req.body;

    if (!group_id || typeof group_id !== 'string') {
      return res.status(400).json({ error: 'group_id is required (string)' });
    }

    if (!origin || typeof origin.lat !== 'number' || typeof origin.lng !== 'number') {
      return res.status(400).json({ error: 'origin must have lat, lng (numbers)' });
    }

    if (!destination || typeof destination.lat !== 'number' || typeof destination.lng !== 'number') {
      return res.status(400).json({ error: 'destination must have lat, lng (numbers)' });
    }

    if (!Array.isArray(avoid_hazard_types)) {
      return res.status(400).json({ error: 'avoid_hazard_types must be an array' });
    }

    // Optional extension (not in the frozen contract — extra fields tolerated):
    // the client forwards its live hazard clusters so the server can route around them.
    const rawHazards = Array.isArray(active_hazards) ? active_hazards : [];
    const validHazards = rawHazards.filter(
      (h) =>
        h != null &&
        typeof h.centroid_lat === 'number' &&
        typeof h.centroid_lng === 'number' &&
        typeof h.hazard_type === 'string'
    );

    // The avoid list is authoritative: empty = avoid nothing; otherwise only
    // the listed hazard types influence routing/scoring.
    const hazardsToAvoid = validHazards.filter((h) =>
      avoid_hazard_types.includes(h.hazard_type)
    );

    const now = new Date();
    let pathPoints; // [[lat, lng], ...] — contract order
    let scoringPoints; // [{lat, lng}, ...] — dense geometry used for safety/ETA scoring
    let distanceKm;
    let turnCount = 0;
    let hazardCount = 0;

    // --- Option A: Mapbox Directions base route + hazard post-processing ---
    let mapboxCandidates = null;
    try {
      mapboxCandidates = await fetchMapboxRoutes(origin, destination);
    } catch (e) {
      console.warn(`[handleRoute] Mapbox request failed, using degraded mode: ${e.message}`);
    }

    if (mapboxCandidates && mapboxCandidates.length > 0) {
      // Post-process: pick the candidate with the fewest hazard conflicts
      // (ties broken by shortest distance). This is "reroute around hazards".
      const scored = mapboxCandidates.map((c) => ({
        candidate: c,
        conflicts: countHazardsNearPoints(c.points, hazardsToAvoid, DEFAULT_HAZARD_RADIUS_M),
      }));
      scored.sort(
        (a, b) => a.conflicts - b.conflicts || a.candidate.distanceM - b.candidate.distanceM
      );
      const best = scored[0];
      hazardCount = best.conflicts;
      turnCount = best.candidate.turnCount;
      distanceKm = best.candidate.distanceM / 1000;
      pathPoints = best.candidate.points.map((p) => [p.lat, p.lng]);
      scoringPoints = best.candidate.points;
    } else {
      // --- Degraded mode: no Mapbox token (or Mapbox down). ---
      // Straight-line geometry, but hazard scoring and ETA features are real.
      if (!getMapboxToken()) {
        console.warn(
          '[handleRoute] MAPBOX_ACCESS_TOKEN unset — degraded straight-line routing. ' +
            'Set the token (see docs/SETUP_CREDENTIALS.md) for road-based routes.'
        );
      }
      const distanceM = haversineMeters(origin.lat, origin.lng, destination.lat, destination.lng);
      distanceKm = distanceM / 1000;
      pathPoints = [
        [origin.lat, origin.lng],
        [destination.lat, destination.lng],
      ];
      // Densify so hazard exposure is scored along the whole segment,
      // not just at the two endpoints (contract path stays endpoint-to-endpoint).
      scoringPoints = densifySegment(origin, destination, 50);
      // Hazard exposure along the straight line, so safety still reflects reality.
      hazardCount = countHazardsNearPoints(scoringPoints, hazardsToAvoid, DEFAULT_HAZARD_RADIUS_M);
    }

    // Safety score from real exposure along the chosen geometry.
    const safety_score = calculateSafetyScoreForPoints(
      scoringPoints,
      hazardsToAvoid,
      DEFAULT_HAZARD_RADIUS_M
    );

    // ETA: real features where computable; sidecar when reachable, heuristic fallback otherwise.
    // avg_speed_limit has no source (Mapbox doesn't provide it) — 40 km/h documented fallback.
    const etaFeatures = extractEtaFeatures(
      {
        distance_km: distanceKm,
        turn_count: turnCount,
        hazard_count: hazardCount,
        avg_speed_limit: 40,
      },
      now
    );
    const eta_minutes = await predictEta(etaFeatures);

    const recalculated_at_hlc = generateHlcTimestamp();

    const response = {
      route_id: uuidv4(),
      path_points: pathPoints,
      distance_km: distanceKm,
      eta_minutes: eta_minutes,
      safety_score: safety_score,
      recalculated_at_hlc: recalculated_at_hlc,
    };

    // Validate the response against the contract (§6.4)
    validateRouteResponse(response);

    res.json(response);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// Export for testing
export { validateRouteResponse };