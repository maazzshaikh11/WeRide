/**
 * Unit tests for the AttitudeEstimator (Person A).
 *
 * The filter is validated with hand-computed vectors (no quaternion math
 * duplicated from the implementation):
 *   - Flat device, static: up = (0,0,1).
 *   - Device pitched forward 30° (top tilts toward ground, rotating about
 *     the device x-axis): true up in device frame = (0,-sin30,cos30).
 *     Static accel measured = g * up = (0,-4.905,8.496).
 *   - Same pitch, accelerating north at 2 m/s² (bearing 0): world linear
 *     accel (0,2,0) expressed in the pitched device frame:
 *       y: 2·cos30 = 1.732,  z: 2·sin30 = 1.0
 *     measured = linear + gravity = (0, 1.732-4.905, 1.0+8.496).
 */
import { AttitudeEstimator } from '../src/attitude';

const G = 9.81;
const DEG = 180 / Math.PI;

function feedStatic(est: AttitudeEstimator, accel: { x: number; y: number; z: number }, n: number, dt = 0.1) {
  for (let i = 0; i < n; i++) {
    est.update({ x: 0, y: 0, z: 0 }, accel, dt);
  }
}

describe('AttitudeEstimator', () => {
  test('starts uninitialised; forwardAccel is null until first sample', () => {
    const est = new AttitudeEstimator();
    expect(est.initialised).toBe(false);
    expect(est.forwardAccel({ x: 0, y: 0, z: G }, 0)).toBeNull();
  });

  test('flat static device: up is (0,0,1)', () => {
    const est = new AttitudeEstimator();
    feedStatic(est, { x: 0, y: 0, z: G }, 5);
    expect(est.initialised).toBe(true);
    const up = est.upInDeviceFrame();
    expect(up.x).toBeCloseTo(0, 6);
    expect(up.y).toBeCloseTo(0, 6);
    expect(up.z).toBeCloseTo(1, 6);
  });

  test('tilt correction converges to a 30° forward pitch', () => {
    const est = new AttitudeEstimator();
    // Seed flat, then hold the device pitched forward 30° (static).
    feedStatic(est, { x: 0, y: 0, z: G }, 1);
    feedStatic(est, { x: 0, y: -4.905, z: 8.496 }, 400);
    const up = est.upInDeviceFrame();
    expect(up.x).toBeCloseTo(0, 2);
    expect(up.y).toBeCloseTo(-0.5, 2);
    expect(up.z).toBeCloseTo(0.866, 2);
  });

  test('gyro integration tracks a 90° pitch rotation', () => {
    const est = new AttitudeEstimator();
    feedStatic(est, { x: 0, y: 0, z: G }, 1);
    // Pitch forward 90° over 1 s: ω = -90°/s about device x (10 steps).
    const w = -Math.PI / 2;
    for (let i = 0; i < 10; i++) {
      // True up rotates with the device; feed the matching tilted accel so
      // the (small) tilt correction assists rather than fights integration.
      const theta = ((i + 1) / 10) * (Math.PI / 2);
      est.update(
        { x: w, y: 0, z: 0 },
        { x: 0, y: -G * Math.sin(theta), z: G * Math.cos(theta) },
        0.1,
      );
    }
    const up = est.upInDeviceFrame();
    // Pitched 90° forward: up in device frame ≈ (0,-1,0).
    expect(up.x).toBeCloseTo(0, 1);
    expect(up.y).toBeCloseTo(-1, 1);
    expect(up.z).toBeCloseTo(0, 1);
  });

  test('forwardAccel: flat device accelerating north, bearing north', () => {
    const est = new AttitudeEstimator();
    feedStatic(est, { x: 0, y: 0, z: G }, 5);
    // Bearing 0 = north; device top points north; +2 m/s² along device y.
    const fwd = est.forwardAccel({ x: 0, y: 2, z: G }, 0);
    expect(fwd).toBeCloseTo(2.0, 6);
  });

  test('forwardAccel: braking gives negative forward acceleration', () => {
    const est = new AttitudeEstimator();
    feedStatic(est, { x: 0, y: 0, z: G }, 5);
    const fwd = est.forwardAccel({ x: 0, y: -3, z: G }, 0);
    expect(fwd).toBeCloseTo(-3.0, 6);
  });

  test('forwardAccel: pure vertical acceleration is not forward motion', () => {
    const est = new AttitudeEstimator();
    feedStatic(est, { x: 0, y: 0, z: G }, 5);
    // Bump: +2 m/s² along device z (up). Horizontal projection ≈ 0.
    const fwd = est.forwardAccel({ x: 0, y: 0, z: G + 2 }, 0);
    expect(fwd).toBeCloseTo(0.0, 6);
  });

  test('forwardAccel: pitched 30° device still recovers north acceleration', () => {
    const est = new AttitudeEstimator();
    feedStatic(est, { x: 0, y: 0, z: G }, 1);
    feedStatic(est, { x: 0, y: -4.905, z: 8.496 }, 400);
    // Accelerating north at 2 m/s² while pitched: hand-computed device-frame
    // measurement (0, -3.173, 9.496). Projection onto bearing 0 must give 2.
    const fwd = est.forwardAccel({ x: 0, y: -3.173, z: 9.496 }, 0);
    expect(fwd).toBeCloseTo(2.0, 1);
  });

  test('forwardAccel: east bearing uses the east component', () => {
    const est = new AttitudeEstimator();
    feedStatic(est, { x: 0, y: 0, z: G }, 5);
    // Accelerating east at 3 m/s²: device x points east when flat & top=north.
    const fwd = est.forwardAccel({ x: 3, y: 0, z: G }, Math.PI / 2);
    expect(fwd).toBeCloseTo(3.0, 6);
  });

  test('forwardAccel: null bearing returns null (unknown, not zero)', () => {
    const est = new AttitudeEstimator();
    feedStatic(est, { x: 0, y: 0, z: G }, 5);
    expect(est.forwardAccel({ x: 0, y: 2, z: G }, null)).toBeNull();
  });

  test('forwardAccel: clamped to ±5 m/s²', () => {
    const est = new AttitudeEstimator();
    feedStatic(est, { x: 0, y: 0, z: G }, 5);
    expect(est.forwardAccel({ x: 0, y: 20, z: G }, 0)).toBeCloseTo(5.0, 6);
    expect(est.forwardAccel({ x: 0, y: -20, z: G }, 0)).toBeCloseTo(-5.0, 6);
  });

  test('worldYawRateDegPerSec: CCW-from-above (left turn) decreases compass heading', () => {
    const est = new AttitudeEstimator();
    feedStatic(est, { x: 0, y: 0, z: G }, 5);
    // +0.5 rad/s about device z (out of screen) with the phone flat =
    // counter-clockwise seen from above = turning left.
    const rate = est.worldYawRateDegPerSec({ x: 0, y: 0, z: 0.5 });
    expect(rate).toBeCloseTo(-0.5 * DEG, 6);
  });

  test('worldYawRateDegPerSec: works when the device is pitched (not flat)', () => {
    const est = new AttitudeEstimator();
    feedStatic(est, { x: 0, y: 0, z: G }, 1);
    feedStatic(est, { x: 0, y: -4.905, z: 8.496 }, 400);
    // World-frame yaw rate must be independent of device pitch: feed a gyro
    // vector that is purely about the world up axis. In the forward-pitched
    // device frame (30° about x), world-up (0,0,1) appears as
    // (0,-sin30,cos30) = (0,-0.5,0.866).
    const rate = est.worldYawRateDegPerSec({ x: 0, y: -0.5 * 0.5, z: 0.866 * 0.5 });
    expect(rate).toBeCloseTo(-0.5 * DEG, 0);
  });

  test('ignores non-positive dt', () => {
    const est = new AttitudeEstimator();
    feedStatic(est, { x: 0, y: 0, z: G }, 5);
    expect(() => est.update({ x: 1, y: 1, z: 1 }, { x: 0, y: 0, z: G }, 0)).not.toThrow();
    expect(() => est.update({ x: 1, y: 1, z: 1 }, { x: 0, y: 0, z: G }, -1)).not.toThrow();
    const up = est.upInDeviceFrame();
    expect(up.z).toBeCloseTo(1, 6);
  });
});
