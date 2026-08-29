import { MockLocationProducer, HlcSource } from '../src/mockLocationProducer';
import { LocationPublisher, VerifiedLocationPayload } from '../src/locationPublisher';

/** Mock implementation of HlcSource for testing */
class MockHlc implements HlcSource {
  private counter = 0;

  now(): string {
    return `${Date.now()}:${this.counter++}`;
  }
}

/** Mock LocationPublisher for testing */
class MockLocationPublisher {
  lastPayload?: VerifiedLocationPayload;
  payloads: VerifiedLocationPayload[] = [];

  publish(p: VerifiedLocationPayload): void {
    this.lastPayload = p;
    this.payloads.push(p);
  }
}

describe('MockLocationProducer', () => {
  test('emits with HLC timestamp (not fake format)', (done) => {
    const hlc = new MockHlc();
    const publisher = new MockLocationPublisher() as any;
    const polyline = [
      [0, 0],
      [1, 1],
    ];

    const producer = new MockLocationProducer({
      publisher,
      polyline,
      hlc,
      intervalMs: 10, // Fast for testing
    });

    producer.start();

    setTimeout(() => {
      producer.stop();
      // Check that timestampHlc follows HLC format (physical:counter)
      expect(publisher.lastPayload?.timestampHlc).toBeDefined();
      expect(publisher.lastPayload!.timestampHlc).toMatch(/^\d+:\d+$/); // HLC format
      expect(publisher.lastPayload!.timestampHlc).not.toMatch(/^mock-/); // Not the old fake format
      done();
    }, 50);
  });

  test('computes heading from polyline bearing', (done) => {
    const hlc = new MockHlc();
    const publisher = new MockLocationPublisher() as any;

    // Polyline with distinctive headings:
    // From [0,0] to [1,0] should be north (heading ≈ 0)
    // From [1,0] to [1,1] should be east (heading ≈ 90)
    const polyline = [
      [0, 0],   // First point
      [1, 0],   // Second point (north)
    ];

    const producer = new MockLocationProducer({
      publisher,
      polyline,
      hlc,
      intervalMs: 10,
    });

    producer.start();

    setTimeout(() => {
      producer.stop();

      // Should have emitted from both points in the polyline
      expect(publisher.payloads.length).toBeGreaterThan(0);

      // Find payload at [0, 0] - heading should be to [1, 0] = north (≈0)
      const payload0 = publisher.payloads.find(
        (p: VerifiedLocationPayload) => Math.abs(p.lat - 0) < 0.01 && Math.abs(p.lng - 0) < 0.01
      );
      expect(payload0).toBeDefined();
      expect(payload0!.headingDeg).toBeLessThan(45); // Roughly north

      // Find payload at [1, 0] - heading should be back to [0, 0] = south (≈180)
      const payload1 = publisher.payloads.find(
        (p: VerifiedLocationPayload) => Math.abs(p.lat - 1) < 0.01 && Math.abs(p.lng - 0) < 0.01
      );
      expect(payload1).toBeDefined();
      expect(payload1!.headingDeg).toBeGreaterThan(170); // Roughly south

      done();
    }, 100);
  });

  test('wraps heading correctly in [0, 360)', (done) => {
    const hlc = new MockHlc();
    const publisher = new MockLocationPublisher() as any;

    const polyline = [
      [40.7128, -74.006],  // NYC
      [40.7138, -74.0096], // Point B
    ];

    const producer = new MockLocationProducer({
      publisher,
      polyline,
      hlc,
      intervalMs: 10,
    });

    producer.start();

    setTimeout(() => {
      producer.stop();

      // All headings should be in valid range
      for (const payload of publisher.payloads) {
        expect(payload.headingDeg).toBeGreaterThanOrEqual(0);
        expect(payload.headingDeg).toBeLessThan(360);
      }
      done();
    }, 50);
  });

  test('mock contract payload is valid', (done) => {
    const hlc = new MockHlc();
    const publisher = new MockLocationPublisher() as any;
    const polyline = [[37.7749, -122.4194]];

    const producer = new MockLocationProducer({
      publisher,
      polyline,
      hlc,
      intervalMs: 10,
      speedMps: 2.5,
    });

    producer.start();

    setTimeout(() => {
      producer.stop();
      const p = publisher.lastPayload;
      expect(p).toBeDefined();
      expect(p!.timestampHlc).toBeDefined();
      expect(p!.lat).toBeDefined();
      expect(p!.lng).toBeDefined();
      expect(p!.speedMps).toBe(2.5);
      expect(p!.headingDeg).toBeDefined();
      expect(p!.spoofFlag).toBe(false);
      expect(p!.nisScore).toBe(1.0);
      expect(p!.accuracyM).toBe(5.0);
      done();
    }, 50);
  });

  test('heading is not hardcoded to zero', (done) => {
    const hlc = new MockHlc();
    const publisher = new MockLocationPublisher() as any;

    // Create polyline with different headings
    const polyline = [
      [0, 0],      // To [10, 0] = north
      [10, 0],     // To [10, 10] = east
      [10, 10],    // To [0, 10] = south
      [0, 10],     // Back to [0, 0] = west
    ];

    const producer = new MockLocationProducer({
      publisher,
      polyline,
      hlc,
      intervalMs: 10,
    });

    producer.start();

    setTimeout(() => {
      producer.stop();

      // Should have varied headings, not all zero
      const headings = publisher.payloads.map((p: VerifiedLocationPayload) => p.headingDeg);
      const uniqueHeadings = new Set(headings.map((h: number) => Math.round(h / 45))); // Group by ~45° increments

      expect(uniqueHeadings.size).toBeGreaterThan(1); // Should have multiple different directions

      done();
    }, 100);
  });
});
