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

// Express handler
import { v4 as uuidv4 } from 'uuid';
export async function handleRoute(req, res) {
  try {
    const { group_id, origin, destination, avoid_hazard_types } = req.body;
    // TODO: load road graph for the bbox (Option A: use Directions API; Option B: OSM graph)
    // TODO: fetch active hazards from Firestore, filter by avoid_hazard_types
    // TODO: applyHazardPenalties, run astar, compute safety_score, call ETA model
    // Mock response for now:
    res.json({
      route_id: uuidv4(),
      path_points: [[origin.lat, origin.lng], [destination.lat, destination.lng]],
      distance_km: haversineMeters(origin.lat, origin.lng, destination.lat, destination.lng) / 1000,
      eta_minutes: 15,
      safety_score: 0.85,
      recalculated_at_hlc: `${Date.now()}:0`,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}