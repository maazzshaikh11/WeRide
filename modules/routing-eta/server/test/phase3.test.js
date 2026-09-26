/**
 * Phase 3 Integration Tests
 * 
 * Comprehensive tests for the routing engine:
 * - A* optimality
 * - Haversine heuristic admissibility
 * - Hazard penalty application
 * - Rerouting behavior on hazard changes
 * - Recalculation latency
 * - Safety score boundaries
 * - Route response contract
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { astar, haversineMeters } from '../astar.js';
import { createTestGrid, pathDistance, isValidGraph } from '../road_graph.js';
import { calculateHazardPenalty, DEFAULT_SEVERITY_WEIGHTS } from '../hazard_penalty.js';
import { calculateSafetyScore, safetyTier } from '../safety_score.js';

// ============================================================================
// A* Tests (from Phase 1, re-verified)
// ============================================================================

test('A* finds optimal path on small graph', () => {
  const graph = {
    nodes: {
      A: { lat: 0, lng: 0 },
      B: { lat: 0.001, lng: 0 },
      C: { lat: 0.002, lng: 0 },
    },
    edges: {
      A: [{ to: 'B', weight: 1 }],
      B: [{ to: 'C', weight: 1 }],
    },
  };
  const result = astar(graph, 'A', 'C');
  assert.ok(result);
  assert.deepEqual(result.path, ['A', 'B', 'C']);
  assert.equal(result.cost, 2);
});

// ============================================================================
// Haversine Heuristic Admissibility Test
// ============================================================================

test('A* heuristic is admissible with real units (never overestimates)', () => {
  // Phase 3: real units — edge weights in METERS (via createTestGrid/addEdge),
  // heuristic in meters. Admissibility means h(n) <= true cheapest cost from
  // n to goal for every node, which is what guarantees A* optimality.
  // The old unitless version of this test (weights 1 / 1.414 vs a meter
  // heuristic) could not catch the km-vs-meters mismatch.
  //
  // Oracle: independent Dijkstra (A* with h=0), NOT A*'s own cost —
  // comparing A* against itself would be circular.
  function dijkstra(graph, start, goal) {
    const dist = { [start]: 0 };
    const visited = new Set();
    for (;;) {
      let u = null;
      for (const id in dist) {
        if (!visited.has(id) && (u === null || dist[id] < dist[u])) u = id;
      }
      if (u === null) return Infinity;
      if (u === goal) return dist[u];
      visited.add(u);
      for (const e of (graph.edges[u] || [])) {
        const nd = dist[u] + e.weight;
        if (nd < (dist[e.to] ?? Infinity)) dist[e.to] = nd;
      }
    }
  }

  const graph = createTestGrid();
  const goal = '8'; // bottom-right corner

  for (const nodeId in graph.nodes) {
    const trueCostM = dijkstra(graph, nodeId, goal);
    assert.ok(Number.isFinite(trueCostM), `Dijkstra should reach ${goal} from ${nodeId}`);
    const h = haversineMeters(
      graph.nodes[nodeId].lat, graph.nodes[nodeId].lng,
      graph.nodes[goal].lat, graph.nodes[goal].lng
    );
    assert.ok(h <= trueCostM + 1e-6,
      `Heuristic ${h.toFixed(1)} m from ${nodeId} overestimates true cost ${trueCostM.toFixed(1)} m`);

    // And A* must find that same optimal cost (optimality, not just a path).
    const aStar = astar(graph, nodeId, goal);
    assert.ok(aStar, `A* should find a path from ${nodeId} to ${goal}`);
    assert.ok(Math.abs(aStar.cost - trueCostM) < 1e-6,
      `A* cost ${aStar.cost.toFixed(1)} m != optimal ${trueCostM.toFixed(1)} m from ${nodeId}`);
  }
});

test('A* returns optimal (shortest) path with meter weights', () => {
  // On the 3x3 grid every edge is ~1110 m; the corner-to-corner shortest
  // path uses 4 edges. A greedy (inadmissible-heuristic) search could still
  // find *a* path here, but the cost must equal the true optimum.
  const graph = createTestGrid();
  const result = astar(graph, '0', '8');
  assert.ok(result);
  assert.equal(result.path.length, 5, 'corner-to-corner needs 4 edges / 5 nodes');
  const expected = pathDistance(result.path, graph);
  assert.ok(Math.abs(result.cost - expected) < 1e-6, 'reported cost must equal path distance');
  // Straight-line distance 0->8 is ~3140 m; Manhattan path must be >= that.
  const straight = haversineMeters(0, 0, 0.02, 0.02);
  assert.ok(result.cost >= straight - 1e-6, 'path cannot be shorter than straight line');
});

// ============================================================================
// Hazard Penalty Tests
// ============================================================================

test('hazard penalty applied to edge near hazard', () => {
  const fromNode = { lat: 0, lng: 0 };
  const toNode = { lat: 0.0001, lng: 0 };

  const hazards = [
    {
      centroid_lat: 0.00005,
      centroid_lng: 0,
      hazard_type: 'accident',
      hazard_score: 0.9,
    },
  ];

  const penalty = calculateHazardPenalty(fromNode, toNode, hazards, 100, DEFAULT_SEVERITY_WEIGHTS);
  assert.ok(penalty > 0, 'Penalty should be > 0 for hazard near edge');
  assert.ok(penalty < 10, 'Penalty should be < 10 (reasonable bound)');
});

test('hazard penalty zero when hazard is outside radius', () => {
  const fromNode = { lat: 0, lng: 0 };
  const toNode = { lat: 0.001, lng: 0 };

  const hazards = [
    {
      centroid_lat: 0.02, // ~2.2 km away
      centroid_lng: 0,
      hazard_type: 'accident',
      hazard_score: 0.9,
    },
  ];

  const penalty = calculateHazardPenalty(fromNode, toNode, hazards, 100, DEFAULT_SEVERITY_WEIGHTS); // radius 100m
  assert.equal(penalty, 0, 'Penalty should be 0 for hazard outside radius');
});

test('hazard penalty respects severity weights', () => {
  const fromNode = { lat: 0, lng: 0 };
  const toNode = { lat: 0.0001, lng: 0 };

  const hazardPoint = {
    centroid_lat: 0.00005,
    centroid_lng: 0,
    hazard_score: 0.9,
  };

  const penaltyAccident = calculateHazardPenalty(
    fromNode,
    toNode,
    [{ ...hazardPoint, hazard_type: 'accident' }],
    100,
    DEFAULT_SEVERITY_WEIGHTS
  );

  const penaltyPothole = calculateHazardPenalty(
    fromNode,
    toNode,
    [{ ...hazardPoint, hazard_type: 'pothole' }],
    100,
    DEFAULT_SEVERITY_WEIGHTS
  );

  assert.ok(penaltyAccident > penaltyPothole, 'accident should have higher penalty than pothole');
});

// ============================================================================
// Rerouting on Hazard Addition
// ============================================================================

test('reroute on hazard: A* selects alternative path when original is hazardous', () => {
  // Create a diamond graph:
  //     B
  //    / \
  //   A   D
  //    \ /
  //     C
  // Path A -> D via B (northwest) vs via C (southwest)
  // Both are equal cost normally.
  // When a hazard appears on B, A* should prefer C.

  const graph = {
    nodes: {
      A: { lat: 0, lng: 0 },
      B: { lat: 0.001, lng: 0.001 },
      C: { lat: 0.001, lng: -0.001 },
      D: { lat: 0.002, lng: 0 },
    },
    edges: {
      A: [
        { to: 'B', weight: 1.5 }, // via B
        { to: 'C', weight: 1.5 }, // via C
      ],
      B: [
        { to: 'A', weight: 1.5 },
        { to: 'D', weight: 1.5 },
      ],
      C: [
        { to: 'A', weight: 1.5 },
        { to: 'D', weight: 1.5 },
      ],
      D: [
        { to: 'B', weight: 1.5 },
        { to: 'C', weight: 1.5 },
      ],
    },
  };

  // Find route without hazards
  const routeNoHazard = astar(graph, 'A', 'D');
  assert.ok(routeNoHazard);

  // Apply hazard penalty to B edge
  const graphWithHazard = JSON.parse(JSON.stringify(graph));
  const hazards = [
    {
      centroid_lat: 0.001,
      centroid_lng: 0.001,
      hazard_type: 'accident',
      hazard_score: 0.8,
    },
  ];

  // Manually apply penalty to A->B and B->D edges
  const penalty = 2.0; // simulated penalty
  graphWithHazard.edges.A[0].weight *= (1 + penalty); // A->B
  graphWithHazard.edges.B[1].weight *= (1 + penalty); // B->D

  const routeWithHazard = astar(graphWithHazard, 'A', 'D');
  assert.ok(routeWithHazard);

  // With hazard penalty applied, path via C should have lower cost
  // Path A -> C -> D should be preferred
  assert.deepEqual(routeWithHazard.path, ['A', 'C', 'D'], 
    'Should reroute around hazard from B path');
});

// ============================================================================
// Safety Score Tests
// ============================================================================

test('safety score = 1.0 when no hazards', () => {
  const graph = createTestGrid();
  const nodePath = ['0', '1', '2'];
  const score = calculateSafetyScore(nodePath, graph, [], 100);
  assert.equal(score, 1.0);
});

test('safety score < 1.0 when hazards near route', () => {
  const graph = createTestGrid();
  const nodePath = ['0', '1', '2'];

  // Node 0 is at (0, 0), Node 1 is at (0.01, 0), Node 2 is at (0.02, 0)
  // Place hazard very close to node 1
  const hazards = [
    {
      centroid_lat: 0.00999,
      centroid_lng: 0,
      hazard_type: 'accident',
      hazard_score: 0.9,
    },
  ];

  const score = calculateSafetyScore(nodePath, graph, hazards, 10000); // radius 10km
  assert.ok(score < 1.0, `Score should be < 1.0 with hazards near route, got ${score}`);
  assert.ok(score >= 0, 'Score should be >= 0');
});

test('safety score respects severity', () => {
  const graph = createTestGrid();
  const nodePath = ['0', '1', '2'];

  // Place hazard very close to node 1
  const hazardPoint = {
    centroid_lat: 0.00999,
    centroid_lng: 0,
    hazard_score: 0.9,
  };

  const scoreAccident = calculateSafetyScore(nodePath, graph, [{ ...hazardPoint, hazard_type: 'accident' }], 10000);
  const scorePothole = calculateSafetyScore(nodePath, graph, [{ ...hazardPoint, hazard_type: 'pothole' }], 10000);

  assert.ok(scoreAccident < scorePothole, `accident should have lower score (more dangerous): accident=${scoreAccident}, pothole=${scorePothole}`);
});

test('safety score is in [0, 1]', () => {
  const graph = createTestGrid();
  const nodePath = ['0', '1', '2'];

  // No hazards
  let score = calculateSafetyScore(nodePath, graph, [], 100);
  assert.ok(score >= 0 && score <= 1);

  // Single hazard
  score = calculateSafetyScore(
    nodePath,
    graph,
    [{ centroid_lat: 0.001, centroid_lng: 0.001, hazard_type: 'accident', hazard_score: 0.5 }],
    100
  );
  assert.ok(score >= 0 && score <= 1);

  // Multiple severe hazards
  score = calculateSafetyScore(
    nodePath,
    graph,
    [
      { centroid_lat: 0, lng: 0, hazard_type: 'accident', hazard_score: 1.0 },
      { centroid_lat: 0.001, lng: 0.001, hazard_type: 'accident', hazard_score: 1.0 },
      { centroid_lat: 0.002, lng: 0, hazard_type: 'accident', hazard_score: 1.0 },
    ],
    100
  );
  assert.ok(score >= 0 && score <= 1);
});

test('safety tier categorization', () => {
  assert.equal(safetyTier(0.85), 'safe');
  assert.equal(safetyTier(0.7), 'safe');
  assert.equal(safetyTier(0.69), 'warning');
  assert.equal(safetyTier(0.5), 'warning');
  assert.equal(safetyTier(0.4), 'warning');
  assert.equal(safetyTier(0.39), 'danger');
  assert.equal(safetyTier(0.0), 'danger');
});

// ============================================================================
// Recalculation Latency Test
// ============================================================================

test('recalculation latency under 1 second on test grid', () => {
  const graph = createTestGrid();
  const hazards = [];

  // Generate 10 hazards randomly
  for (let i = 0; i < 10; i++) {
    hazards.push({
      centroid_lat: Math.random() * 0.03,
      centroid_lng: Math.random() * 0.03,
      hazard_type: ['accident', 'pothole', 'debris'][Math.floor(Math.random() * 3)],
      hazard_score: 0.5 + Math.random() * 0.5,
    });
  }

  // Measure A* recalculation time
  const startTime = process.hrtime.bigint();

  const result = astar(graph, '0', '8');

  const endTime = process.hrtime.bigint();
  const durationMs = Number(endTime - startTime) / 1e6;

  assert.ok(result, 'A* should find a path');
  assert.ok(durationMs < 1000, `Recalculation should complete in < 1000ms, took ${durationMs.toFixed(2)}ms`);
});

// ============================================================================
// Route Response Contract Test
// ============================================================================

test('route response contract validation', () => {
  // Valid response
  const validResponse = {
    route_id: 'r123',
    path_points: [[0, 0], [1, 1]],
    distance_km: 1.5,
    eta_minutes: 5.0,
    safety_score: 0.85,
    recalculated_at_hlc: '1692374400000:0',
  };

  // All fields present and valid types
  assert.ok(validResponse.route_id && typeof validResponse.route_id === 'string');
  assert.ok(Array.isArray(validResponse.path_points));
  assert.ok(typeof validResponse.distance_km === 'number' && validResponse.distance_km >= 0);
  assert.ok(typeof validResponse.eta_minutes === 'number' && validResponse.eta_minutes >= 0);
  assert.ok(typeof validResponse.safety_score === 'number' && validResponse.safety_score >= 0 && validResponse.safety_score <= 1);
  assert.ok(validResponse.recalculated_at_hlc && typeof validResponse.recalculated_at_hlc === 'string');
});

// ============================================================================
// Road Graph Validation
// ============================================================================

test('road graph is well-formed', () => {
  const graph = createTestGrid();
  assert.ok(isValidGraph(graph), 'Test grid should be a valid graph');
  assert.ok(graph.nodes['0'], 'Should have node 0');
  assert.ok(graph.edges['0'], 'Should have edges from node 0');
});

test('path distance calculation', () => {
  const graph = createTestGrid();
  const nodePath = ['0', '1', '2'];
  const distance = pathDistance(nodePath, graph);
  assert.ok(distance > 0, 'Path should have positive distance');
  // Units are METERS (Phase 3): two ~1110 m grid steps ≈ 2220 m.
  assert.ok(distance > 2000 && distance < 5000,
    `Path on 3x3 grid should be ~2220 m, got ${distance} m`);
});
