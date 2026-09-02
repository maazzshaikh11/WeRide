import { Ekf } from '../src/ekf';
import { SpoofDetector } from '../src/spoofDetector';

describe('EKF', () => {
  test('initializes with given state', () => {
    const ekf = new Ekf({ lat: 12.34, lng: 56.78 });
    expect(ekf.lat).toBe(12.34);
    expect(ekf.lng).toBe(56.78);
    expect(ekf.spoofFlag).toBe(false);
  });

  test('NIS chi-squared sanity: mean stays bounded over normal ticks', () => {
    const ekf = new Ekf({ lat: 0, lng: 0 });
    const nisValues: number[] = [];
    for (let i = 0; i < 1000; i++) {
      const noise = (i % 7 - 3) * 0.000001;
      nisValues.push(ekf.update(ekf.lat + noise, ekf.lng + noise));
    }
    const mean = nisValues.reduce((a, b) => a + b, 0) / nisValues.length;
    // chi-squared(2) has mean 2; allow wide tolerance since this is simplified
    expect(mean).toBeLessThan(50);
  });

  test('spoof injection detected: teleport 1km flips flag', () => {
    const ekf = new Ekf({ lat: 0, lng: 0 });
    for (let i = 0; i < 10; i++) ekf.update(ekf.lat + 0.000001, ekf.lng + 0.000001);
    expect(ekf.spoofFlag).toBe(false);
    // Spoof: teleport ~1km (0.01 degrees ≈ 1.1km)
    for (let i = 0; i < 5; i++) ekf.update(ekf.lat + 0.01, ekf.lng + 0.01);
    expect(ekf.spoofFlag).toBe(true);
  });

  test('spoof recovery: flag clears after low-NIS ticks', () => {
    const ekf = new Ekf({ lat: 0, lng: 0, spoofRecoveryTicks: 3 });
    for (let i = 0; i < 5; i++) ekf.update(ekf.lat + 0.05, ekf.lng + 0.05);
    expect(ekf.spoofFlag).toBe(true);
    for (let i = 0; i < 10; i++) ekf.update(ekf.lat, ekf.lng);
    expect(ekf.spoofFlag).toBe(false);
  });

  test('serializes and deserializes state exactly', () => {
    const original = new Ekf({ lat: 10, lng: 20 });
    original.speed = 15;
    original.heading = 90;
    original.P = new Array(16).fill(0.5);
    original.nisScore = 3.14;
    // force flag
    for (let i = 0; i < 5; i++) original.update(100, 100);
    expect(original.spoofFlag).toBe(true);

    const state = original.toState();
    expect(state.lat).toBe(original.lat);
    expect(state.spoofFlag).toBe(true);

    const restored = Ekf.fromState(state);
    expect(restored.lat).toBe(state.lat);
    expect(restored.lng).toBe(state.lng);
    expect(restored.speed).toBe(state.speed);
    expect(restored.heading).toBe(state.heading);
    expect(restored.P).toEqual(state.p);
    expect(restored.nisScore).toBe(state.nisScore);
    expect(restored.spoofFlag).toBe(true);
  });
});

describe('SpoofDetector', () => {
  test('triggers after N consecutive above-threshold', () => {
    const d = new SpoofDetector({ threshold: 5.0, triggerTicks: 3 });
    expect(d.update(6.0)).toBe(false);
    expect(d.update(6.0)).toBe(false);
    expect(d.update(6.0)).toBe(true);
  });

  test('resets above count on below-threshold', () => {
    const d = new SpoofDetector({ threshold: 5.0, triggerTicks: 3 });
    d.update(6.0);
    d.update(6.0);
    d.update(1.0); // reset
    expect(d.update(6.0)).toBe(false);
  });

  test('recovers after M consecutive below-threshold', () => {
    const d = new SpoofDetector({ threshold: 5.0, triggerTicks: 1, recoveryTicks: 3 });
    d.update(10.0); // trigger
    expect(d.isFlagged).toBe(true);
    expect(d.update(1.0)).toBe(true); // still flagged
    expect(d.update(1.0)).toBe(true); // still flagged
    expect(d.update(1.0)).toBe(false); // recovered
  });
});
