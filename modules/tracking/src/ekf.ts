/**
 * Extended Kalman Filter for GPS + IMU fusion.
 * State: [lat_deg, lng_deg, speed_mps, heading_deg] (4-state).
 *
 * Units:
 * - lat, lng, heading: degrees
 * - speed: m/s
 * - time: seconds
 *
 * Motion model:
 *   lat' = lat + (speed * dt * cos(heading*π/180)) / 111320
 *   lng' = lng + (speed * dt * sin(heading*π/180)) / (111320 * cos(lat*π/180))
 *   speed' = speed + accel * dt
 *   heading' = heading + headingRate * dt
 *
 * Phase 1 implementation (corrected):
 * - Jacobian F with correct degree/radian conversion factors
 * - Full covariance propagation: P = F P F^T + Q
 * - Measurement model: S = H P H^T + R (full 2x2, not diagonal)
 * - Joseph-form covariance update: P = (I-KH)P(I-KH)^T + KRK^T
 * - NIS follows chi-squared(2) distribution
 */

import { SpoofDetector } from './spoofDetector';

const NIS_DOF = 2;
const NIS_THRESHOLD_CHISQ_95 = 5.99;
const METERS_PER_DEGREE_LAT = 111320.0;
const DEG_TO_RAD = Math.PI / 180.0;
const RAD_TO_DEG = 180.0 / Math.PI;

export interface EkfParams {
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  nisThreshold?: number;
  spoofTriggerTicks?: number;
  spoofRecoveryTicks?: number;
  q?: number[];
  r?: number[];
}

export interface EkfState {
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  p: number[];
  spoofFlag: boolean;
  nisScore: number;
}

// Matrix helpers
function mat4x4Multiply(a: number[], b: number[]): number[] {
  const result = new Array(16).fill(0);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      for (let k = 0; k < 4; k++) {
        result[i * 4 + j] += a[i * 4 + k] * b[k * 4 + j];
      }
    }
  }
  return result;
}

function mat4x4Transpose(m: number[]): number[] {
  const result = new Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      result[j * 4 + i] = m[i * 4 + j];
    }
  }
  return result;
}

function mat4x4Add(a: number[], b: number[]): number[] {
  return a.map((v, i) => v + b[i]);
}

function mat4x2Multiply(a: number[], b: number[]): number[] {
  // a: 4x4, b: 4x2 -> result: 4x2
  const result = new Array(8).fill(0);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 2; j++) {
      for (let k = 0; k < 4; k++) {
        result[i * 2 + j] += a[i * 4 + k] * b[k * 2 + j];
      }
    }
  }
  return result;
}

function mat2x4Multiply(a: number[], b: number[]): number[] {
  // a: 2x4, b: 4x4 -> result: 2x4
  const result = new Array(8).fill(0);
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 4; j++) {
      for (let k = 0; k < 4; k++) {
        result[i * 4 + j] += a[i * 4 + k] * b[k * 4 + j];
      }
    }
  }
  return result;
}

function mat2x2Multiply(a: number[], b: number[]): number[] {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
  ];
}

function mat2x4Transpose(m: number[]): number[] {
  // 2x4 -> 4x2
  // m = [m00, m01, m02, m03,  (row 0)
  //      m10, m11, m12, m13]  (row 1)
  // result = [m00, m10,  (row 0)
  //           m01, m11,  (row 1)
  //           m02, m12,  (row 2)
  //           m03, m13]  (row 3)
  return [m[0], m[4], m[1], m[5], m[2], m[6], m[3], m[7]];
}

function mat4x2Transpose(m: number[]): number[] {
  // 4x2 -> 2x4
  return [m[0], m[2], m[4], m[6], m[1], m[3], m[5], m[7]];
}

function mat2x2Transpose(m: number[]): number[] {
  return [m[0], m[2], m[1], m[3]];
}

function mat2x2Determinant(m: number[]): number {
  return m[0] * m[3] - m[1] * m[2];
}

