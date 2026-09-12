/**
 * Road Graph representation.
 *
 * In-memory graph abstraction suitable for MVP routing.
 * Supports:
 * - Node and edge creation
 * - Haversine distance calculations between nodes
 * - Graph export/import for testing and persistence
 *
 * Graph structure:
 * {
 *   nodes: { id: { lat, lng } },
 *   edges: { id: [{ to, weight }] }
 * }
 *
 * Weight is pre-calculated Haversine distance in km.
 * Can be adjusted for hazards via applyHazardPenalties.
 */

import { haversineMeters } from './astar.js';

/**
 * Create a new empty graph.
 * @returns {Object} graph structure
 */
export function createGraph() {
  return { nodes: {}, edges: {} };
}

/**
 * Add a node to the graph.
 * @param {Object} graph
 * @param {string} nodeId
 * @param {number} lat
 * @param {number} lng
 */
export function addNode(graph, nodeId, lat, lng) {
  graph.nodes[nodeId] = { lat, lng };
  if (!graph.edges[nodeId]) {
    graph.edges[nodeId] = [];
  }
}

/**
 * Add a bidirectional edge between two nodes.
 * Weight is Haversine distance in km.
 * @param {Object} graph
 * @param {string} fromId
 * @param {string} toId
 */
export function addEdge(graph, fromId, toId) {
  const fromNode = graph.nodes[fromId];
  const toNode = graph.nodes[toId];
  if (!fromNode || !toNode) {
    throw new Error(`Node ${fromId} or ${toId} not found`);
  }

  const distanceM = haversineMeters(fromNode.lat, fromNode.lng, toNode.lat, toNode.lng);
  const distanceKm = distanceM / 1000;

  // Add edge from -> to
  if (!graph.edges[fromId]) graph.edges[fromId] = [];
  graph.edges[fromId].push({ to: toId, weight: distanceKm });

  // Add edge to -> from (bidirectional)
  if (!graph.edges[toId]) graph.edges[toId] = [];
  graph.edges[toId].push({ to: fromId, weight: distanceKm });
}

/**
 * Create a simple test grid graph.
 * Useful for deterministic testing.
 *
 * 3x3 grid:
 *   0 - 1 - 2
 *   |   |   |
 *   3 - 4 - 5
 *   |   |   |
 *   6 - 7 - 8
 *
 * Lat increases downward, lng increases rightward.
 * Each step is ~0.01 degrees (~1.1 km).
 */
export function createTestGrid() {
  const graph = createGraph();

  // Create 3x3 grid of nodes
  // lat: 0, 0.01, 0.02 (top to bottom)
  // lng: 0, 0.01, 0.02 (left to right)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const nodeId = (row * 3 + col).toString();
      const lat = row * 0.01;
      const lng = col * 0.01;
      addNode(graph, nodeId, lat, lng);
    }
  }

  // Connect horizontally
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      const fromId = (row * 3 + col).toString();
      const toId = (row * 3 + col + 1).toString();
      addEdge(graph, fromId, toId);
    }
  }

  // Connect vertically
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const fromId = (row * 3 + col).toString();
      const toId = ((row + 1) * 3 + col).toString();
      addEdge(graph, fromId, toId);
    }
  }

  return graph;
}

/**
 * Extract path coordinates from node IDs.
 * @param {string[]} nodePath - array of node IDs from A*
 * @param {Object} graph
 * @returns {Array} array of [lat, lng] coordinate pairs
 */
export function pathToCoordinates(nodePath, graph) {
  return nodePath.map(nodeId => {
    const node = graph.nodes[nodeId];
    if (!node) throw new Error(`Node ${nodeId} not found in graph`);
    return [node.lat, node.lng];
  });
}

/**
 * Calculate total distance of a path in km.
 * @param {string[]} nodePath
 * @param {Object} graph
 * @returns {number} distance in km
 */
export function pathDistance(nodePath, graph) {
  let total = 0;
  for (let i = 0; i < nodePath.length - 1; i++) {
    const from = nodePath[i];
    const to = nodePath[i + 1];
    const edges = graph.edges[from] || [];
    const edge = edges.find(e => e.to === to);
    if (edge) {
      total += edge.weight;
    }
  }
  return total;
}

/**
 * Validate that graph structure is well-formed.
 * @param {Object} graph
 * @returns {boolean} true if valid
 */
export function isValidGraph(graph) {
  if (!graph.nodes || typeof graph.nodes !== 'object') return false;
  if (!graph.edges || typeof graph.edges !== 'object') return false;

  for (const nodeId in graph.nodes) {
    const node = graph.nodes[nodeId];
    if (typeof node.lat !== 'number' || typeof node.lng !== 'number') {
      return false;
    }
  }

  for (const fromId in graph.edges) {
    const edges = graph.edges[fromId];
    if (!Array.isArray(edges)) return false;
    for (const edge of edges) {
      if (!graph.nodes[edge.to] || typeof edge.weight !== 'number') {
        return false;
      }
    }
  }

  return true;
}
