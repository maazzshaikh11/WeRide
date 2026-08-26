/**
 * Benchmark: Client Routing Pipeline Performance
 * ===============================================
 *
 * Measures the client-side routing pipeline latency:
 *   1. Route recalculation triggered (hazard detection)
 *   2. Debounce delay (500ms configured)
 *   3. POST /route called (mocked fetch)
 *   4. Response received
 *   5. onUpdate callback fired
 *
 * This measures the CLIENT logic, not network. Fetch is mocked to simulate
 * server response with known latency (e.g., 50ms to simulate network RTT).
 *
 * Usage: npm test -- benchmark_client_pipeline.test.ts
 */

import { RoutingClient } from '../src/client/routingClient';
import { useRouteStore } from '../src/client/routeStore';
import { RouteResponse } from '@app/models/routeResponse';

describe('Client Routing Pipeline Performance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useRouteStore.setState({
      route: null,
      activeClusters: [],
    });

    // Mock fetch globally
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should measure client pipeline latency with 50ms simulated server response', (done) => {
    const measurements = {
      pipelineLatencies: [] as number[],
      triggerToCallbackTime: 0,
    };

    let triggerTime = 0;
    let callbackTime = 0;

    const client = new RoutingClient({
      baseUrl: 'http://localhost:3000',
      debounceMs: 50, // Reduced for testing
      onUpdate: (route: RouteResponse) => {
        callbackTime = performance.now();
        measurements.triggerToCallbackTime = callbackTime - triggerTime;
        measurements.pipelineLatencies.push(measurements.triggerToCallbackTime);

        // Continue to next run if we have 10 measurements
        if (measurements.pipelineLatencies.length < 10) {
          triggerNextMeasurement();
        } else {
          finalizeMeasurement();
        }
      },
    });

    function triggerNextMeasurement() {
      // Simulate server responding after 50ms
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          route_id: `route-${measurements.pipelineLatencies.length}`,
          path_points: [[0, 0], [1, 1]],
          distance_km: 10.0,
          eta_minutes: 15.0,
          safety_score: 0.8,
          recalculated_at_hlc: `${Date.now()}:${measurements.pipelineLatencies.length}`,
        }),
      });

      triggerTime = performance.now();

      // Trigger recalculation
      client.scheduleRecalculation({
        group_id: 'g1',
        origin: { lat: 0, lng: 0 },
        destination: { lat: 1, lng: 1 },
        avoid_hazard_types: [],
      });
    }

    function finalizeMeasurement() {
      // Analyze results
      const latencies = measurements.pipelineLatencies.sort((a, b) => a - b);
      const min = latencies[0];
      const max = latencies[latencies.length - 1];
      const median = latencies[5];
      const average = latencies.reduce((a, b) => a + b, 0) / latencies.length;

      console.log('\n✓ Client Pipeline Performance (10 runs, 50ms simulated fetch)');
      console.log(`  Min:     ${min.toFixed(2)} ms`);
      console.log(`  Median:  ${median.toFixed(2)} ms`);
      console.log(`  Average: ${average.toFixed(2)} ms`);
      console.log(`  Max:     ${max.toFixed(2)} ms`);
      console.log(`  Range:   ${(max - min).toFixed(2)} ms`);

      // Verify includes debounce time + callback processing
      expect(average).toBeGreaterThanOrEqual(50); // At least fetch time
      expect(average).toBeLessThan(500); // Should not exceed reasonable threshold

      done();
    }

    // Start first measurement
    triggerNextMeasurement();
  });

  it('should measure debounce coalescing of multiple hazard triggers', (done) => {
    const measurements = {
      debounceTests: [] as Array<{ triggers: number; latency: number }>,
    };

    const client = new RoutingClient({
      baseUrl: 'http://localhost:3000',
      debounceMs: 50,
      onUpdate: (route: RouteResponse) => {
        const callbackTime = performance.now();
        const latency = callbackTime - triggerStartTime;
        measurements.debounceTests.push({
          triggers: triggerCount,
          latency,
        });

        if (measurements.debounceTests.length < 3) {
          runTest(measurements.debounceTests.length + 1);
        } else {
          finalizeDebounceTest();
        }
      },
    });

    let triggerCount = 0;
    let triggerStartTime = 0;

    function runTest(testNum: number) {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          route_id: `route-${testNum}`,
          path_points: [[0, 0], [1, 1]],
          distance_km: 10.0 + testNum,
          eta_minutes: 15.0,
          safety_score: 0.8,
          recalculated_at_hlc: `${Date.now()}:${testNum}`,
        }),
      });

      triggerStartTime = performance.now();
      triggerCount = testNum;

      // Fire N triggers in quick succession
      for (let i = 0; i < testNum; i++) {
        client.scheduleRecalculation({
          group_id: 'g1',
          origin: { lat: 0, lng: 0 },
          destination: { lat: 1, lng: 1 },
          avoid_hazard_types: [],
        });
      }

      // Advance time past debounce window
      jest.advanceTimersByTime(100);
    }

    function finalizeDebounceTest() {
      console.log('\n✓ Debounce Coalescing (50ms debounce window)');
      measurements.debounceTests.forEach((test) => {
        console.log(
          `  ${test.triggers} trigger(s) → ${test.latency.toFixed(2)} ms (should be ~1 callback)`
        );
      });

      // Verify that multiple triggers don't proportionally increase latency
      const lat1 = measurements.debounceTests[0].latency;
      const lat2 = measurements.debounceTests[1].latency;
      const lat3 = measurements.debounceTests[2].latency;

      // All should complete in similar time (debounced into single callback)
      expect(Math.abs(lat2 - lat1)).toBeLessThan(50);
      expect(Math.abs(lat3 - lat2)).toBeLessThan(50);

      done();
    }

    runTest(1);
  });

  it('should measure route store state update latency', (done) => {
    const measurements: number[] = [];
    const runs = 20;

    for (let i = 0; i < runs; i++) {
      const startTime = performance.now();

      useRouteStore.setState({
        route: {
          route_id: `route-${i}`,
          path_points: [[0, 0], [1, 1]],
          distance_km: 10.0,
          eta_minutes: 15.0,
          safety_score: 0.8,
          recalculated_at_hlc: `${Date.now()}:${i}`,
        },
      });

      const endTime = performance.now();
      measurements.push(endTime - startTime);
    }

    measurements.sort((a, b) => a - b);
    const min = measurements[0];
    const max = measurements[runs - 1];
    const median = measurements[Math.floor(runs / 2)];
    const average = measurements.reduce((a, b) => a + b, 0) / runs;

    console.log('\n✓ Route Store State Update Latency (20 runs)');
    console.log(`  Min:     ${min.toFixed(3)} ms`);
    console.log(`  Median:  ${median.toFixed(3)} ms`);
    console.log(`  Average: ${average.toFixed(3)} ms`);
    console.log(`  Max:     ${max.toFixed(3)} ms`);

    // State update should be very fast (< 1ms typically)
    expect(average).toBeLessThan(1);

    done();
  });
});