/**
 * Attempt to invert a 2x2 matrix.
 * Returns null if the matrix is degenerate and cannot be safely inverted.
 *
 * Singularity policy:
 * 1. If scale (max diagonal) is zero, the matrix is genuinely degenerate.
 *    Regularization is NOT applied: there is no physical noise floor to lift,
 *    and inventing one would produce a meaningless inverse. Reject immediately.
 * 2. If scale > 0 but |det| < relEps * scale², the matrix is near-singular.
 *    Retry with controlled regularization S + λI where λ = √relEps * scale.
 *    This lifts the eigenvalues by a fraction of the existing noise floor.
 * 3. If still singular after retry, return null — caller must skip the update.
 *
 * Never returns an unrelated diagonal matrix as a fake inverse.
 * The relEps = 1e-12 relative threshold handles GPS-scale values (degrees²
 * ~ 1e-7) whose determinants (~1e-14) would be falsely rejected by any
 * absolute epsilon ≥ 1e-14.
 */
function mat2x2Invert(m: number[]): number[] | null {
  // Step 1: check for genuinely zero/degenerate matrix BEFORE regularization.
  // Do NOT apply the 1e-100 floor here: a truly zero matrix must be rejected,
  // not laundered into λI via a fake scale.
  const scale = Math.max(Math.abs(m[0]), Math.abs(m[3]));
  if (scale === 0) {
    // Both diagonal entries are zero → S is numerically zero; reject.
    return null;
  }

  const relEps = 1e-12;
  const threshold = relEps * scale * scale;
  const det = mat2x2Determinant(m);

  // Step 2: direct inversion if well-conditioned.
  if (Math.abs(det) >= threshold) {
    const invDet = 1 / det;
    return [m[3] * invDet, -m[1] * invDet, -m[2] * invDet, m[0] * invDet];
  }

  // Step 3: near-singular — retry with controlled regularization S + λI.
  // λ is proportional to scale so it represents a genuine (tiny) noise floor.
  const lambda = Math.sqrt(relEps) * scale; // ~1e-6 × scale
  const regularized = [m[0] + lambda, m[1], m[2], m[3] + lambda];
  const newDet = mat2x2Determinant(regularized);
  const newScale = Math.max(Math.abs(regularized[0]), Math.abs(regularized[3]));
  const newThreshold = relEps * newScale * newScale;
  if (Math.abs(newDet) >= newThreshold) {
    const invDet = 1 / newDet;
    return [
      regularized[3] * invDet,
      -regularized[1] * invDet,
      -regularized[2] * invDet,
      regularized[0] * invDet,
    ];
  }

  // Still singular after regularization — safe rejection.
  return null;
}


export class Ekf {
  lat: number;
  lng: number;
  speed: number;
  heading: number;

  P: number[] = new Array(16).fill(0);
  private _Q: number[];
  private _R: number[];
  nisScore = 0;

  /**
   * True when the most recent call to update() was rejected because the
   * innovation covariance S was degenerate and could not be safely inverted.
   * Distinct from NIS = 0 (which is a valid result when the innovation is zero).
   * Reset to false on any successful (accepted) update.
   */
  lastUpdateRejected = false;

  private _spoofDetector: SpoofDetector;

  readonly nisThreshold: number;
  readonly spoofTriggerTicks: number;
  readonly spoofRecoveryTicks: number;

