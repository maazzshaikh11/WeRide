/**
 * Crash detector scenarios (pure: samples in, impact callback out). Times are explicit ms so nothing is flaky.
 * Accelerometer samples include gravity (~9.8 m/s² at rest).
 */
import {
  COOLDOWN_MS, IMPACT_MS2, MOVING_MS, STOPPED_MS, STOP_WITHIN_MS, createCrashDetector,
} from '../src/services/crashDetector';

const REST = [0, 0, 9.8] as const;
/** A rider cruising at `mps` from t0 for `secs`: speed 1 Hz, accel at 20 Hz (~gravity with road buzz). */
function cruise(d: ReturnType<typeof createCrashDetector>, t0: number, secs: number, mps: number) {
  for (let t = t0; t < t0 + secs * 1000; t += 50) {
    d.pushAccel(REST[0] + 0.3, REST[1], REST[2] + 0.2, t);
    if ((t - t0) % 1000 === 0) d.pushSpeed(mps, t);
  }
}
/** A hit: two strong samples 50 ms apart; the first one is the peak. */
function hit(d: ReturnType<typeof createCrashDetector>, t: number, peak = 55) {
  d.pushAccel(peak, 10, 8, t);
  d.pushAccel(28, -6, 12, t + 50);
}

describe('createCrashDetector', () => {
  it('exports the thresholds from the brief', () => {
    expect(IMPACT_MS2).toBeGreaterThanOrEqual(38);
    expect(IMPACT_MS2).toBeLessThanOrEqual(40);
    expect(MOVING_MS).toBe(4);
    expect(STOPPED_MS).toBe(1.5);
    expect(STOP_WITHIN_MS).toBe(6000);
    expect(COOLDOWN_MS).toBe(60_000);
  });

  it('crash on a moving bike: hard impact then the speed collapses within 6 s -> impact', () => {
    const onImpact = jest.fn();
    const d = createCrashDetector(onImpact);
    cruise(d, 0, 10, 14); // 50 km/h
    hit(d, 10_000);
    expect(onImpact).not.toHaveBeenCalled(); // not yet: still no proof the bike stopped
    d.pushSpeed(6, 11_000);
    expect(onImpact).not.toHaveBeenCalled();
    d.pushSpeed(0.4, 12_000);
    expect(onImpact).toHaveBeenCalledTimes(1);
    expect(onImpact.mock.calls[0][0]).toMatchObject({ t: 12_000, peakMs2: expect.any(Number) });
    expect(onImpact.mock.calls[0][0].peakMs2).toBeGreaterThanOrEqual(IMPACT_MS2);
  });

  it('a phone dropped while stationary (hard impact, never moving) -> none', () => {
    const onImpact = jest.fn();
    const d = createCrashDetector(onImpact);
    cruise(d, 0, 10, 0);
    hit(d, 10_000, 80);
    d.pushSpeed(0, 11_000);
    d.pushSpeed(0, 12_000);
    expect(onImpact).not.toHaveBeenCalled();
  });

  it('dropped at a red light right after braking to a stop -> none (already stopped at the peak)', () => {
    const onImpact = jest.fn();
    const d = createCrashDetector(onImpact);
    cruise(d, 0, 4, 12);
    d.pushSpeed(0.2, 4_000); // stopped...
    hit(d, 4_500); // ...then the phone hits the ground
    d.pushSpeed(0, 5_000);
    expect(onImpact).not.toHaveBeenCalled();
  });

  it('a pothole jolt at speed that the rider rides through (speed never drops) -> none', () => {
    const onImpact = jest.fn();
    const d = createCrashDetector(onImpact);
    cruise(d, 0, 10, 16);
    hit(d, 10_000, 60);
    for (let t = 11_000; t <= 20_000; t += 1000) d.pushSpeed(15.5, t);
    expect(onImpact).not.toHaveBeenCalled();
  });

  it('stopping later than 6 s after the jolt is not tied to the jolt -> none', () => {
    const onImpact = jest.fn();
    const d = createCrashDetector(onImpact);
    cruise(d, 0, 10, 14);
    hit(d, 10_000);
    d.pushSpeed(14, 12_000);
    d.pushSpeed(14, 16_000);
    d.pushSpeed(0.3, 16_100 + 1000); // 7.1 s later
    expect(onImpact).not.toHaveBeenCalled();
  });

  it('a single noisy spike (one sample, calm neighbours) -> none, even if the bike then stops', () => {
    const onImpact = jest.fn();
    const d = createCrashDetector(onImpact);
    cruise(d, 0, 10, 14);
    d.pushAccel(120, 0, 0, 10_000); // one glitch sample
    for (let t = 10_050; t < 10_500; t += 50) d.pushAccel(0.2, 0.1, 9.8, t);
    d.pushSpeed(0.5, 11_000);
    expect(onImpact).not.toHaveBeenCalled();
  });

  it('a strong sample that is below the impact threshold is not an impact', () => {
    const onImpact = jest.fn();
    const d = createCrashDetector(onImpact);
    cruise(d, 0, 10, 14);
    d.pushAccel(30, 0, 0, 10_000);
    d.pushAccel(28, 0, 0, 10_050);
    d.pushSpeed(0.5, 11_000);
    expect(onImpact).not.toHaveBeenCalled();
  });

  it('cooldown: a second crash inside 60 s is ignored, one after it fires again', () => {
    const onImpact = jest.fn();
    const d = createCrashDetector(onImpact);
    cruise(d, 0, 10, 14);
    hit(d, 10_000);
    d.pushSpeed(0, 11_000);
    expect(onImpact).toHaveBeenCalledTimes(1);

    // rider gets up, rides off and crashes again 30 s later
    cruise(d, 20_000, 10, 14);
    hit(d, 30_000);
    d.pushSpeed(0, 31_000);
    expect(onImpact).toHaveBeenCalledTimes(1);

    // after the cooldown (60 s from the first impact at 11 s)
    cruise(d, 80_000, 10, 14);
    hit(d, 90_000);
    d.pushSpeed(0, 91_000);
    expect(onImpact).toHaveBeenCalledTimes(2);
  });

  it('GPS speed that arrives 5 s before the impact still counts as moving; 6 s before does not', () => {
    const a = jest.fn();
    const d1 = createCrashDetector(a);
    d1.pushSpeed(10, 5_000);
    hit(d1, 10_000);
    d1.pushSpeed(0, 10_500);
    expect(a).toHaveBeenCalledTimes(1);

    const b = jest.fn();
    const d2 = createCrashDetector(b);
    d2.pushSpeed(10, 3_900);
    hit(d2, 10_000);
    d2.pushSpeed(0, 10_500);
    expect(b).not.toHaveBeenCalled();
  });

  it('ignores garbage samples and reset() clears state', () => {
    const onImpact = jest.fn();
    const d = createCrashDetector(onImpact);
    d.pushAccel(NaN, 0, 0, 1);
    d.pushSpeed(NaN, 1);
    d.pushSpeed(-3, 2);
    cruise(d, 0, 10, 14);
    hit(d, 10_000);
    d.reset();
    d.pushSpeed(0, 11_000);
    expect(onImpact).not.toHaveBeenCalled();
  });
});
