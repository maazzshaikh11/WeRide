/**
 * Hazard penalty calculation for routing.
 * 
 * When a hazard (accident, pothole, etc.) is active near an edge,
 * this module computes a multiplicative penalty that increases
 * the edge's cost in A*.
 * 
 * Formula:
 *   edge_weight_with_hazard = base_weight * (1 + penalty)
 *   penalty = Σ(severity_weight * hazard_score * proximity_factor)
 * 
 * Severity weights (tunable):
 *   accident  = 5.0   (most dangerous)
 *   oil_spill = 4.0
 *   debris    = 3.0
 *   pothole   = 2.0
 *   other     = 1.0   (least dangerous)
 * 
 * Proximity factor (distance-decay):
 *   Within radius R: factor = (1 - distance/R)  [max 1 at distance 0]
 *   Beyond radius R: factor = 0 (hazard ignored)
 * 
 * This makes penalties:
 * - Proportional to hazard severity and reported score
 * - Distance-weighted (hazards right on the road matter most)
 * - Additive (multiple hazards near the same edge all contribute)
 */

/**
 * Default severity weights for hazard types.
 * Used if not overridden in calculateHazardPenalty.
 */
export const DEFAULT_SEVERITY_WEIGHTS = {
  accident: 5.0,
  oil_spill: 4.0,
  debris: 3.0,
  pothole: 2.0,
  other: 1.0,
};

/**
 * Default hazard radius in meters.
 * Hazards beyond this distance do not affect routing.
 */
export const DEFAULT_HAZARD_RADIUS_M = 100;

/**
 * Calculate penalty for a single edge given active hazards.
 * 
 * @param {Object} edgeFromNode - { lat, lng }
 * @param {Object} edgeToNode - { lat, lng }
 * @param {Array} hazards - [{ centroid_lat, centroid_lng, hazard_type, hazard_score }, ...]
 * @param {number} radiusM - hazards within this distance affect the edge
 * @param {Object} severityWeights - { hazard_type: weight, ... }
 * @returns {number} penalty factor (0 = no penalty, typically 0-2)
 */
export function calculateHazardPenalty(
  edgeFromNode,
  edgeToNode,
  hazards = [],
  radiusM = DEFAULT_HAZARD_RADIUS_M,
  severityWeights = DEFAULT_SEVERITY_WEIGHTS
) {
  if (hazards.length === 0) return 0;

  // Use midpoint of edge to check hazard proximity
  const edgeMidLat = (edgeFromNode.lat + edgeToNode.lat) / 2;
  const edgeMidLng = (edgeFromNode.lng + edgeToNode.lng) / 2;

  let totalPenalty = 0;

  for (const hazard of hazards) {
    // Calculate distance from edge midpoint to hazard centroid
    const distanceM = haversineMeters(
      edgeMidLat,
      edgeMidLng,
      hazard.centroid_lat,
      hazard.centroid_lng
    );

    // If hazard is within radius, apply penalty
    if (distanceM <= radiusM) {
      const severity = severityWeights[hazard.hazard_type] || severityWeights.other;
      const proximityFactor = 1 - distanceM / radiusM; // 1.0 at distance 0, 0.0 at distance radiusM
      const hazardScore = hazard.hazard_score || 1.0; // Default to 1.0 if not provided

      const hazardPenalty = severity * hazardScore * proximityFactor;
      totalPenalty += hazardPenalty;
    }
  }

  return totalPenalty;
}

/**
 * Apply hazard penalties to all edges in a graph.
 * Modifies the graph in-place: edge.weight *= (1 + penalty)
 * 
 * @param {Object} graph - { nodes: {...}, edges: {...} }
 * @param {Array} hazards - active hazards
 * @param {number} radiusM - hazard effect radius
 * @param {Object} severityWeights - severity overrides
 */
export function applyHazardPenaltiesToGraph(
  graph,
  hazards = [],
  radiusM = DEFAULT_HAZARD_RADIUS_M,
  severityWeights = DEFAULT_SEVERITY_WEIGHTS
) {
  if (hazards.length === 0) return; // No hazards, no penalties

  for (const fromId in graph.edges) {
    const fromNode = graph.nodes[fromId];
    if (!fromNode) continue;

    graph.edges[fromId] = graph.edges[fromId].map(edge => {
      const toNode = graph.nodes[edge.to];
      if (!toNode) return edge;

      const penalty = calculateHazardPenalty(
        fromNode,
        toNode,
        hazards,
        radiusM,
        severityWeights
      );

      return {
        ...edge,
        weight: edge.weight * (1 + penalty),
      };
    });
  }
}

/**
 * Haversine distance in meters between two coordinates.
 * (Imported from astar.js to avoid circular deps; re-defined here for clarity.)
 */
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export { haversineMeters };