  constructor(params: EkfParams) {
    this.lat = params.lat;
    this.lng = params.lng;
    this.speed = params.speed ?? 0;
    this.heading = params.heading ?? 0;
    this.nisThreshold = params.nisThreshold ?? NIS_THRESHOLD_CHISQ_95;
    this.spoofTriggerTicks = params.spoofTriggerTicks ?? 3;
    this.spoofRecoveryTicks = params.spoofRecoveryTicks ?? 5;

    // Initialize P with reasonable uncertainty
    // GPS cold start: ~50m = ~0.00045 deg
    // Speed unknown: ~5 m/s
    // Heading unknown: ~180 deg
    const gpsUncertainty = 50 / METERS_PER_DEGREE_LAT; // 50m in degrees
    this.P[0] = gpsUncertainty * gpsUncertainty; // lat variance
    this.P[5] = gpsUncertainty * gpsUncertainty; // lng variance
    this.P[10] = 25; // speed variance: (5 m/s)²
    this.P[15] = 32400; // heading variance: (180 deg)²

    // Q: Process noise covariance (4x4 diagonal)
    // Derived from IMU noise assumptions:
    // - Position drift: ~0.1m over 1s prediction = 0.1/111320 deg/s
    // - Speed drift from accel noise: ~0.1 m/s² over 1s = 0.1 m/s per step
    // - Heading drift: ~1 deg/s gyro noise
    if (params.q && params.q.length === 16) {
      this._Q = params.q;
    } else {
      this._Q = new Array(16).fill(0);
      const posDriftDeg = 0.1 / METERS_PER_DEGREE_LAT;
      this._Q[0] = posDriftDeg * posDriftDeg; // lat process noise
      this._Q[5] = posDriftDeg * posDriftDeg; // lng process noise
      this._Q[10] = 0.01; // speed process noise: (0.1 m/s)²
      this._Q[15] = 1; // heading process noise: (1 deg)²
    }

    // R: Measurement noise covariance (2x2)
    // Assuming 10m GPS 1-sigma accuracy
    if (params.r && params.r.length === 4) {
      this._R = params.r;
    } else {
      const gpsStdDeg = 10 / METERS_PER_DEGREE_LAT; // 10m in degrees
      this._R = [gpsStdDeg * gpsStdDeg, 0, 0, gpsStdDeg * gpsStdDeg];
    }

    this._spoofDetector = new SpoofDetector({
      threshold: this.nisThreshold,
      triggerTicks: this.spoofTriggerTicks,
      recoveryTicks: this.spoofRecoveryTicks,
    });
  }

  get spoofFlag(): boolean {
    return this._spoofDetector.isFlagged;
  }

  /**
   * Serialize current EKF state.
   */
  toState(): EkfState {
    return {
      lat: this.lat,
      lng: this.lng,
      speed: this.speed,
      heading: this.heading,
      p: [...this.P],
      spoofFlag: this.spoofFlag,
      nisScore: this.nisScore,
    };
  }

  /**
   * Reconstruct an Ekf instance from serialized state.
   */
  static fromState(state: EkfState, params?: Partial<EkfParams>): Ekf {
    const ekf = new Ekf({
      lat: state.lat,
      lng: state.lng,
      speed: state.speed,
      heading: state.heading,
      ...params,
    });
    ekf.P = [...state.p];
    ekf.nisScore = state.nisScore;
    ekf._spoofDetector = new SpoofDetector({
      threshold: ekf.nisThreshold,
      triggerTicks: ekf.spoofTriggerTicks,
      recoveryTicks: ekf.spoofRecoveryTicks,
      flagged: state.spoofFlag,
    });
    return ekf;
  }

  /**
   * Predict step.
   * @param dt Time step (seconds)
   * @param accelForward Forward acceleration (m/s²) - NOTE: simplified model, see limitation in README
   * @param headingRate Heading rate (deg/s)
   */
  predict(dt: number, accelForward: number, headingRate: number): void {
    // Compute Jacobian F at current state
    const F = this._computeJacobianF(dt);

    // Covariance propagation: P = F P F^T + Q
    const FT = mat4x4Transpose(F);
    const FP = mat4x4Multiply(F, this.P);
    const FPFt = mat4x4Multiply(FP, FT);
    this.P = mat4x4Add(FPFt, this._Q);

    // Update state
    const headingRad = this.heading * DEG_TO_RAD;
    const latRad = this.lat * DEG_TO_RAD;
    const cosHeading = Math.cos(headingRad);
    const sinHeading = Math.sin(headingRad);
    const cosLat = Math.cos(latRad);

    this.lat += (this.speed * dt * cosHeading) / METERS_PER_DEGREE_LAT;
    this.lng += (this.speed * dt * sinHeading) / (METERS_PER_DEGREE_LAT * cosLat);
    this.speed += accelForward * dt;
    this.heading += headingRate * dt;

    this._ensurePValid();
  }

