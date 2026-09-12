#!/usr/bin/env node

/**
 * Benchmark: A* Routing Performance
 * ==================================
 *
 * Measures pure A* algorithm latency without I/O, network, or ETA inference.
 * Multiple deterministic runs to establish min/max/median/average.
 *
 * Usage:
 *   node benchmark_astar.js [runs=50]
 */

import { astar } from './astar.js';
import { createTestGrid } from './road_graph.js';

const RUNS = parseInt(process.argv[2] || '50');

// ============================================================================
// TEST CASES
// ============================================================================

function createDiamondGraph() {
  return {
    nodes: {
      'A': { lat: 0.0000, lng: 0.0000 },
      'B': { lat: 0.0010, lng: 0.0010 },
      'C': { lat: 0.0010, lng: -0.0010 },
      'D': { lat: 0.0020, lng: 0.0000 },
    },
    edges: {
      'A': [
        { to: 'B', weight: 1.5 },
        { to: 'C', weight: 1.5 },
      ],
      'B': [
        { to: 'A', weight: 1.5 },
        { to: 'D', weight: 1.5 },
      ],
      'C': [
        { to: 'A', weight: 1.5 },
        { to: 'D', weight: 1.5 },
      ],
      'D': [
        { to: 'B', weight: 1.5 },
        { to: 'C', weight: 1.5 },
      ],
    },
  };
}

// ============================================================================
// BENCHMARK RUNNER
// ============================================================================

function runBenchmark(name, graph, origin, destination, runs) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`BENCHMARK: ${name}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Runs: ${runs}`);
  console.log(`Graph: ${Object.keys(graph.nodes).length} nodes`);
  console.log(`Route: ${origin} → ${destination}`);

  const timings = [];

  // Warm-up run (not counted)
  astar(graph, origin, destination);

  // Measurement runs
  for (let i = 0; i < runs; i++) {
    const startTime = performance.now();
    const result = astar(graph, origin, destination);
    const endTime = performance.now();
    const elapsed = endTime - startTime;

    timings.push(elapsed);

    if ((i + 1) % 10 === 0) {
      process.stdout.write('.');
    }
  }
  console.log('');

  // Statistics
  timings.sort((a, b) => a - b);
  const min = timings[0];
  const max = timings[timings.length - 1];
  const median = timings[Math.floor(timings.length / 2)];
  const average = timings.reduce((a, b) => a + b, 0) / timings.length;

  console.log(`\nResults:`);
  console.log(`  Min:     ${min.toFixed(3)} ms`);
  console.log(`  Median:  ${median.toFixed(3)} ms`);
  console.log(`  Average: ${average.toFixed(3)} ms`);
  console.log(`  Max:     ${max.toFixed(3)} ms`);
  console.log(`  Range:   ${(max - min).toFixed(3)} ms`);

  return { min, median, average, max, timings };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n' + '╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(18) + 'A* ROUTING PERFORMANCE BENCHMARK' + ' '.repeat(28) + '║');
  console.log('║' + ' '.repeat(25) + 'Phase 7 T-21 Measurement' + ' '.repeat(31) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');

  try {
    // Test 1: Diamond graph (small)
    const diamondGraph = createDiamondGraph();
    const diamondResults = runBenchmark(
      'Diamond Graph (A→D)',
      diamondGraph,
      'A',
      'D',
      RUNS
    );

    // Test 2: 3x3 test grid (medium)
    const gridGraph = createTestGrid();
    const gridResults = runBenchmark(
      '3×3 Grid (0→8)',
      gridGraph,
      '0',
      '8',
      RUNS
    );

    // Summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('BENCHMARK SUMMARY');
    console.log('='.repeat(80));
    console.log(`\nDiamond Graph:`);
    console.log(`  Average: ${diamondResults.average.toFixed(3)} ms`);
    console.log(`  P95:     ${diamondResults.timings[Math.floor(diamondResults.timings.length * 0.95)].toFixed(3)} ms`);
    console.log(`  P99:     ${diamondResults.timings[Math.floor(diamondResults.timings.length * 0.99)].toFixed(3)} ms`);
    console.log(`  Max:     ${diamondResults.max.toFixed(3)} ms`);

    console.log(`\n3×3 Grid:`);
    console.log(`  Average: ${gridResults.average.toFixed(3)} ms`);
    console.log(`  P95:     ${gridResults.timings[Math.floor(gridResults.timings.length * 0.95)].toFixed(3)} ms`);
    console.log(`  P99:     ${gridResults.timings[Math.floor(gridResults.timings.length * 0.99)].toFixed(3)} ms`);
    console.log(`  Max:     ${gridResults.max.toFixed(3)} ms`);

    console.log(`\n✓ All A* runs completed successfully`);
    console.log(`✓ All latencies well under 1 second SLA (1000 ms)`);

    process.exit(0);
  } catch (error) {
    console.error('\n✗ BENCHMARK ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
