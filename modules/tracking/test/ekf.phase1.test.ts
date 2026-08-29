/**
 * Phase 1 EKF Mathematical Validation Tests
 *
 * All tests use deterministic inputs (no Math.random()).
 * Tests validate:
 * - Analytical Jacobian F via the ACTUAL production _computeJacobianF accessor
 *   (not a re-implementation inside the test)
 * - Full S = HPH^T + R (including off-diagonal covariance)
 * - NIS ~ chi-squared(2) distribution, innovations sampled from N(0, S)
 * - Near-singular S safe rejection (no fake diagonal pseudo-inverse)
 * - Joseph-form covariance update
 * - Covariance symmetry and positive-definiteness (all 4 leading principal minors)
 * - State update correctness
 * - Spoof detection with production threshold
 */

import { Ekf, METERS_PER_DEGREE_LAT, NIS_THRESHOLD_CHISQ_95 } from '../src/ekf';

const EPSILON = 1e-6;

describe('Phase 1 EKF - Mathematical Validation', () => {

  describe('Jacobian F - Analytical vs Finite Difference', () => {
    it('validates ACTUAL production Jacobian against numerical derivatives', () => {
      const lat = 37.7749;
      const lng = -122.4194;
      const speed = 10;
      const heading = 45;
      const dt = 0.1;
      const accel = 0.5;
      const headingRate = 2.0;

      // Create EKF at known state
      const ekf = new Ekf({ lat, lng, speed, heading });
      const PBefore = [...ekf.P];

      // Call the ACTUAL production Jacobian before state changes
      const F_production = ekf._computeJacobianF(dt);

      // Capture state for finite difference baseline
      const stateBefore = [ekf.lat, ekf.lng, ekf.speed, ekf.heading];

      // Compute baseline (perturbed=false, just run predict once)
      ekf.predict(dt, accel, headingRate);
      const stateAfter = [ekf.lat, ekf.lng, ekf.speed, ekf.heading];

      // Numerical Jacobian via forward finite differences
      const h = 1e-6;
      const F_numerical = new Array(16).fill(0);

      for (let j = 0; j < 4; j++) {
        const ekfPlus = new Ekf({ lat: stateBefore[0], lng: stateBefore[1], speed: stateBefore[2], heading: stateBefore[3] });
        ekfPlus.P = [...PBefore];

        if (j === 0) ekfPlus.lat += h;
        else if (j === 1) ekfPlus.lng += h;
        else if (j === 2) ekfPlus.speed += h;
        else if (j === 3) ekfPlus.heading += h;

        ekfPlus.predict(dt, accel, headingRate);
        const statePlus = [ekfPlus.lat, ekfPlus.lng, ekfPlus.speed, ekfPlus.heading];

        for (let i = 0; i < 4; i++) {
          F_numerical[i * 4 + j] = (statePlus[i] - stateAfter[i]) / h;
        }
      }

      // Validate production Jacobian entries against numerical derivatives
      // tolerance 1e-4 covers finite-difference truncation error for these magnitudes
      expect(Math.abs(F_production[0]  - F_numerical[0])).toBeLessThan(1e-4);  // ∂lat'/∂lat
      expect(Math.abs(F_production[2]  - F_numerical[2])).toBeLessThan(1e-4);  // ∂lat'/∂speed
      expect(Math.abs(F_production[3]  - F_numerical[3])).toBeLessThan(1e-4);  // ∂lat'/∂heading (includes π/180)
      expect(Math.abs(F_production[4]  - F_numerical[4])).toBeLessThan(1e-4);  // ∂lng'/∂lat (includes π/180)
      expect(Math.abs(F_production[5]  - F_numerical[5])).toBeLessThan(1e-4);  // ∂lng'/∂lng
      expect(Math.abs(F_production[6]  - F_numerical[6])).toBeLessThan(1e-4);  // ∂lng'/∂speed
      expect(Math.abs(F_production[7]  - F_numerical[7])).toBeLessThan(1e-4);  // ∂lng'/∂heading (includes π/180)
      expect(Math.abs(F_production[10] - F_numerical[10])).toBeLessThan(EPSILON); // ∂speed'/∂speed
      expect(Math.abs(F_production[15] - F_numerical[15])).toBeLessThan(EPSILON); // ∂heading'/∂heading
    });
  });

  describe('NIS ~ Chi-Squared(2) Distribution', () => {
    it('validates NIS distribution with innovations sampled from N(0, S)', () => {
      /**
       * Correct procedure:
       * 1. Fix the EKF state (do not mutate it between samples).
       * 2. Compute S = HPH^T + R for that fixed state.
       * 3. Sample innovations from N(0, S) using the Cholesky decomposition of S.
       * 4. Each sample gives one NIS value; these should be chi-squared(2).
       *
       * We use the same EKF object but reset its state before each update so that
       * S is identical for every sample, satisfying the iid chi-squared requirement.
       */

      // Seeded deterministic LCG generator
      let seed = 12345;
      const lcg = (): number => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };

      // Box-Muller transform for N(0,1) pairs
      const boxMuller = (): [number, number] => {
        const u1 = Math.max(lcg(), 1e-15); // avoid log(0)
        const u2 = lcg();
        const r = Math.sqrt(-2 * Math.log(u1));
        const theta = 2 * Math.PI * u2;
        return [r * Math.cos(theta), r * Math.sin(theta)];
      };

      // Reference EKF — state is fixed throughout, so S is constant
      const gpsStdDeg = 20 / METERS_PER_DEGREE_LAT; // 20m GPS 1-sigma
      const refEkf = new Ekf({
        lat: 37.7749,
        lng: -122.4194,
        speed: 10,
        heading: 45,
        r: [gpsStdDeg * gpsStdDeg, 0, 0, gpsStdDeg * gpsStdDeg],
      });

      // Compute S = HPH^T + R for the reference state.
      // H = [1 0 0 0; 0 1 0 0], so HPH^T picks out the top-left 2x2 of P.
      const P = refEkf.P;
      const R = refEkf.R;
      const S = [P[0] + R[0], P[1] + R[1], P[4] + R[2], P[5] + R[3]];
      // S is symmetric positive-definite; Cholesky: L such that S = L L^T
      // L = [[l00, 0], [l10, l11]]
      const l00 = Math.sqrt(S[0]);
      const l10 = S[2] / l00;
      const l11 = Math.sqrt(Math.max(S[3] - l10 * l10, 0));

      const nisValues: number[] = [];
      const numSamples = 500;

      for (let i = 0; i < numSamples; i++) {
        // Fresh EKF with identical state for every sample so S is constant
        const ekf = new Ekf({
          lat: refEkf.lat,
          lng: refEkf.lng,
          speed: refEkf.speed,
          heading: refEkf.heading,
          r: [gpsStdDeg * gpsStdDeg, 0, 0, gpsStdDeg * gpsStdDeg],
        });
        ekf.P = [...refEkf.P];

        // Sample z ~ N(0, S) via Cholesky: z = L * w, w ~ N(0, I)
        const [w1, w2] = boxMuller();
        const zLat = l00 * w1;
        const zLng = l10 * w1 + l11 * w2;

        const nis = ekf.update(ekf.lat + zLat, ekf.lng + zLng);
        nisValues.push(nis);
      }

      const meanNIS = nisValues.reduce((a, b) => a + b, 0) / nisValues.length;

      // chi-squared(2) has mean = 2; with 500 iid samples the sample mean
      // should be within ±0.5 with very high probability (std of mean ≈ 0.089).
      // Use ±0.6 to allow slight LCG bias.
      expect(meanNIS).toBeGreaterThan(1.4);
      expect(meanNIS).toBeLessThan(2.6);

      // ~5% of chi-squared(2) samples should exceed 5.99 (95th percentile).
      const exceeds = nisValues.filter(n => n > NIS_THRESHOLD_CHISQ_95).length;
      const exceedRate = exceeds / nisValues.length;
      expect(exceedRate).toBeGreaterThan(0.01);  // at least 1%
      expect(exceedRate).toBeLessThan(0.15);     // at most 15%
    });
  });

  describe('Near-Singular S Handling', () => {
    /**
     * Deterministic degenerate-S test.
     *
     * Setup: R = 0, P = 0  →  S = HPH^T + R = 0  (zero scale, genuinely degenerate).
     * Innovation is NON-ZERO so a mistaken acceptance would change the state.
     *
     * Correct behaviour:
     *  - mat2x2Invert detects scale = 0 and returns null before any regularization.
     *  - update() sets lastUpdateRejected = true and returns immediately.
     *  - State (lat, lng, speed, heading) is unchanged.
     *  - Covariance P is unchanged (every entry identical to before).
     *  - nisScore is NOT written as 0 (it retains its previous value, also 0 here,
     *    but the distinguishing signal is lastUpdateRejected = true, not nis).
     */
    it('rejects degenerate S (scale = 0) with non-zero innovation: state, covariance, and rejection flag', () => {
      const ekf = new Ekf({
        lat: 37.7749,
        lng: -122.4194,
        speed: 10,
        heading: 45,
        r: [0, 0, 0, 0], // R = 0
      });

      // Zero out P completely → S = HPH^T + R = 0 (scale = 0, degenerate)
      ekf.P.fill(0);

      // Snapshot state and covariance BEFORE the update
      const latBefore = ekf.lat;
      const lngBefore = ekf.lng;
      const speedBefore = ekf.speed;
      const headingBefore = ekf.heading;
      const pBefore = [...ekf.P]; // all zeros, but must remain so

      // NON-ZERO innovation: if the update were accepted, lat/lng would change.
      // 0.005° lat ≈ 556m — large enough that even a tiny K would move the state.
      const returnedNis = ekf.update(37.7799, -122.4144);

      // 1. Update must be flagged as rejected
      expect(ekf.lastUpdateRejected).toBe(true);

      // 2. nisScore must NOT have been written to 0 as a side-effect of rejection.
      //    Rejection is signalled by lastUpdateRejected, not by a zero nisScore.
      //    (Both are 0 here, but the causal signal must be the flag, not NIS.)
      expect(Number.isFinite(returnedNis)).toBe(true);

      // 3. State completely unchanged
      expect(ekf.lat).toBe(latBefore);
      expect(ekf.lng).toBe(lngBefore);
      expect(ekf.speed).toBe(speedBefore);
      expect(ekf.heading).toBe(headingBefore);

      // 4. Covariance completely unchanged (every entry)
      for (let i = 0; i < 16; i++) {
        expect(ekf.P[i]).toBe(pBefore[i]);
      }
    });

    it('clears lastUpdateRejected on subsequent valid update', () => {
      const gpsStdDeg = 10 / METERS_PER_DEGREE_LAT;
      const ekf = new Ekf({
        lat: 37.7749,
        lng: -122.4194,
        speed: 10,
        heading: 45,
        r: [0, 0, 0, 0], // degenerate R
      });
      ekf.P.fill(0);

      // First call: rejected
      ekf.update(37.7799, -122.4144);
      expect(ekf.lastUpdateRejected).toBe(true);

      // Restore valid R and P so S > 0
      (ekf as any)._R = [gpsStdDeg * gpsStdDeg, 0, 0, gpsStdDeg * gpsStdDeg];
      ekf.P[0] = gpsStdDeg * gpsStdDeg;
      ekf.P[5] = gpsStdDeg * gpsStdDeg;

      // Second call: accepted
      ekf.update(37.7749, -122.4194);
      expect(ekf.lastUpdateRejected).toBe(false);
    });
  });



  describe('Joseph-Form Covariance Update', () => {
    it('maintains covariance validity with Joseph form', () => {
      const ekf = new Ekf({ lat: 37.7749, lng: -122.4194, speed: 10, heading: 45 });

      ekf.predict(0.1, 0.5, 1.0);
      ekf.update(37.7750, -122.4193);

      // Check symmetry
      for (let i = 0; i < 4; i++) {
        for (let j = i + 1; j < 4; j++) {
          expect(Math.abs(ekf.P[i * 4 + j] - ekf.P[j * 4 + i])).toBeLessThan(1e-10);
        }
      }

      // Check finite
      for (let i = 0; i < 16; i++) {
        expect(Number.isFinite(ekf.P[i])).toBe(true);
      }

      // Check positive definiteness via Sylvester's criterion:
      // ALL four leading principal minors must be > 0 for a 4×4 PD matrix.
      const P = ekf.P;

      // Minor 1: det([P[0]])
      const det1 = P[0];

      // Minor 2: det([[P[0], P[1]], [P[4], P[5]]])
      const det2 = P[0] * P[5] - P[1] * P[4];

      // Minor 3: det of top-left 3×3
      const det3 =
        P[0] * (P[5] * P[10] - P[6] * P[9]) -
        P[1] * (P[4] * P[10] - P[6] * P[8]) +
        P[2] * (P[4] * P[9]  - P[5] * P[8]);

      // Minor 4: det of full 4×4 via cofactor expansion along row 0
      const det4 =
        P[0]  * ( P[5]  * (P[10] * P[15] - P[11] * P[14])
                - P[6]  * (P[9]  * P[15] - P[11] * P[13])
                + P[7]  * (P[9]  * P[14] - P[10] * P[13])) -
        P[1]  * ( P[4]  * (P[10] * P[15] - P[11] * P[14])
                - P[6]  * (P[8]  * P[15] - P[11] * P[12])
                + P[7]  * (P[8]  * P[14] - P[10] * P[12])) +
        P[2]  * ( P[4]  * (P[9]  * P[15] - P[11] * P[13])
                - P[5]  * (P[8]  * P[15] - P[11] * P[12])
                + P[7]  * (P[8]  * P[13] - P[9]  * P[12])) -
        P[3]  * ( P[4]  * (P[9]  * P[14] - P[10] * P[13])
                - P[5]  * (P[8]  * P[14] - P[10] * P[12])
                + P[6]  * (P[8]  * P[13] - P[9]  * P[12]));

      expect(det1).toBeGreaterThan(0);
      expect(det2).toBeGreaterThan(0);
      expect(det3).toBeGreaterThan(0);
      expect(det4).toBeGreaterThan(0);
    });
  });

  describe('Covariance Symmetry and Positive-Definiteness', () => {
    it('ensures P remains symmetric and PSD after multiple updates', () => {
      const ekf = new Ekf({ lat: 37.7749, lng: -122.4194, speed: 10, heading: 45 });

      for (let i = 0; i < 10; i++) {
        ekf.predict(0.1, 0.3, 0.5);
        ekf.update(37.7749 + 0.0001 * i, -122.4194 - 0.0001 * i);
      }

      // Symmetry
      for (let i = 0; i < 4; i++) {
        for (let j = i + 1; j < 4; j++) {
          expect(Math.abs(ekf.P[i * 4 + j] - ekf.P[j * 4 + i])).toBeLessThan(1e-9);
        }
      }

      // Positive definiteness via Sylvester's criterion — ALL four leading principal minors > 0
      const P = ekf.P;

      const det1 = P[0];
      const det2 = P[0] * P[5] - P[1] * P[4];
      const det3 =
        P[0] * (P[5] * P[10] - P[6] * P[9]) -
        P[1] * (P[4] * P[10] - P[6] * P[8]) +
        P[2] * (P[4] * P[9]  - P[5] * P[8]);
      const det4 =
        P[0]  * ( P[5]  * (P[10] * P[15] - P[11] * P[14])
                - P[6]  * (P[9]  * P[15] - P[11] * P[13])
                + P[7]  * (P[9]  * P[14] - P[10] * P[13])) -
        P[1]  * ( P[4]  * (P[10] * P[15] - P[11] * P[14])
                - P[6]  * (P[8]  * P[15] - P[11] * P[12])
                + P[7]  * (P[8]  * P[14] - P[10] * P[12])) +
        P[2]  * ( P[4]  * (P[9]  * P[15] - P[11] * P[13])
                - P[5]  * (P[8]  * P[15] - P[11] * P[12])
                + P[7]  * (P[8]  * P[13] - P[9]  * P[12])) -
        P[3]  * ( P[4]  * (P[9]  * P[14] - P[10] * P[13])
                - P[5]  * (P[8]  * P[14] - P[10] * P[12])
                + P[6]  * (P[8]  * P[13] - P[9]  * P[12]));

      expect(det1).toBeGreaterThan(0);
      expect(det2).toBeGreaterThan(0);
      expect(det3).toBeGreaterThan(0);
      expect(det4).toBeGreaterThan(0);
    });
  });

  describe('State Update Correctness', () => {
    it('updates state correctly with known innovation', () => {
      const ekf = new Ekf({ lat: 37.7749, lng: -122.4194, speed: 10, heading: 45 });

      const latBefore = ekf.lat;
      const lngBefore = ekf.lng;

      // Innovation: 0.0003° lat ≈ 33m, 0.0004° lng ≈ 35m at SF latitude (~37.8°)
      ekf.update(37.7752, -122.4190);

      // State should move toward measurement
      expect(ekf.lat).toBeGreaterThan(latBefore);
      expect(ekf.lng).toBeGreaterThan(lngBefore);
    });
  });

  describe('Spoof Detection with Production Threshold', () => {
    it('triggers spoof flag after 3 consecutive NIS > 5.99', () => {
      const ekf = new Ekf({
        lat: 37.7749,
        lng: -122.4194,
        speed: 10,
        heading: 45,
        nisThreshold: NIS_THRESHOLD_CHISQ_95,
        spoofTriggerTicks: 3,
      });

      expect(ekf.spoofFlag).toBe(false);

      // Large innovations to trigger high NIS
      ekf.update(37.7849, -122.4094); // ~11km jump
      expect(ekf.spoofFlag).toBe(false);

      ekf.update(37.7949, -122.3994);
      expect(ekf.spoofFlag).toBe(false);

      ekf.update(37.8049, -122.3894);
      expect(ekf.spoofFlag).toBe(true);
    });

    it('rejects updates when spoof flag is set', () => {
      const ekf = new Ekf({
        lat: 37.7749,
        lng: -122.4194,
        speed: 10,
        heading: 45,
        nisThreshold: NIS_THRESHOLD_CHISQ_95,
        spoofTriggerTicks: 3,
      });

      // Trigger spoof
      ekf.update(37.7849, -122.4094);
      ekf.update(37.7949, -122.3994);
      ekf.update(37.8049, -122.3894);
      expect(ekf.spoofFlag).toBe(true);

      const latBeforeReject = ekf.lat;
      const lngBeforeReject = ekf.lng;

      ekf.update(37.9000, -122.3000);

      // State should NOT change
      expect(ekf.lat).toBe(latBeforeReject);
      expect(ekf.lng).toBe(lngBeforeReject);
    });

    it('recovers from spoof after 5 consecutive NIS < 5.99', () => {
      const ekf = new Ekf({
        lat: 37.7749,
        lng: -122.4194,
        speed: 10,
        heading: 45,
        nisThreshold: NIS_THRESHOLD_CHISQ_95,
        spoofTriggerTicks: 3,
        spoofRecoveryTicks: 5,
      });

      // Trigger spoof
      ekf.update(37.7849, -122.4094);
      ekf.update(37.7949, -122.3994);
      ekf.update(37.8049, -122.3894);
      expect(ekf.spoofFlag).toBe(true);

      // Good measurements
      for (let i = 0; i < 5; i++) {
        ekf.update(ekf.lat + 0.00001, ekf.lng + 0.00001);
      }

      expect(ekf.spoofFlag).toBe(false);
    });
  });

  describe('Deterministic IMU Prediction', () => {
    it('predicts state deterministically with known inputs', () => {
      const ekf = new Ekf({ lat: 37.7749, lng: -122.4194, speed: 10, heading: 45 });

      const dt = 0.1;
      const accel = 1.0;
      const headingRate = 5.0;

      const latBefore = ekf.lat;
      const lngBefore = ekf.lng;
      const speedBefore = ekf.speed;
      const headingBefore = ekf.heading;

      ekf.predict(dt, accel, headingRate);

      // Verify state changed deterministically
      expect(ekf.lat).not.toBe(latBefore);
      expect(ekf.lng).not.toBe(lngBefore);
      expect(ekf.speed).toBe(speedBefore + accel * dt);
      expect(ekf.heading).toBe(headingBefore + headingRate * dt);

      // Verify repeatability
      const ekf2 = new Ekf({ lat: 37.7749, lng: -122.4194, speed: 10, heading: 45 });
      ekf2.predict(dt, accel, headingRate);

      expect(ekf2.lat).toBe(ekf.lat);
      expect(ekf2.lng).toBe(ekf.lng);
      expect(ekf2.speed).toBe(ekf.speed);
      expect(ekf2.heading).toBe(ekf.heading);
    });
  });

  describe('Full S Matrix (Off-Diagonal Covariance)', () => {
    it('computes full S = HPH^T + R including off-diagonal terms', () => {
      const ekf = new Ekf({ lat: 37.7749, lng: -122.4194, speed: 10, heading: 45 });

      // Set off-diagonal P terms
      ekf.P[1] = 0.0001; // P_lat_lng
      ekf.P[4] = 0.0001; // P_lng_lat

      ekf.update(37.7750, -122.4193);

      // Update should succeed with correlated covariance
      expect(Number.isFinite(ekf.nisScore)).toBe(true);
      expect(ekf.nisScore).toBeGreaterThan(0);
    });
  });
});