  /**
   * Compute Jacobian F with correct degree/radian conversions.
   *
   * Derivatives include π/180 factors where state variables are in degrees:
   * - ∂lat'/∂heading includes π/180
   * - ∂lng'/∂lat includes π/180
   * - ∂lng'/∂heading includes π/180
   *
   * Exposed as a non-private (but underscore-prefixed) method so that
   * tests can call the ACTUAL production Jacobian for validation without
   * duplicating the analytical formula.
   *
   * @internal Do not call from application code outside this module.
   */
  _computeJacobianF(dt: number): number[] {
    const F = new Array(16).fill(0);

    const headingRad = this.heading * DEG_TO_RAD;
    const latRad = this.lat * DEG_TO_RAD;
    const cosHeading = Math.cos(headingRad);
    const sinHeading = Math.sin(headingRad);
    const cosLat = Math.cos(latRad);
    const sinLat = Math.sin(latRad);
    const cos2Lat = cosLat * cosLat;

    const K = METERS_PER_DEGREE_LAT;

    // Row 0: ∂lat'/∂*
    F[0] = 1; // ∂lat'/∂lat
    F[1] = 0; // ∂lat'/∂lng
    F[2] = (dt * cosHeading) / K; // ∂lat'/∂speed
    F[3] = -(dt * this.speed * sinHeading * DEG_TO_RAD) / K; // ∂lat'/∂heading (includes π/180)

    // Row 1: ∂lng'/∂*
    F[4] = (dt * this.speed * sinHeading * sinLat * DEG_TO_RAD) / (K * cos2Lat); // ∂lng'/∂lat (includes π/180)
    F[5] = 1; // ∂lng'/∂lng
    F[6] = (dt * sinHeading) / (K * cosLat); // ∂lng'/∂speed
    F[7] = (dt * this.speed * cosHeading * DEG_TO_RAD) / (K * cosLat); // ∂lng'/∂heading (includes π/180)

    // Row 2: ∂speed'/∂*
    F[10] = 1; // ∂speed'/∂speed

    // Row 3: ∂heading'/∂*
    F[15] = 1; // ∂heading'/∂heading

    return F;
  }

