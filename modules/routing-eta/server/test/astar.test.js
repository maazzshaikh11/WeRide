import { test } from 'node:test';
import assert from 'node:assert';
import { haversineMeters, astar, applyHazardPenalties, routeSafetyScore } from '../astar.js';

test('haversine known distance', () => {
  const d = haversineMeters(0, 0, 0, 1);
  assert.ok(Math.abs(d / 1000 - 111) < 2);
});

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

test('hazard penalty increases edge weight', () => {
  const graph = {
    nodes: { A: { lat: 0, lng: 0 }, B: { lat: 0.0001, lng: 0 } },
    edges: { A: [{ to: 'B', weight: 1 }] },
  };
  const before = graph.edges.A[0].weight;
  applyHazardPenalties(graph, [{
    centroid_lat: 0.00005, centroid_lng: 0, hazard_type: 'accident', hazard_score: 0.9,
  }], 100);
  const after = graph.edges.A[0].weight;
  assert.ok(after > before, `penalty should increase weight: ${before} → ${after}`);
});

test('safety score: no hazards = 1', () => {
  const graph = { nodes: { A: { lat: 0, lng: 0 } } };
  const score = routeSafetyScore(['A'], graph, [], 100);
  assert.equal(score, 1.0);
});

test('safety score: hazard near route < 1', () => {
  const graph = { nodes: { A: { lat: 0, lng: 0 } } };
  const score = routeSafetyScore(['A'], graph, [{
    centroid_lat: 0.00001, centroid_lng: 0, hazard_type: 'accident', hazard_score: 0.9,
  }], 100);
  assert.ok(score < 1.0);
});