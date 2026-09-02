# Phase 8 — CPU/battery profiling & hardening Implementation Plan

## Executive Summary
This plan details the final phase for Person A's Tracking Module: Phase 8. The goal is to prove the `<1% CPU` performance constraint through a profiling harness and to implement the offline cold-start resilience rule where the EKF resumes from local storage after an app kill.

## 1. Exact Phase 8 Task Breakdown
Based on `phase8_tasks.md`:
*   **Task 8.1 — CPU profiling harness:** Run `TrackingService` for 5 min on device, measure CPU% via Android Studio profiler / Instruments (iOS). Document in `README.md`.
*   **Task 8.2 — Offline cold-start test (§11 last row):** Kill app mid-ride, relaunch with no network → EKF resumes, buffers, re-publishes on reconnect.

## 2. Current Implementation Audit
*   **Task 8.1 (Profiling):** Not started. The `README.md` has placeholders for performance tuning, but no CPU profiling instructions or harness.
*   **Task 8.2 (Offline Resume):** 
    *   `LocationPublisher` correctly buffers the *latest* offline payload and flushes it on `socket.on('connect')` (Phase 3.3 requirement met).
    *   `TrackingService` currently saves `HLC` state to MMKV on every tick.
    *   **Missing:** The `Ekf` instance is constructed from scratch. Its internal state (4-state vector `x` and 4x4 covariance matrix `P`) is never saved or loaded. A cold start currently resets the tracking state to 0 and loses the covariance confidence until a new GPS fix arrives.

## 3. Implementation Approach

### Task 8.1 — CPU Profiling Harness
*   **Action:** No product code changes required.
*   **Documentation:** Update `modules/tracking/README.md` with explicit instructions on how to run the tracking service standalone (via the Phase 5 demo runnable) on a physical device, and how to attach the Android Studio CPU Profiler to verify the `< 1%` CPU footprint.

### Task 8.2 — Offline Cold-Start
*   **Action 1 (EKF Serialization):** Add `toState(): EkfState` and `fromState(state: EkfState, params: EkfParams): Ekf` to `modules/tracking/src/ekf.ts`. The state must serialize `lat`, `lng`, `speed`, `heading`, `p` (covariance array), and `spoofFlag`.
*   **Action 2 (Persistence):** Create `modules/tracking/src/ekfStore.ts` mirroring `hlcStore.ts`. It will use the same `tracking` MMKV instance to persist and load the serialized EKF state.
*   **Action 3 (Service Integration):** Update `TrackingService._onTick()` to call `persistEkf(this._ekf)` right after `persistHlc()`. Update `TrackingService` (or its consumer) to attempt to load from `ekfStore` before creating a fresh EKF.
*   **Action 4 (Testing):** Add `trackingService.test.ts` cases to simulate a cold start: construct service, tick, "kill" (clear memory but keep mmkv), reconstruct service, verify EKF resumes exactly from the previous state without needing a new GPS fix.

## 4. Exact Files to Modify/Create
#### [MODIFY] [README.md](file:///Users/maaz/WeRide/modules/tracking/README.md)
*   Add CPU profiling harness and documentation.

#### [MODIFY] [ekf.ts](file:///Users/maaz/WeRide/modules/tracking/src/ekf.ts)
*   Add `toState()` and `fromState()` static methods.

#### [NEW] [ekfStore.ts](file:///Users/maaz/WeRide/modules/tracking/src/ekfStore.ts)
*   MMKV wrappers `persistEkf()` and `loadEkfState()`.

#### [MODIFY] [trackingService.ts](file:///Users/maaz/WeRide/modules/tracking/src/trackingService.ts)
*   Call `persistEkf` on tick. Restore from it on start.

#### [MODIFY] [trackingService.test.ts](file:///Users/maaz/WeRide/modules/tracking/test/trackingService.test.ts)
*   Add cold-start offline resume test cases.

## 5. Frozen Contracts / Dependencies
*   **Contracts:** `verified_location.json` is entirely unaffected by this phase.
*   **Cross-Person Dependencies:** 
    *   No new dependencies on B, C, or D.
    *   `LocationPublisher` offline buffering relies on the shared Socket connection, which is already functional.

## 6. Test Strategy & Validation
### Automated Tests
*   `trackingService.test.ts`: 
    *   `should serialize EKF state on tick`
    *   `should resume from saved EKF state across service reconstruction`
*   Command: `cd modules/tracking && npm test`

### Manual Verification
*   **Task 8.1:** Must run the app on a physical Android or iOS device in Release mode, attach the native profiler, and verify CPU usage is strictly under 1% while `TrackingService` runs at 1 Hz. (As an AI, I cannot perform this step; it requires manual developer action following the README).

## 7. Risks & Blockers
*   **Risks:** JSON serialization of the 4x4 Covariance Matrix (16 floats) on every 1 Hz tick via MMKV. `react-native-mmkv` uses a fast JSI bridge, so the overhead should be negligible (< 1ms), but it's worth noting for the 1% CPU budget.
*   **Blockers:** None.

## 8. Git Status & Compliance
*   **Modified files:** Only `docs/P1Planning/implementation_plan_phase8.md` was created.
*   **Source Code Changes:** None.
*   **Git History:** Unaltered.

## User Decisions
- **Serialization performance budget:** 1 Hz EKF/MMKV persistence is accepted as within the project's intended performance budget. It will be synchronous.
- **Architecture / Responsibility:** For offline EKF resumption, caller-side restoration + dependency injection will be used. `TrackingService` will NOT internally discover/load `ekfStore`. The caller should load persisted EKF state, construct the `Ekf`, and inject it into `TrackingService`.

## 8. Git Status & Compliance
*   **Modified files:** Only `docs/P1Planning/implementation_plan_phase8.md` was created.
*   **Source Code Changes:** None.
*   **Git History:** Unaltered.
