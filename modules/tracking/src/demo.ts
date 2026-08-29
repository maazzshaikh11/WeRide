/**
 * Phase 5 Demo — EKF run with spoof injection.
 *
 * Runs a deterministic EKF simulation using the mock location producer
 * as a synthetic GPS+IMU source. Injects a spoof jump at tick 50 and
 * prints a table showing NIS spike and spoofFlag transition.
 *
 * Deterministic: fixed polyline, fixed tick count (100), fixed tick rate
 * (1 Hz), no wall-clock dependency, no random seeds. Output is identical
 * on every run.
 *
 * Usage: npx ts-node modules/tracking/src/demo.ts
 */

import { Ekf } from './ekf';
import { MockLocationProducer, HlcSource } from './mockLocationProducer';
import { HLC } from '@hazard/hlc/hlc';

// Sample polyline: a square around San Francisco (~1km per side)
const POLYLINE: number[][] = [
  [37.7749, -122.4194],
  [37.7849, -122.4194],
  [37.7849, -122.4094],
  [37.7749, -122.4094],
  [37.7749, -122.4194],
];

const TICK_COUNT = 100;
const SPOOF_TICK = 50;
const SPOOF_DELTA_LAT = 0.01;  // ~1.1 km
const SPOOF_DELTA_LNG = 0.01;  // ~1.1 km

// Simple in-memory HLC source (no MMKV persistence needed for demo)
const hlcInstance = HLC.fresh();
const demoHlc: HlcSource = {
  now(): string {
    return hlcInstance.now();
  },
};

// Console logger as a no-op publisher
const noopPublisher = {
  publish: (payload: any) => { /* no-op */ },
};

function main(): void {
  // Initialize EKF at first polyline point
  const ekf = new Ekf({
    lat: POLYLINE[0][0],
    lng: POLYLINE[0][1],
    speed: 8.0,
    heading: 0,
  });

  // Create mock with no-op publisher (demo prints to console instead)
  const mock = new MockLocationProducer({
    publisher: noopPublisher as any,
    polyline: POLYLINE,
    hlc: demoHlc,
    intervalMs: 1000,
    speedMps: 8.0,
  });

  // Get externally-driven sensor source
  const sensorSource = mock.asSensorSource();

  console.log('=== Phase 5 Demo: EKF with Spoof Injection ===');
  console.log(`Polyline: ${POLYLINE.length} points, Ticks: ${TICK_COUNT}`);
  console.log(`Spoof injection at tick ${SPOOF_TICK}: +${SPOOF_DELTA_LAT}°, +${SPOOF_DELTA_LNG}°`);
  console.log('');
  console.log('Tick | Lat         | Lng          | Speed | Heading | NIS      | Spoof');
  console.log('-----|-------------|--------------|-------|---------|----------|------');

  for (let tick = 0; tick < TICK_COUNT; tick++) {
    // Inject spoof at the configured tick
    if (tick === SPOOF_TICK) {
      mock.injectSpoof(SPOOF_DELTA_LAT, SPOOF_DELTA_LNG);
    }

    // Advance mock by one tick (drives sensor source)
    const { lat, lng, heading } = sensorSource.tick();

    // Get IMU sample for EKF prediction
    const imu = sensorSource.getImuSample();

    // EKF predict step (IMU-driven)
    ekf.predict(1.0, imu.accelForward, imu.headingRateDegPerSec);

    // EKF update step (GPS-driven)
    const nis = ekf.update(lat, lng);

    const spoofFlag = ekf.spoofFlag;

    console.log(
      `${tick.toString().padStart(4)} | ` +
      `${lat.toFixed(6).padStart(11)} | ` +
      `${lng.toFixed(6).padStart(12)} | ` +
      `${ekf.speed.toFixed(2).padStart(5)} | ` +
      `${heading.toFixed(1).padStart(7)} | ` +
      `${nis.toFixed(4).padStart(8)} | ` +
      `${spoofFlag ? 'true ' : 'false'}`
    );
  }

  console.log('');
  console.log('=== Summary ===');
  console.log(`Final position: ${ekf.lat.toFixed(6)}, ${ekf.lng.toFixed(6)}`);
  console.log(`Final speed: ${ekf.speed.toFixed(2)} m/s`);
  console.log(`Final heading: ${ekf.heading.toFixed(1)}°`);
  console.log(`Final NIS: ${ekf.nisScore.toFixed(4)}`);
  console.log(`Final spoofFlag: ${ekf.spoofFlag}`);
  console.log(`Spoof threshold: ${ekf.nisThreshold} (chi-squared(2) 95th pct)`);
  console.log(`Spoof trigger ticks: ${ekf.spoofTriggerTicks}`);
  console.log(`Spoof recovery ticks: ${ekf.spoofRecoveryTicks}`);
}

main();