  update(gpsLat: number, gpsLng: number): number {
    const innovLat = gpsLat - this.lat;
    const innovLng = gpsLng - this.lng;

    // H: Measurement Jacobian (2x4)
    const H = [1, 0, 0, 0, 0, 1, 0, 0];

    // S = H P H^T + R (2x2, full matrix)
    const HP = mat2x4Multiply(H, this.P);
    const HT = mat2x4Transpose(H);
    const HPHt = new Array(4).fill(0);
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        for (let k = 0; k < 4; k++) {
          HPHt[i * 2 + j] += HP[i * 4 + k] * HT[k * 2 + j];
        }
      }
    }
    const S = [
      HPHt[0] + this._R[0],
      HPHt[1] + this._R[1],
      HPHt[2] + this._R[2],
      HPHt[3] + this._R[3],
    ];

    // Attempt to invert S. If S is degenerate (zero scale or irreversibly
    // near-singular after regularization), reject the update entirely.
    // Do NOT write nisScore = 0: NIS = 0 is a valid result for a zero-innovation
    // update and must not be conflated with a rejected update.
    const Sinv = mat2x2Invert(S);
    if (Sinv === null) {
      // Mark rejection explicitly so callers can distinguish this from NIS = 0.
      // State, covariance, and nisScore are all left unchanged.
      this.lastUpdateRejected = true;
      return this.nisScore;
    }

    // S was successfully inverted — this is an accepted update.
    this.lastUpdateRejected = false;

    // NIS = innovation^T S^-1 innovation
    this.nisScore =
      innovLat * (Sinv[0] * innovLat + Sinv[1] * innovLng) +
      innovLng * (Sinv[2] * innovLat + Sinv[3] * innovLng);

    if (!Number.isFinite(this.nisScore) || this.nisScore < 0) {
      this.nisScore = Math.max(0, this.nisScore || 0);
    }

    this._spoofDetector.update(this.nisScore);

    if (this.spoofFlag) {
      return this.nisScore;
    }

    // Kalman gain K = P H^T S^-1 (4x2)
    const PHt = mat4x2Multiply(this.P, HT);
    const K = new Array(8).fill(0);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 2; j++) {
        for (let k = 0; k < 2; k++) {
          K[i * 2 + j] += PHt[i * 2 + k] * Sinv[k * 2 + j];
        }
      }
    }

    // State update
    this.lat += K[0] * innovLat + K[1] * innovLng;
    this.lng += K[2] * innovLat + K[3] * innovLng;
    this.speed += K[4] * innovLat + K[5] * innovLng;
    this.heading += K[6] * innovLat + K[7] * innovLng;

    // Joseph form covariance update: P = (I-KH)P(I-KH)^T + KRK^T
    const KH = new Array(16).fill(0);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        for (let k = 0; k < 2; k++) {
          KH[i * 4 + j] += K[i * 2 + k] * H[k * 4 + j];
        }
      }
    }

    const I_KH = new Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        I_KH[i * 4 + j] = (i === j ? 1 : 0) - KH[i * 4 + j];
      }
    }

    const I_KH_T = mat4x4Transpose(I_KH);
    const term1 = mat4x4Multiply(mat4x4Multiply(I_KH, this.P), I_KH_T);

    // K R K^T
    const KR = new Array(8).fill(0);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 2; j++) {
        for (let k = 0; k < 2; k++) {
          KR[i * 2 + j] += K[i * 2 + k] * this._R[k * 2 + j];
        }
      }
    }

    const KT = mat4x2Transpose(K);
    const term2 = new Array(16).fill(0);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        for (let k = 0; k < 2; k++) {
          term2[i * 4 + j] += KR[i * 2 + k] * KT[k * 4 + j];
        }
      }
    }

    this.P = mat4x4Add(term1, term2);
    this._ensurePValid();

    return this.nisScore;
  }

  private _ensurePValid(): void {
    // Symmetrize
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const avg = (this.P[i * 4 + j] + this.P[j * 4 + i]) / 2;
        this.P[i * 4 + j] = avg;
        this.P[j * 4 + i] = avg;
      }
    }

    // Detect non-finite entries — do NOT silently replace with identity.
    // Numerical corruption must be surfaced explicitly so callers can decide
    // whether to reinitialize or halt. Replacing with an arbitrary identity
    // would hide real bugs and produce misleading filter outputs.
    for (let i = 0; i < 16; i++) {
      if (!Number.isFinite(this.P[i])) {
        throw new Error(
          `EKF covariance P[${i}] became non-finite (${this.P[i]}). ` +
          'This indicates numerical instability. Reinitialize the filter.'
        );
      }
    }
  }

  get accuracyM(): number {
    return Math.sqrt(Math.max(this.P[0], 0)) * METERS_PER_DEGREE_LAT;
  }

  get Q(): number[] {
    return this._Q;
  }

  get R(): number[] {
    return this._R;
  }

  static readonly METERS_PER_DEGREE_LAT = METERS_PER_DEGREE_LAT;
  static readonly DEG_TO_RAD = DEG_TO_RAD;
}

export { NIS_DOF, NIS_THRESHOLD_CHISQ_95, METERS_PER_DEGREE_LAT };
