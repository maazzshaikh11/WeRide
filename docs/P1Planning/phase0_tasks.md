# Phase 0 — Lock interfaces & reconcile existing code

**Objective:** Eliminate the duplication and ambiguity in the current scaffold so the rest of the plan builds on one canonical foundation. Do this before touching algorithm internals.

---

## Task 0.1 — Decide canonical spoof-flag location

- **Description:** `Ekf` and `SpoofDetector` both implement the same §3.5 state machine. Pick one canonical home.
- **Why it is required:** Spec §8 says `spoofDetector.ts` "may be folded into ekf if small." Two implementations will diverge during tuning.
- **Files/components affected:** `modules/tracking/src/ekf.ts`, `modules/tracking/src/spoofDetector.ts`, `modules/tracking/src/index.ts`.
- **Dependencies:** None.
- **Expected deliverable:** One of: (a) `Ekf` delegates to a `SpoofDetector` instance internally, or (b) `SpoofDetector` is removed and `Ekf` owns the flag. Recommendation: keep `SpoofDetector` as the pure state machine and have `Ekf.update` call `spoofDetector.update(nis)` — separates NIS math from flag lifecycle, both testable.
- **Definition of Done:** Only one spoof-flag implementation; `index.ts` exports the chosen surface; existing tests still pass after refactor.

---

## Task 0.2 — Unify NIS DoF decision

- **Description:** Decide and document whether NIS uses 2 DoF (lat/lng only) or 4 DoF (full state). Current code uses 2 DoF; spec §3.4 says "dim(measurement)" — GPS measures lat/lng, so 2 DoF is correct, but **document it** so the chi-squared threshold (5.99 for 2 DoF) is justified.
- **Why it is required:** NIS threshold `5.99` is chi-squared(2) 95th pct; if DoF silently changes, threshold is wrong.
- **Files/components affected:** `modules/tracking/src/ekf.ts` (comment), `modules/tracking/README.md`.
- **Dependencies:** None.
- **Expected deliverable:** A named constant `NIS_DOF = 2` and a comment citing chi-squared(2).
- **Definition of Done:** README states DoF and threshold source.

---

## Task 0.3 — Fix `MockLocationProducer` HLC violation

- **Description:** `timestampHlc: \`mock-${Date.now()}\`` is not an HLC. The mock must use Person B's `HLC.now()` so downstream consumers parse it identically.
- **Why it is required:** `HLC.parse` will throw on `mock-<number>`. Contract field is `timestamp_hlc` (string from HLC). B's HLC is shipped — use it.
- **Files/components affected:** `modules/tracking/src/mockLocationProducer.ts`.
- **Dependencies:** None (HLC exists in `@hazard/*`).
- **Expected deliverable:** `MockLocationProducer` accepts an `HlcSource` (or `HLC`) and calls `.now()` for each tick.
- **Definition of Done:** Mock payload `timestamp_hlc` is parseable by `HLC.parse`.

---

## Task 0.4 — Compute heading in `MockLocationProducer`

- **Description:** `headingDeg` is hardcoded 0. Compute bearing between consecutive polyline points.
- **Why it is required:** C's routing and D's FL both consume `heading_deg`; 0 is wrong data.
- **Files/components affected:** `modules/tracking/src/mockLocationProducer.ts`.
- **Dependencies:** None.
- **Expected deliverable:** Bearing computed via `Math.atan2` of `Δlng, Δlat` (great-circle bearing formula).
- **Definition of Done:** Mock heading matches polyline direction within ±5°.