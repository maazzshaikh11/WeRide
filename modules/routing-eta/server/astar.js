// Safety-Weighted A* routing.
// Pure logic — testable without Express.
//
// Graph: adjacency list { node_id: { lat, lng, edges: [{ to, weight }] } }
// Heuristic: Haversine straight-line distance (admissible → optimal path)

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

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
 * Apply hazard penalties to edge weights.
 * @param {Object} graph
 * @param {Array} hazards - [{ centroid_lat, centroid_lng, hazard_type, hazard_score }]
 * @param {number} radiusM - hazards within this radius affect an edge
 * @param {Object} severityWeights - { accident: 5, oil_spill: 4, ... }
 */
export function applyHazardPenalties(graph, hazards, radiusM = 100, severityWeights = {}) {
  const defaultSeverity = { accident: 5, oil_spill: 4, debris: 3, pothole: 2, other: 1 };
  const sw = { ...defaultSeverity, ...severityWeights };

  for (const id in graph.edges) {
    const node = graph.nodes[id];
    graph.edges[id] = graph.edges[id].map(edge => {
      const toNode = graph.nodes[edge.to];
      const midLat = (node.lat + toNode.lat) / 2;
      const midLng = (node.lng + toNode.lng) / 2;
      let penalty = 0;
      for (const h of hazards) {
        const d = haversineMeters(midLat, midLng, h.centroid_lat, h.centroid_lng);
        if (d <= radiusM) {
          penalty += (sw[h.hazard_type] || 1) * h.hazard_score * (1 - d / radiusM);
        }
      }
      return { ...edge, weight: edge.weight * (1 + penalty) };
    });
  }
  return graph;
}

/**
 * Safety score for a route.
 * 0-1, higher is safer. 1 = no hazards near route.
 */
export function routeSafetyScore(path, graph, hazards, radiusM = 100) {
  if (hazards.length === 0) return 1.0;
  let totalPenalty = 0;
  for (const nodeId of path) {
    const node = graph.nodes[nodeId];
    for (const h of hazards) {
      const d = haversineMeters(node.lat, node.lng, h.centroid_lat, h.centroid_lng);
      if (d <= radiusM) totalPenalty += h.hazard_score * (1 - d / radiusM);
    }
  }
  return Math.max(0, 1 - totalPenalty / Math.max(1, hazards.length));
}

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
import { v4 as uuidv4 } from 'uuid';
import { HLC } from '../../../modules/hazard-sos/src/hlc/hlc.js';
import { extractEtaFeatures, predictEta } from './eta_model.js';

/**
 * Generate HLC-format timestamp (physical:counter).
 * Phase 6: Uses real HLC from Person B implementation.
 */
let _hlcInstance = null;

function getHlcInstance() {
  if (!_hlcInstance) {
    _hlcInstance = HLC.fresh();
  }
  return _hlcInstance;
}

function generateHlcTimestamp() {
  const hlc = getHlcInstance();
  return hlc.now();  // Returns "physical:counter" format
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

    // Phase 6 T-17: Accept real hazards from client (or fetch from Firestore)
    const hazardsToConsider = Array.isArray(active_hazards) ? active_hazards : [];

    // TODO: load road graph for the bbox (Option A: use Directions API; Option B: OSM graph)
    // TODO: fetch active hazards from Firestore if not passed by client
    // TODO: applyHazardPenalties, run astar, compute safety_score, call ETA model

    // Mock response for now (T-04.1: schema-exact)
    const distanceM = haversineMeters(origin.lat, origin.lng, destination.lat, destination.lng);
    const distanceKm = distanceM / 1000;

    // Phase 4: Extract ETA features and predict using LightGBM model
    const etaFeatures = extractEtaFeatures(
      { distance_km: distanceKm },
      new Date()
    );
    const eta_minutes = await predictEta(etaFeatures);

    // Phase 6 T-17: Compute safety score with real hazards
    let safety_score = 0.85;
    if (hazardsToConsider.length > 0) {
      // Simple penalty model: reduce score by hazard density
      // Real model would apply route-specific hazard proximity calculations
      const hazardPenalty = Math.min(0.3, hazardsToConsider.length * 0.05);
      safety_score = Math.max(0.5, 0.85 - hazardPenalty);
    }

    // Phase 6 T-17: Use real HLC format for recalculated_at_hlc
    const recalculated_at_hlc = generateHlcTimestamp();

    const mockResponse = {
      route_id: uuidv4(),
      path_points: [[origin.lat, origin.lng], [destination.lat, destination.lng]],
      distance_km: distanceKm,
      eta_minutes: eta_minutes,
      safety_score: safety_score,
      recalculated_at_hlc: recalculated_at_hlc,
    };

    // Validate the mock response against the contract (T-04.1)
    validateRouteResponse(mockResponse);

    res.json(mockResponse);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// Export for testing
export { validateRouteResponse };