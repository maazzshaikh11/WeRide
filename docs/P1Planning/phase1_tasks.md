# Phase 1 — EKF algorithm completion (core)

**Objective:** Make the EKF mathematically correct per §3.3–3.4. Current `P` propagation and Jacobian are stubbed. This is the foundation of spoof detection — a broken covariance produces a broken NIS.

---

## Task 1.1 — Implement motion-model Jacobian F

- **Description:** `predict` has `// TODO: proper Jacobian + covariance propagation`. `F` is the 4×4 Jacobian of the constant-velocity motion model w.r.t. state `[lat, lng, speed, heading]`.
- **Why it is required:** `P = F P Fᵀ + Q` requires the real Jacobian; identity approximation makes P never grow correctly, so S is wrong, so NIS is wrong, so spoof detection is wrong.
- **Files/components affected:** `modules/tracking/src/ekf.ts`.
- **Dependencies:** Task 0.1 (so we know which class owns state).
- **Expected deliverable:** `F` computed per tick from current state + dt, used in `P = F P Fᵀ + Q`.
- **Definition of Done:** Over 1000 normal ticks with synthetic GPS noise matching `R`, `P` stabilizes (doesn't blow up or collapse to 0).

### Subtasks:
- **1.1.1** — Derive `F` symbolically (partial derivatives of `lat_{k+1}`, `lng_{k+1}`, `speed_{k+1}`, `heading_{k+1}` w.r.t. each state). Document in README.
- **1.1.2** — Implement matrix multiply helpers (`matMul`, `matTranspose`, `matAdd`) for 4×4 — no external linalg dep (keep module pure TS, testable in node env per AGENTS.md).
- **1.1.3** — Wire `P = F P Fᵀ + Q` into `predict`.

---

## Task 1.2 — Implement measurement Jacobian H and full innovation covariance S

- **Description:** `update` uses `s00 = P[0]+R[0]`, `s11 = P[5]+R[3]` — diagonal-only. Real `S = H P Hᵀ + R` where `H` is the 2×4 measurement Jacobian (selects lat/lng from state).
- **Why it is required:** Spec §3.4 explicitly: `NIS = innovationᵀ S⁻¹ innovation`, `S = H P Hᵀ + R`. Simplified diagonal S breaks NIS distribution.
- **Files/components affected:** `modules/tracking/src/ekf.ts`.
- **Dependencies:** Task 1.1 (P must be correct first).
- **Expected deliverable:** Full 2×2 `S`, 2×2 inversion (closed-form for 2×2), NIS from full quadratic form.
- **Definition of Done:** `nis_chi_squared_sanity` test mean ≈ 2 (not <50) over 1000 ticks with Gaussian noise calibrated to `R`.

### Subtasks:
- **1.2.1** — Define `H` (2×4, selects lat/lng).
- **1.2.2** — Compute `S = H P Hᵀ + R` (2×2).
- **1.2.3** — Invert `S` (2×2 closed-form: `1/det * [[S11, -S01],[-S01, S00]]`).
- **1.2.4** — `NIS = innovᵀ S⁻¹ innov`.

---

## Task 1.3 — Implement Kalman gain K and full P update

- **Description:** `update` does scalar `P[0] *= 1-k0`. Real: `K = P Hᵀ S⁻¹`, `P = (I - K H) P`.
- **Why it is required:** Correct covariance after update feeds the next prediction; wrong P → wrong S next tick → wrong NIS.
- **Files/components affected:** `modules/tracking/src/ekf.ts`.
- **Dependencies:** Task 1.2.
- **Expected deliverable:** 4×2 gain `K`, full `P = (I₄ - K H) P` post-update.
- **Definition of Done:** P remains symmetric positive-definite over long runs (check via test).

---

## Task 1.4 — Integrate accelerometer into `predict` (IMU dead-reckoning)

- **Description:** `predict(dt, speedInput, headingRate)` takes `speedInput` externally; `TrackingService` passes `ekf.speed` (last GPS-derived). During spoof, speed never updates from IMU. Integrate `accelMagnitude` into speed: `speed += a_world * dt` (gravity-corrected, projected onto heading).
- **Why it is required:** Spec §3.3 "accelerometer magnitude + gyroscope heading rate between GPS fixes to propagate state forward." §3.5 "trust IMU dead-reckoning only" — dead-reckoning means accel-driven, not frozen speed.
- **Files/components affected:** `modules/tracking/src/ekf.ts` (`predict` signature), `modules/tracking/src/trackingService.ts` (pass accel), `modules/tracking/src/sensorStream.ts` (expose gravity-corrected accel).
- **Dependencies:** Task 1.1.
- **Expected deliverable:** `predict(dt, accelForward, headingRate)` integrates `speed += accelForward*dt`; `SensorStream` exposes forward accel (magnitude minus gravity, projected onto heading vector).
- **Definition of Done:** During a simulated spoof (GPS jumps away), EKF lat/lng continue along IMU-projected path, not the spoofed GPS.

### Subtasks:
- **1.4.1** — Change `predict` signature to accept `accelForward` (m/s²) instead of `speedInput`.
- **1.4.2** — `SensorStream`: compute forward accel = `(a·headingVec)` where `headingVec = [cos θ, sin θ]`, subtract gravity `~9.81` from total magnitude before projection (or use a high-pass on accel magnitude).
- **1.4.3** — `TrackingService._onTick` passes `sensors.accelForward`.

---

## Task 1.5 — Tune Q and R

- **Description:** `Q = [0.1]*16`, `R = [10,0,0,10]` are placeholders. Spec §3.3: "tune to reflect IMU noise"; §3.4 R = GPS variance. Week 2–3 field tests.
- **Why it is required:** NIS distribution depends entirely on Q/R ratio. Untuned → false spoofs or missed spoofs.
- **Files/components affected:** `modules/tracking/src/ekf.ts` (defaults), `modules/tracking/README.md` (final values).
- **Dependencies:** Tasks 1.1–1.4 (math must be correct before tuning is meaningful).
- **Expected deliverable:** Documented `Q` (4×4 diagonal) and `R` (2×2) with justification from residual plots.
- **Definition of Done:** README table filled (Q, R, tick rate, NIS threshold, N, M). NIS sanity test mean ≈ 2.

**Undecided:** Exact Q/R values — spec says "tune in Week 2-3 field tests." Plan assumes Week 2–3 field work; values to be determined empirically. Mark README rows as TBD until then.