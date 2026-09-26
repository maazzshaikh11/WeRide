/**
 * Safety score calculation for routes.
 *
 * The safety score is a value in [0, 1] representing the route's
 * exposure to hazards.
 *
 * Formula:
 *   safety_score = 1 - (total_hazard_exposure / max_possible_exposure)
 *
 * Where:
 *   total_hazard_exposure = Σ(severity_weight * hazard_score * proximity_factor)
 *                           for each node on path, for each hazard
 *   max_possible_exposure = threshold (tunable, default 5.0)
 *
 * Result is clamped to [0, 1].
 *
 * Properties:
 * - A route with no hazards scores 1.0 (completely safe)
 * - A route through multiple high-severity hazards scores < 0.5 (dangerous)
 * - The score is deterministic and reproducible
 */

import { haversineMeters } from './geo.js';

/**
 * Default severity weights for exposure calculation.
 * (Can be different from routing weights for different UX semantics.)
 */
export const DEFAULT_SEVERITY_WEIGHTS_SAFETY = {
  accident: 5.0,
  oil_spill: 4.0,
  debris: 3.0,
  pothole: 2.0,
  other: 1.0,
};

/**
 * Default hazard radius in meters for safety score.
 */
export const DEFAULT_HAZARD_RADIUS_M = 100;

/**
 * Default maximum exposure threshold.
 * If total_exposure exceeds this, safety_score clamps at 0.
 */
export const DEFAULT_MAX_EXPOSURE = 5.0;

/**
 * Calculate safety score for a route path.
 *
 * @param {string[]} nodePath - array of node IDs from A*
 * @param {Object} graph - { nodes: {...}, edges: {...} }
 * @param {Array} hazards - [{ centroid_lat, centroid_lng, hazard_type, hazard_score }, ...]
 * @param {number} radiusM - hazard effect radius
 * @param {Object} severityWeights - { hazard_type: weight, ... }
 * @param {number} maxExposure - clamp threshold
 * @returns {number} safety_score in [0, 1]
 */
export function calculateSafetyScore(
  nodePath,
  graph,
  hazards = [],
  radiusM = DEFAULT_HAZARD_RADIUS_M,
  severityWeights = DEFAULT_SEVERITY_WEIGHTS_SAFETY,
  maxExposure = DEFAULT_MAX_EXPOSURE
) {
  // No hazards = perfect safety
  if (hazards.length === 0) return 1.0;

  let totalExposure = 0;

  // For each node on the path
  for (const nodeId of nodePath) {
    const node = graph.nodes[nodeId];
    if (!node) continue;

    // For each active hazard
    for (const hazard of hazards) {
      const distanceM = haversineMeters(
        node.lat,
        node.lng,
        hazard.centroid_lat,
        hazard.centroid_lng
      );

      // If hazard is within radius, add to exposure
      if (distanceM <= radiusM) {
        const severity = severityWeights[hazard.hazard_type] || severityWeights.other;
        const proximityFactor = 1 - distanceM / radiusM;
        const hazardScore = hazard.hazard_score || 1.0;

        const exposure = severity * hazardScore * proximityFactor;
        totalExposure += exposure;
      }
    }
  }

  // Convert exposure to safety score [0, 1]
  // score = 1 - (exposure / maxExposure)
  // clamp to [0, 1]
  const score = Math.max(0, 1 - totalExposure / maxExposure);
  return Math.min(1, score);
}

/**
 * Calculate safety score for a raw coordinate path (e.g. Mapbox geometry).
 * Same formula as calculateSafetyScore; operates on [{lat, lng}] directly
 * instead of node IDs + graph.
 *
 * @param {Array<{lat:number,lng:number}>} points
 * @param {Array} hazards - [{ centroid_lat, centroid_lng, hazard_type, hazard_score }, ...]
 * @param {number} radiusM
 * @param {Object} severityWeights
 * @param {number} maxExposure
 * @returns {number} safety_score in [0, 1]
 */
export function calculateSafetyScoreForPoints(
  points,
  hazards = [],
  radiusM = DEFAULT_HAZARD_RADIUS_M,
  severityWeights = DEFAULT_SEVERITY_WEIGHTS_SAFETY,
  maxExposure = DEFAULT_MAX_EXPOSURE
) {
  if (hazards.length === 0) return 1.0;

  let totalExposure = 0;
  for (const point of points) {
    for (const hazard of hazards) {
      const distanceM = haversineMeters(
        point.lat,
        point.lng,
        hazard.centroid_lat,
        hazard.centroid_lng
      );
      if (distanceM <= radiusM) {
        const severity = severityWeights[hazard.hazard_type] || severityWeights.other;
        const proximityFactor = 1 - distanceM / radiusM;
        const hazardScore = hazard.hazard_score || 1.0;
        totalExposure += severity * hazardScore * proximityFactor;
      }
    }
  }

  const score = Math.max(0, 1 - totalExposure / maxExposure);
  return Math.min(1, score);
}

/**
 * Count hazards within radiusM of any point on the path.
 * Used for ETA features and for picking the cleanest Mapbox alternative.
 *
 * @param {Array<{lat:number,lng:number}>} points
 * @param {Array} hazards
 * @param {number} radiusM
 * @returns {number} hazards near the path
 */
export function countHazardsNearPoints(points, hazards = [], radiusM = DEFAULT_HAZARD_RADIUS_M) {
  let count = 0;
  for (const hazard of hazards) {
    const near = points.some(
      (p) =>
        haversineMeters(p.lat, p.lng, hazard.centroid_lat, hazard.centroid_lng) <= radiusM
    );
    if (near) count += 1;
  }
  return count;
}

/**
 * Categorize a safety score into a user-facing tier.
 *
 * @param {number} safetyScore - [0, 1]
 * @param {Object} thresholds - { safe, warning, danger } with default values
 * @returns {string} "safe", "warning", or "danger"
 */
export function safetyTier(
  safetyScore,
  thresholds = { safe: 0.7, warning: 0.4, danger: 0 }
) {
  if (safetyScore >= thresholds.safe) return 'safe';
  if (safetyScore >= thresholds.warning) return 'warning';
  return 'danger';
}

/** Re-exported from geo.js (single source of truth). */
export { haversineMeters };
