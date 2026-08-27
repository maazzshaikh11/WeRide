#!/usr/bin/env node

/**
 * Benchmark: Hazard-Triggered Rerouting Performance
 * ==================================================
 *
 * Measures the time from initial route to reroute completion when a hazard is injected.
 * Captures the full server-side rerouting pipeline:
 *   1. A* calculates initial route (no hazards)
 *   2. Hazard penalty applied to graph
 *   3. A* recalculates with penalties
 *   4. Result returned
 *
 * Multiple deterministic runs to measure consistency and establish SLA compliance.
 *
 * Usage:
 *   node benchmark_rerouting.js [runs=30]
 */

import { astar } from './astar.js';
import { applyHazardPenaltiesToGraph } from './hazard_penalty.js';
import { calculateSafetyScore } from './safety_score.js';

const RUNS = parseInt(process.argv[2] || '30');

// ============================================================================
// DIAMOND GRAPH (proven rerouting scenario)
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
// REROUTING MEASUREMENT
// ============================================================================

function measureReroutingCycle(graph, origin, destination, hazard, runs) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`REROUTING PERFORMANCE: ${origin} → ${destination}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Runs: ${runs}`);
  console.log(`Hazard: ${hazard.hazard_type} (${(hazard.hazard_score * 100).toFixed(0)}%) at (${hazard.centroid_lat}, ${hazard.centroid_lng})`);

  const timings = {
    initial: [],
    penalty_apply: [],
    reroute: [],
    safety_calc: [],
    total: [],
  };

  // Configuration
  const HAZARD_RADIUS_M = 500;
  const SEVERITY_WEIGHTS = {
    accident: 5.0,
    oil_spill: 4.0,
    debris: 3.0,
    pothole: 2.0,
    other: 1.0,
  };

  for (let i = 0; i < runs; i++) {
    // Make fresh graph copy for each run
    const graphCopy = JSON.parse(JSON.stringify(graph));

    // Phase 1: Initial route (no hazards)
    const t1 = performance.now();
    const initialResult = astar(graphCopy, origin, destination);
    const t2 = performance.now();
    timings.initial.push(t2 - t1);

    // Phase 2: Apply hazard penalties to graph
    const t3 = performance.now();
    applyHazardPenaltiesToGraph(graphCopy, [hazard], HAZARD_RADIUS_M, SEVERITY_WEIGHTS);
    const t4 = performance.now();
    timings.penalty_apply.push(t4 - t3);

    // Phase 3: Reroute with penalties
    const t5 = performance.now();
    const rerouteResult = astar(graphCopy, origin, destination);
    const t6 = performance.now();
    timings.reroute.push(t6 - t5);

    // Phase 4: Calculate safety score
    const t7 = performance.now();
    const safetyScore = calculateSafetyScore(
      rerouteResult.path,
      graphCopy,
      [hazard],
      HAZARD_RADIUS_M,
      SEVERITY_WEIGHTS
    );
    const t8 = performance.now();
    timings.safety_calc.push(t8 - t7);

    // Total
    const totalTime = (t8 - t1);
    timings.total.push(totalTime);

    // Progress
    if ((i + 1) % 10 === 0) {
      process.stdout.write('.');
    }

    // Verify path actually changed
    const pathChanged = initialResult.path.join('') !== rerouteResult.path.join('');
    if (!pathChanged) {
      console.error(`\n✗ WARNING: Path did not change on run ${i + 1}`);
      console.error(`  Initial: ${initialResult.path.join(' → ')}`);
      console.error(`  Reroute: ${rerouteResult.path.join(' → ')}`);
    }
  }
  console.log('');

  // Analyze each phase
  function analyzePhase(phaseName, times) {
    times.sort((a, b) => a - b);
    const min = times[0];
    const max = times[times.length - 1];
    const median = times[Math.floor(times.length / 2)];
    const average = times.reduce((a, b) => a + b, 0) / times.length;
    const p95 = times[Math.floor(times.length * 0.95)];
    const p99 = times[Math.floor(times.length * 0.99)];

    console.log(`\n${phaseName}:`);
    console.log(`  Min:     ${min.toFixed(3)} ms`);
    console.log(`  Median:  ${median.toFixed(3)} ms`);
    console.log(`  Average: ${average.toFixed(3)} ms`);
    console.log(`  P95:     ${p95.toFixed(3)} ms`);
    console.log(`  P99:     ${p99.toFixed(3)} ms`);
    console.log(`  Max:     ${max.toFixed(3)} ms`);

    return { min, median, average, max, p95, p99 };
  }

  console.log(`\nPhase Breakdown:`);
  const stats = {
    initial: analyzePhase('1. Initial Route (A*)', timings.initial),
    penalty: analyzePhase('2. Apply Penalties', timings.penalty_apply),
    reroute: analyzePhase('3. Reroute (A*)', timings.reroute),
    safety: analyzePhase('4. Safety Score', timings.safety_calc),
    total: analyzePhase('5. TOTAL REROUTING', timings.total),
  };

  // SLA check
  const SLA_MS = 1000;
  const slaViolations = timings.total.filter(t => t > SLA_MS).length;
  const slaCompliance = ((runs - slaViolations) / runs * 100).toFixed(1);

  console.log(`\nSLA Compliance (<${SLA_MS}ms):`);
  console.log(`  Compliant:  ${runs - slaViolations}/${runs} runs (${slaCompliance}%)`);
  console.log(`  Violations: ${slaViolations}/${runs} runs`);

  if (stats.total.max > SLA_MS) {
    console.log(`  ✗ Max latency ${stats.total.max.toFixed(3)}ms EXCEEDS SLA`);
  } else {
    console.log(`  ✓ All runs within SLA`);
  }

  return stats;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n' + '╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(12) + 'HAZARD-TRIGGERED REROUTING PERFORMANCE BENCHMARK' + ' '.repeat(18) + '║');
  console.log('║' + ' '.repeat(25) + 'Phase 7 T-21 Measurement' + ' '.repeat(31) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');

  try {
    const graph = createDiamondGraph();

    // Hazard at node B (northern route)
    const hazard = {
      centroid_lat: 0.001,
      centroid_lng: 0.001,
      hazard_type: 'accident',
      hazard_score: 0.8,
    };

    const stats = measureReroutingCycle(
      graph,
      'A',
      'D',
      hazard,
      RUNS
    );

    // Summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('REROUTING SUMMARY');
    console.log('='.repeat(80));
    console.log(`\nTotal Rerouting Time (all phases):`);
    console.log(`  Average: ${stats.total.average.toFixed(3)} ms`);
    console.log(`  Median:  ${stats.total.median.toFixed(3)} ms`);
    console.log(`  P95:     ${stats.total.p95.toFixed(3)} ms`);
    console.log(`  P99:     ${stats.total.p99.toFixed(3)} ms`);
    console.log(`  Max:     ${stats.total.max.toFixed(3)} ms`);

    console.log(`\nKey Observations:`);
    console.log(`  ✓ A* recalculation: ${stats.reroute.average.toFixed(3)} ms average`);
    console.log(`  ✓ Penalty application: ${stats.penalty.average.toFixed(3)} ms average`);
    console.log(`  ✓ Safety score calculation: ${stats.safety.average.toFixed(3)} ms average`);
    console.log(`  ✓ Total server latency: ${stats.total.average.toFixed(3)} ms average`);
    console.log(`  ✓ SLA target (<1000 ms): ${stats.total.max.toFixed(3)} ms max`);

    if (stats.total.max <= 1000) {
      console.log(`\n✓ SLA VERIFIED: All rerouting operations complete within 1 second`);
    } else {
      console.log(`\n✗ SLA VIOLATION: Max latency exceeds 1 second`);
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n✗ BENCHMARK ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
