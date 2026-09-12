# Phase 8 — CPU/battery profiling & hardening

**Objective:** Meet §3.6 (<1% CPU) and §11 row 7. No profiling exists.

---

## Task 8.1 — CPU profiling harness

- **Description:** Run `TrackingService` for 5 min on device, measure CPU% via Android Studio profiler / Instruments (iOS). Document in README.
- **Why it is required:** Spec hard requirement.
- **Files/components affected:** `modules/tracking/README.md` (results section).
- **Dependencies:** Phases 1–3 (real service running).
- **Expected deliverable:** README table with CPU% on 2 devices.
- **Definition of Done:** <1% CPU or documented mitigation (e.g., reduce tick rate).

---

## Task 8.2 — Offline cold-start test (§11 last row)

- **Description:** Kill app mid-ride, relaunch with no network → EKF resumes, buffers, re-publishes on reconnect.
- **Why it is required:** Spec §6 Week 6 + §11 last row.
- **Files/components affected:** `modules/tracking/src/trackingService.ts` (resume logic), `modules/tracking/test/trackingService.test.ts` (new).
- **Dependencies:** Task 3.3 (offline queue).
- **Expected deliverable:** On `start`, load last EKF state from MMKV; if offline, buffer; on reconnect, flush.
- **Definition of Done:** Test simulates offline → online → latest position published, not stale.