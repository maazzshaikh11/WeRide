# Phase 7 — Tests (integrated into phases, consolidated here for visibility)

**Objective:** All §7 mandatory tests passing with tight assertions, plus the new tests the current code needs.

---

## Task 7.1 — Tighten `nis_chi_squared_sanity` (in Phase 1)

- **Description:** Current asserts mean < 50. Spec: "mean ≈ 2." Depends on Phase 1 math being correct.
- **Files/components affected:** `modules/tracking/test/ekf.test.ts`.
- **Dependencies:** Tasks 1.1–1.3, 1.5.
- **Expected deliverable:** `expect(mean).toBeCloseTo(2, 1)` over 1000 ticks with Gaussian noise calibrated to R.
- **Definition of Done:** Test passes with tight tolerance.

---

## Task 7.2 — `spoof_injection_detected` (exists, verify post-Phase 1)

- **Description:** Test exists and passes against simplified EKF. Re-verify against the real Jacobian-based EKF.
- **Files/components affected:** `modules/tracking/test/ekf.test.ts`.
- **Dependencies:** Phase 1.
- **Expected deliverable:** Teleport 1km → flag true within N=3 ticks; state stays at IMU-projected position.
- **Definition of Done:** Assert `ekf.lat` is close to pre-spoof lat (not the spoofed value).

---

## Task 7.3 — `spoof_recovery` (exists, verify)

- **Description:** Exists, passes. Re-verify.
- **Files/components affected:** `modules/tracking/test/ekf.test.ts`.
- **Dependencies:** Phase 1.
- **Expected deliverable:** Flag clears after M ticks low-NIS.
- **Definition of Done:** Test passes unchanged.

---

## Task 7.4 — `stale_marker_grey` (missing)

- **Description:** Spec §7 mandates this; missing. Widget test — render `RiderMarkerOverlay` with a rider whose `receivedAt` is 11s ago → assert grey color.
- **Files/components affected:** `app/__tests__/riderMarker.test.tsx` (new — app tests live in `app/__tests__/` per AGENTS.md).
- **Dependencies:** Phase 4 (overlay implemented).
- **Expected deliverable:** RN test renderer (app uses `react-test-renderer`) asserting the CircleLayer's `circle-color` resolves to grey.
- **Definition of Done:** 11s-old rider → grey.

---

## Task 7.5 — `mock_producer_contract` (missing)

- **Description:** Spec §7 mandates: "mock emits exact `verified_location` schema — guards against contract drift." Missing.
- **Files/components affected:** `modules/tracking/test/mockProducer.test.ts` (new).
- **Dependencies:** Task 0.3, Task 0.4.
- **Expected deliverable:** Run mock for 5 ticks, assert every emitted payload has all 10 required fields with correct types; assert `timestamp_hlc` parses via `HLC.parse`.
- **Definition of Done:** Test passes; would fail if a contract field is dropped.

---

## Task 7.6 — Covariance positive-definite check (new, supports Phase 1)

- **Description:** Over long runs, P must stay SPD. Cheap check via eigenvalues or Cholesky.
- **Files/components affected:** `modules/tracking/test/ekf.test.ts`.
- **Dependencies:** Task 1.3.
- **Expected deliverable:** 10k-tick run, assert all eigenvalues of P > 0.
- **Definition of Done:** No numerical drift in P.