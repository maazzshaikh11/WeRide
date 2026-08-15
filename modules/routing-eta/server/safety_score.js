// Safety score formula for a route.
// safety_score = 1 - (sum_hazard_penalties / max_possible_penalty)
// 0-1, higher is safer. Green >= 0.7, Yellow 0.4-0.7, Red < 0.4 (see theme.dart)

import { haversineMeters } from './astar.js';

export function computeSafetyScore(pathNodes, graph, hazards, radiusM = 100) {
  if (!hazards || hazards.length === 0) return 1.0;
  let totalPenalty = 0;
  for (const nodeId of pathNodes) {
    const node = graph.nodes[nodeId];
    for (const h of hazards) {
      const d = haversineMeters(node.lat, node.lng, h.centroid_lat, h.centroid_lng);
      if (d <= radiusM) {
        totalPenalty += (h.hazard_score || 0.5) * (1 - d / radiusM);
      }
    }
  }
  const maxPenalty = hazards.length; // rough upper bound
  return Math.max(0, Math.min(1, 1 - totalPenalty / Math.max(1, maxPenalty)));
}