/**
 * Attitude-aware IMU processing for Person A dead-reckoning.
 *
 * Problem: the accelerometer reports proper acceleration in the DEVICE frame.
 * Feeding |a| - g as "forward acceleration" (the old placeholder) is not
 * physically meaningful — it mixes braking, bumps and cornering into one
 * scalar and its sign is meaningless.
 *
 * Solution: a lightweight quaternion complementary filter.
 *   - Gyro (rad/s, device frame) integrates the device→world quaternion.
 *   - The accelerometer corrects tilt whenever the device is quasi-static
 *     (|‖a‖ − g| small): it observes the gravity direction, which makes
 *     pitch/roll observable. Yaw remains unobservable from IMU alone —
 *     that is why forward acceleration is projected onto the GPS
 *     course-over-ground bearing, not onto a magnetometer heading.
 *
 * Conventions:
 *   - World frame: ENU (x=east, y=north, z=up), z-up.
 *   - Quaternion q maps device → world: v_world = q ⊗ v_device ⊗ q*.
 *   - Device axes follow Android/react-native-sensors: x=right, y=top, z=out
 *     of screen.
 *   - Compass heading increases clockwise from north; therefore a positive
 *     (CCW-from-above) world yaw rate DECREASES the compass heading and the
 *     reported heading rate is negated.
 *
 * Outputs:
 *   - worldYawRateDegPerSec(): gyro yaw rate expressed in the world frame,
 *     sign-corrected for compass headings. Valid in any device orientation.
 *   - forwardAccel(ax, ay, az, bearingRad): linear (gravity-free) acceleration
 *     projected onto the GPS bearing direction. Returns null when no bearing
 *     is available — the caller must then run GPS-only (constant-velocity)
 *     prediction rather than inventing acceleration.
 *
 * No React Native dependencies — pure math, unit-testable on Node.
 */

const G = 9.81;
/** Tilt-correction gain per update (complementary filter). */
const TILT_GAIN = 0.03;
/** |‖a‖ − g| below this (m/s²) counts as quasi-static. */
const STATIC_TOLERANCE = 1.2;
/** Clamp on reported forward acceleration (m/s²) — beyond this is noise. */
const MAX_FORWARD_ACCEL = 5;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface Quat {
  w: number;
  x: number;
  y: number;
  z: number;
}

function quatNormalize(q: Quat): Quat {
  const n = Math.hypot(q.w, q.x, q.y, q.z) || 1;
  return { w: q.w / n, x: q.x / n, y: q.y / n, z: q.z / n };
}

