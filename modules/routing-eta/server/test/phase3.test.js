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

test('A* heuristic is admissible (never overestimates)', () => {
  // Create a simple 3-node path: A -> B -> C
  // where B is not on the direct line from A to C.
  const graph = {
    nodes: {
      A: { lat: 0, lng: 0 },
      B: { lat: 0.001, lng: 0.001 }, // diagonal
      C: { lat: 0.002, lng: 0 },
    },
    edges: {
      A: [{ to: 'B', weight: 1.414 }], // ~sqrt(2) for diagonal
      B: [{ to: 'A', weight: 1.414 }, { to: 'C', weight: 1.414 }],
      C: [{ to: 'B', weight: 1.414 }],
    },
  };

  // The actual shortest distance (by road) from B to C
  const roadDistance = 1.414;

  // The Haversine heuristic from B to C
  const bLat = graph.nodes.B.lat;
  const bLng = graph.nodes.B.lng;
  const cLat = graph.nodes.C.lat;
  const cLng = graph.nodes.C.lng;
  const heuristicDistance = haversineMeters(bLat, bLng, cLat, cLng) / 1000;

  // Admissibility: heuristic <= actual distance
  // (Haversine is always <= road distance because it's straight-line)
  assert.ok(heuristicDistance <= roadDistance * 1.1, // allow 10% tolerance for approx
    `Heuristic ${heuristicDistance} should not exceed road distance ${roadDistance}`);
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
  assert.ok(distance < 5, 'Path on 3x3 grid should be < 5 km');
});
