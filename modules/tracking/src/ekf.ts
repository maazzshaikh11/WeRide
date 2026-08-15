/**
 * Extended Kalman Filter for GPS + IMU fusion.
 * State: [lat, lng, speed_mps, heading_deg] (4-state).
 *
 * Prediction: IMU (accel + gyro) drives state forward.
 * Update: GPS fix → innovation → NIS → spoof detection.
 *
 * Pure logic — no RN, no sensors. Testable standalone.
 * Ported from ekf.dart.
 */

export interface EkfParams {
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  nisThreshold?: number;
  spoofTriggerTicks?: number;
  spoofRecoveryTicks?: number;
}

export class Ekf {
  lat: number;
  lng: number;
  speed: number;
  heading: number;

  // Covariance (4x4, stored as flat array row-major for simplicity)
  P: number[] = new Array(16).fill(1);
  // Noise matrices (tune — see README)
  Q: number[] = new Array(16).fill(0.1);
  R: number[] = [10, 0, 0, 10];

  nisScore = 0;
  spoofFlag = false;

  private _spoofTriggerCount = 0;
  private _spoofRecoveryCount = 0;

  readonly nisThreshold: number;
  readonly spoofTriggerTicks: number;
  readonly spoofRecoveryTicks: number;

  constructor(params: EkfParams) {
    this.lat = params.lat;
    this.lng = params.lng;
    this.speed = params.speed ?? 0;
    this.heading = params.heading ?? 0;
    this.nisThreshold = params.nisThreshold ?? 5.99;
    this.spoofTriggerTicks = params.spoofTriggerTicks ?? 3;
    this.spoofRecoveryTicks = params.spoofRecoveryTicks ?? 5;
  }

  /** Predict step: propagate state forward using speed + heading (IMU-driven). dt in seconds. */
  predict(dt: number, speedInput: number, headingRate: number): void {
    this.heading += headingRate * dt;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = (speedInput * dt * Math.cos(toRad(this.heading))) / 111320.0;
    const dLng = (speedInput * dt * Math.sin(toRad(this.heading))) / (111320.0 * Math.cos(toRad(this.lat)));
    this.lat += dLat;
    this.lng += dLng;
    this.speed = speedInput;
    // P = F P F^T + Q  (F is Jacobian of motion model — approx identity here)
    // TODO: proper Jacobian + covariance propagation
  }

  /** Update step: fuse GPS measurement. Returns the NIS score. */
  update(gpsLat: number, gpsLng: number): number {
    const innovLat = gpsLat - this.lat;
    const innovLng = gpsLng - this.lng;
    // NIS = innovation^T * S^-1 * innovation (S = H P H^T + R)
    // Simplified: S ≈ R (TODO: full S from P)
    const s00 = this.P[0] + this.R[0];
    const s11 = this.P[5] + this.R[3];
    this.nisScore = (innovLat * innovLat) / s00 + (innovLng * innovLng) / s11;

    if (this.spoofFlag) {
      // While flagged, reject GPS (IMU dead-reckoning only). Track NIS for recovery.
      if (this.nisScore < this.nisThreshold) {
        this._spoofRecoveryCount++;
        if (this._spoofRecoveryCount >= this.spoofRecoveryTicks) {
          this.spoofFlag = false;
          this._spoofRecoveryCount = 0;
          this._spoofTriggerCount = 0;
        }
      } else {
        this._spoofRecoveryCount = 0;
      }
      return this.nisScore;
    }

    // Not flagged: check for spoof
    if (this.nisScore > this.nisThreshold) {
      this._spoofTriggerCount++;
      if (this._spoofTriggerCount >= this.spoofTriggerTicks) {
        this.spoofFlag = true;
        this._spoofRecoveryCount = 0;
        return this.nisScore; // do NOT update state with likely-spoofed GPS
      }
    } else {
      this._spoofTriggerCount = 0;
    }

    // Kalman gain K = P H^T (H P H^T + R)^-1 — simplified scalar
    const k0 = this.P[0] / s00;
    const k1 = this.P[5] / s11;
    this.lat += k0 * innovLat;
    this.lng += k1 * innovLng;
    // P = (I - K H) P — simplified diagonal update
    this.P[0] *= 1 - k0;
    this.P[5] *= 1 - k1;
    return this.nisScore;
  }

  get accuracyM(): number {
    return Math.sqrt(this.P[0]) * 111320.0; // rough lat variance → meters
  }
}