function quatMultiply(a: Quat, b: Quat): Quat {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

function quatConjugate(q: Quat): Quat {
  return { w: q.w, x: -q.x, y: -q.y, z: -q.z };
}

function quatFromAxisAngle(ax: number, ay: number, az: number, angle: number): Quat {
  const half = angle / 2;
  const s = Math.sin(half);
  const n = Math.hypot(ax, ay, az) || 1;
  return { w: Math.cos(half), x: (ax / n) * s, y: (ay / n) * s, z: (az / n) * s };
}

/** Rotate vector v by quaternion q: q ⊗ v ⊗ q*. */
function quatRotate(q: Quat, v: Vec3): Vec3 {
  const qv: Quat = { w: 0, x: v.x, y: v.y, z: v.z };
  const r = quatMultiply(quatMultiply(q, qv), quatConjugate(q));
  return { x: r.x, y: r.y, z: r.z };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export class AttitudeEstimator {
  private _q: Quat = { w: 1, x: 0, y: 0, z: 0 };
  private _initialised = false;

  /** True after the first accelerometer sample seeds the tilt. */
  get initialised(): boolean {
    return this._initialised;
  }

  /**
   * Feed one IMU sample. Gyro in rad/s (device frame), accel in m/s²
   * (device frame), dt in seconds.
   */
  update(gyro: Vec3, accel: Vec3, dt: number): void {
    if (!(dt > 0) || !Number.isFinite(dt)) return;

    const aMag = Math.hypot(accel.x, accel.y, accel.z);
    const quasiStatic = aMag > 1e-6 && Math.abs(aMag - G) < STATIC_TOLERANCE;

    if (!this._initialised) {
      // Seed tilt only from a quasi-static sample: seeding from a sample
      // taken mid-acceleration would bake the acceleration in as tilt.
      if (quasiStatic) {
        this._seedFromAccel(accel);
      } else {
        return;
      }
    }

    // 1. Integrate gyro: q ← q ⊗ dq(ω·dt)  (device-frame rotation composes right)
    const rate = Math.hypot(gyro.x, gyro.y, gyro.z);
    if (rate > 1e-9) {
      const dq = quatFromAxisAngle(gyro.x, gyro.y, gyro.z, rate * dt);
      this._q = quatNormalize(quatMultiply(this._q, dq));
    }

    // 2. Tilt correction when quasi-static.
    if (quasiStatic) {
      const uMeas: Vec3 = { x: accel.x / aMag, y: accel.y / aMag, z: accel.z / aMag };
      const uEst = quatRotate(quatConjugate(this._q), { x: 0, y: 0, z: 1 });
      // Correction rotation taking uEst → uMeas: axis = uMeas × uEst.
      const axis = cross(uMeas, uEst);
      const axisMag = Math.hypot(axis.x, axis.y, axis.z);
      if (axisMag > 1e-9) {
        const cosAng = Math.max(-1, Math.min(1, dot(uMeas, uEst)));
        const angle = Math.acos(cosAng);
        const dqC = quatFromAxisAngle(
          axis.x / axisMag, axis.y / axisMag, axis.z / axisMag,
          TILT_GAIN * angle,
        );
        this._q = quatNormalize(quatMultiply(this._q, dqC));
      }
    }
  }

  /**
   * Estimated "up" direction expressed in the device frame (unit vector).
   * Exposed for tests.
   */
  upInDeviceFrame(): Vec3 {
    return quatRotate(quatConjugate(this._q), { x: 0, y: 0, z: 1 });
  }

  /**
   * World-frame yaw rate in compass-heading degrees per second
   * (clockwise-positive, matching EKF heading_deg).
   */
  worldYawRateDegPerSec(gyro: Vec3): number {
    const wWorld = quatRotate(this._q, gyro);
    // Positive rotation about world +z (up) is CCW seen from above, which
    // DECREASES a clockwise-from-north compass heading.
    return (-wWorld.z * 180) / Math.PI;
  }

  /**
   * Forward acceleration along the GPS bearing.
   * @param bearingRad GPS course-over-ground, radians clockwise from north.
   * @returns m/s² along the bearing, or null when bearingRad is null —
   *   meaning "unknown", NOT zero. The caller must treat null as
   *   GPS-only (constant-velocity) prediction.
   */
  forwardAccel(accel: Vec3, bearingRad: number | null): number | null {
    if (bearingRad == null || !Number.isFinite(bearingRad)) return null;
    if (!this._initialised) return null;

    const upDev = this.upInDeviceFrame();
    // Linear acceleration = measured − gravity, in device frame.
    const lin: Vec3 = {
      x: accel.x - G * upDev.x,
      y: accel.y - G * upDev.y,
      z: accel.z - G * upDev.z,
    };
    const linWorld = quatRotate(this._q, lin);
    // Forward unit vector in ENU from compass bearing.
    const fx = Math.sin(bearingRad);
    const fy = Math.cos(bearingRad);
    const fwd = linWorld.x * fx + linWorld.y * fy;
    return Math.max(-MAX_FORWARD_ACCEL, Math.min(MAX_FORWARD_ACCEL, fwd));
  }

  /** Seed tilt from the first accelerometer sample (yaw stays 0). */
  private _seedFromAccel(accel: Vec3): void {
    const aMag = Math.hypot(accel.x, accel.y, accel.z);
    if (aMag < 1e-6) return; // degenerate — stay identity until real data
    const u: Vec3 = { x: accel.x / aMag, y: accel.y / aMag, z: accel.z / aMag };
    // Shortest rotation taking (0,0,1) → u.
    const axis = cross({ x: 0, y: 0, z: 1 }, u);
    const axisMag = Math.hypot(axis.x, axis.y, axis.z);
    if (axisMag < 1e-9) {
      // Already aligned (or exactly opposite — pick x-axis as fallback).
      const c = dot({ x: 0, y: 0, z: 1 }, u);
      this._q = c > 0 ? { w: 1, x: 0, y: 0, z: 0 } : quatFromAxisAngle(1, 0, 0, Math.PI);
    } else {
      const angle = Math.acos(Math.max(-1, Math.min(1, dot({ x: 0, y: 0, z: 1 }, u))));
      this._q = quatNormalize(
        quatFromAxisAngle(axis.x / axisMag, axis.y / axisMag, axis.z / axisMag, angle),
      );
    }
    this._initialised = true;
  }
}
