# Person A — Live Tracking & Anti-Spoofing (EKF) Implementation Plan

## Source-of-truth baseline (inspected)

- `docs/Development/Person_A_Tracking_AntiSpoofing.md` — spec (218 lines).
- `contracts/verified_location.json` — frozen, 10 required fields, transport annotated.
- `modules/tracking/src/*` — 6 files exist; all are partial scaffolds with TODOs.
- `modules/tracking/test/ekf.test.ts` — 6 tests exist; pass against simplified logic.
- `modules/hazard-sos/src/hlc/hlc.ts` — HLC **is shipped** (Kulkarni-style, `now(): string`). Real, not mock. `HlcSource` interface in tracking already matches `HLC.now()`.
- `app/src/screens/map/MapScreen.tsx` — shell exists, overlay registration pattern present.
- `app/src/screens/map/overlays/RiderMarkerOverlay.tsx` — placeholder, returns empty `<View/>`.
- `app/src/services/socketService.ts` — shared Socket.io client ready (`getLocationSocket()`).
- `app/src/store/appStore.ts` — Zustand root store (userId, groupId).

---

## Current implementation status (detailed)

| Component | File | Status | Notes |
|---|---|---|---|
| `verified_location` contract | `contracts/verified_location.json` | ✅ Done | Frozen; all 10 required fields present. |
| EKF class | `modules/tracking/src/ekf.ts` | ⚠️ Partial | 4-state present; **covariance propagation is a TODO** (P stays near-identity); **Jacobian F is approximated as identity**; update step uses scalar-simplified gain; speed/heading not updated by GPS; `predict` ignores `accelMagnitude`. |
| NIS computation | `modules/tracking/src/ekf.ts` | ⚠️ Partial | `S = diag(P)+diag(R)` only; uses 2 DoF (lat/lng). Matches spec §3.4 intent but S is not the full `H P Hᵀ + R`. |
| Spoof-flag state machine | `modules/tracking/src/ekf.ts` + `src/spoofDetector.ts` | ⚠️ Partial | Two parallel implementations exist. `Ekf` inlines the flag logic; `SpoofDetector` is a standalone class with its own tests. Spec §8 says "may be folded into ekf if small" — **undecided which is canonical**. Duplication risks divergence. |
| IMU dead-reckoning | `modules/tracking/src/ekf.ts` | ⚠️ Partial | When flagged, GPS update is skipped (✅), and `predict` continues using `speedInput` + `headingRate`. But `TrackingService._onTick` passes `this._ekf.speed` as `speedInput`, so during spoof the state drifts at the last GPS-derived speed with no IMU accel correction. Real dead-reckoning needs accel-integrated velocity. |
| `predict` from IMU | `modules/tracking/src/ekf.ts` | ⚠️ Partial | `headingRate` used ✅; `accelMagnitude` **ignored** (no velocity update from accelerometer). |
| `SensorStream` | `modules/tracking/src/sensorStream.ts` | ⚠️ Partial | Subscribes to accel/gyro/GPS ✅. **No downsampling**; **no permission handling**; **no background location**; `accelMagnitude` stored as raw `x²+y²+z²` (not magnitude sqrt, not gravity-corrected); GPS watch calls `ekf.update` directly inside the geolocation callback (couples sensor to filter, hard to test). |
| `LocationPublisher` | `modules/tracking/src/locationPublisher.ts` | ⚠️ Partial | Socket emit ✅; throttled Firestore set ✅; payload shape matches contract ✅. **No late-joiner fetch** (read path); **no offline queue**; `.set()` is fire-and-forget (no error handling). |
| `TrackingService` | `modules/tracking/src/trackingService.ts` | ⚠️ Partial | Wires sensors→ekf→publisher ✅; 1 Hz timer ✅; uses `HlcSource` ✅. **`predict` uses `this._ekf.speed` as `speedInput`** (no accel integration); **`update` is called inside `SensorStream`'s GPS callback, not on the tick** → race between predict-on-tick and update-on-GPS-fix; **no background execution**; **no offline/resume logic**. |
| `MockLocationProducer` | `modules/tracking/src/mockLocationProducer.ts` | ⚠️ Partial | Polyline walker + 1 Hz emit ✅. **`headingDeg` hardcoded 0** (should compute bearing between polyline points); **`timestampHlc` is `mock-${Date.now()}`** — violates HLC contract (must use Person B's `HLC.now()`); **`nisScore` hardcoded 1.0**; **no spoof simulation toggle** (demo needs a way to inject spoof). |
| `index.ts` re-exports | `modules/tracking/src/index.ts` | ✅ Done | Exports all classes. |
| README tuning doc | `modules/tracking/README.md` | ⚠️ Partial | Structure present; **Q and R are TODO**, tick rate documented, spoof logic documented. |
| EKF tests | `modules/tracking/test/ekf.test.ts` | ⚠️ Partial | init ✅; NIS sanity ✅ (weak — asserts mean < 50, spec wants mean ≈ 2); spoof injection ✅; spoof recovery ✅; **`SpoofDetector` unit tests exist but are redundant with `Ekf`-inline tests**; **`stale_marker_grey` test missing**; **`mock_producer_contract` test missing**. |
| `RiderMarkerOverlay` | `app/src/screens/map/overlays/RiderMarkerOverlay.tsx` | ❌ Not implemented | Placeholder `<View/>`. No Socket listener, no markers, no green/red/grey logic, no stale handling, no tap info card. |
| `MapScreen` shell | `app/src/screens/map/MapScreen.tsx` | ⚠️ Partial | Shell renders overlays ✅; **`MapboxGL.setAccessToken(process.env.MAPBOX_TOKEN ?? '')`** — env var not wired at RN build time (RN uses `react-native-dotenv` or `__DEV__` config, not `process.env` directly); base `MapView` has no camera, no user-location, no rider shape source. |
| Late-joiner read path | (none) | ❌ Missing | Spec §6 Week 4: open app mid-ride → read Firestore `groups/{gid}/locations/{rider_id}` → show last-known. No code reads from Firestore locations. |
| Ride-data buffer for FL (D) | (none) | ❌ Missing | Spec §6 Week 5: expose local lat/lng/speed/time history buffer for D's FL client. **Undecided shape** — coordinate with D, add to `/contracts`. |
| Demo `__main__`/runnable | (none) | ❌ Missing | Spec §7 ponytail rule: a runnable that prints a sample EKF run with/without spoof. |
| CPU/battery profiling | (none) | ❌ Missing | Spec §3.6 + §11 row 7: <1% CPU. No profiling harness. |
| Background location | (none) | ❌ Missing | `react-native-background-geolocation` is in `app/package.json` deps but **not used** anywhere. TODO in `trackingService.ts` + `sensorStream.ts`. |
| HLC integration | `modules/tracking/src/trackingService.ts` | ⚠️ Partial | `HlcSource` interface matches `HLC.now(): string` ✅. **No persistence** (HLC must survive app restart — `HLC.toState()`/`fromState` exist but tracking never persists it). **No actual wiring to `@hazard/*`** — `TrackingService` takes an `HlcSource` but nothing constructs it from `HLC.fresh()`. |
| TS path aliases | configs | ✅ Done | `@tracking/*`, `@hazard/*` etc. wired in all `tsconfig.json` + `jest.config.js`. |
| Mocks | `modules/tracking/test/__mocks__/` | ✅ Done | firebase, mmkv, sensors, geo, webrtc, socket — all present. |

---

## Phases

### Phase 0 — Lock interfaces & reconcile existing code
**Objective:** Eliminate the duplication and ambiguity in the current scaffold so the rest of the plan builds on one canonical foundation. Do this before touching algorithm internals.
→ See `phase0_tasks.md`

### Phase 1 — EKF algorithm completion (core)
**Objective:** Make the EKF mathematically correct per §3.3–3.4. Current `P` propagation and Jacobian are stubbed. This is the foundation of spoof detection — a broken covariance produces a broken NIS.
→ See `phase1_tasks.md`

### Phase 2 — Sensor pipeline & background location
**Objective:** Make `SensorStream` production-ready: permissions, downsampling, background execution, decoupling from EKF for testability.
→ See `phase2_tasks.md`

### Phase 3 — Publish pipeline & offline resilience
**Objective:** Complete `LocationPublisher` (late-joiner read, offline queue) and wire `HLC` with persistence.
→ See `phase3_tasks.md`

### Phase 4 — Live Map rider markers (UI)
**Objective:** Implement `RiderMarkerOverlay` per §4.1: green/red/grey markers, Socket listener, stale handling, debug NIS info card.
→ See `phase4_tasks.md`

### Phase 5 — Mock producer completion & demo tooling
**Objective:** Make the mock useful for the spoof demo (§10) and add the ponytail `demo()` runnable (§7).
→ See `phase5_tasks.md`

### Phase 6 — Integration & cross-module wiring
**Objective:** Wire tracking into the app shell, consume B's HLC, provide ride-data buffer to D, integrate with C's route origin.
→ See `phase6_tasks.md`

### Phase 7 — Tests (integrated into phases, consolidated here for visibility)
**Objective:** All §7 mandatory tests passing with tight assertions, plus the new tests the current code needs.
→ See `phase7_tasks.md`

### Phase 8 — CPU/battery profiling & hardening
**Objective:** Meet §3.6 (<1% CPU) and §11 row 7. No profiling exists.
→ See `phase8_tasks.md`

---

## Final sections

### 1. Current Status

**Already implemented (✅):**
- `verified_location` contract (frozen, all fields).
- TS path aliases across all packages.
- Test mock harness (firebase, mmkv, sensors, geo, webrtc, socket).
- `index.ts` re-exports.
- Person B's `HLC` (real, shipped) — A consumes, doesn't build.
- `app/src/services/socketService.ts` (shared Socket client).
- `app/src/store/appStore.ts` (root store: userId, groupId).
- `MapScreen.tsx` shell with overlay slot pattern.
- Basic 4-state EKF scaffold (init, predict, update, NIS, flag).
- `SpoofDetector` standalone class + tests.
- `LocationPublisher` Socket emit + throttled Firestore set (shape matches contract).
- `MockLocationProducer` polyline walker + 1 Hz emit.
- 4 passing EKF tests (init, NIS sanity weak, spoof inject, spoof recovery).
- `TrackingService` wiring (sensors→ekf→publisher, 1 Hz, HlcSource interface).

**Partially implemented (⚠️):**
- EKF covariance propagation (`P = F P Fᵀ + Q` is TODO; F is approximated identity).
- Innovation covariance `S` (diagonal-only, not `H P Hᵀ + R`).
- Kalman gain `K` (scalar, not full matrix).
- NIS (2 DoF correct, but computed from simplified S).
- Spoof-flag (duplicated in `Ekf` + `SpoofDetector` — pick one).
- IMU dead-reckoning (GPS rejected when flagged ✅, but speed frozen — no accel integration).
- `SensorStream` (subscribes ✅, no downsampling/permissions/background/decoupling).
- `LocationPublisher` (emit ✅, no late-joiner read, no offline queue, fire-and-forget writes).
- `TrackingService` (wires ✅, no background, no resume, predict uses stale speed).
- `MockLocationProducer` (walks ✅, heading=0, timestamp_hlc not HLC, no spoof injection).
- README (structure ✅, Q/R TODO).
- NIS sanity test (passes but weak — asserts <50 not ≈2).

**Not implemented (❌):**
- `RiderMarkerOverlay` (placeholder `<View/>`).
- Late-joiner Firestore read path.
- Offline queue / reconnect flush.
- Ride-data buffer for Person D.
- `demo()` runnable (§7 ponytail).
- CPU/battery profiling.
- Background location (`react-native-background-geolocation` unused).
- GPS permission request flow.
- `stale_marker_grey` test.
- `mock_producer_contract` test.
- `MapboxGL.setAccessToken` (env not wired for RN).
- HLC persistence across app restart.
- Covariance SPD check.

**Needs modification/fixing:**
- `ekf.ts` — covariance math (Phase 1).
- `spoofDetector.ts` vs `ekf.ts` — dedupe (Task 0.1).
- `mockLocationProducer.ts` — HLC + heading + spoof (Phase 0 + 5).
- `sensorStream.ts` — decouple from EKF, downsample, permissions, background (Phase 2).
- `trackingService.ts` — accel-driven predict, resume, HLC construct (Phases 1, 3, 6).
- `ekf.test.ts` — tighten NIS sanity, add IMU-dead-reckoning assertion (Phase 7).
- `MapScreen.tsx` — token wiring, service start (Phases 4, 6).

### 2. Phase Dependency Graph

```
Phase 0 (lock interfaces)
   │
   ├──> Phase 1 (EKF math) ──┐
   │                         ├──> Phase 7.1–7.3, 7.6 (EKF tests)
   │                         │
   ├──> Phase 2 (sensors) ──┤
   │                         ├──> Phase 5 (mock + demo)
   │                         │
   ├──> Phase 3 (publish) ──┤
   │                         ├──> Phase 4 (UI markers) ──> Phase 7.4 (stale test)
   │                         │
   │                         └──> Phase 6 (integration) ──> Phase 8 (profiling)
   │
   └──> Phase 7.5 (mock contract test) [after 0.3, 0.4]
```

**Hard blockers:**
- Phase 1 blocks Phase 7 NIS tests (math must be right).
- Phase 2 + 3 block Phase 6 (can't integrate what isn't started).
- Phase 4 blocks Phase 7.4 (stale test needs the widget).
- Task 0.3 blocks Task 7.5 (mock contract test needs HLC-formatted timestamps).

### 3. Parallel Work

These can proceed simultaneously without conflict:

- **Phase 0** (Task 0.1 dedupe, 0.2 doc, 0.3 HLC mock, 0.4 heading) — all independent of each other.
- **Phase 2** (sensors) ∥ **Phase 3** (publish) — different files, no overlap.
- **Phase 4** (UI overlay) ∥ **Phase 5** (demo tooling) — UI is in `app/`, demo is in `modules/tracking/src/`.
- **Task 6.3** (ride buffer for D) ∥ **Task 6.4/6.5** (coordination with B/C) — only 6.3 writes code; others are sync notes.
- **Phase 7 tests** are woven in — each test unblocks when its phase lands, so multiple tests can be written in parallel as their phases complete.

### 4. Person 1 Definition of Done

- [ ] `verified_location` published over Socket `location:update` at 1 Hz with all 10 contract fields.
- [ ] Throttled Firestore write to `groups/{gid}/locations/{riderId}` (5–10s cadence).
- [ ] Late-joiner reads last-known from Firestore on cold open.
- [ ] EKF 4-state with real Jacobian F, full `P = F P Fᵀ + Q`, full `S = H P Hᵀ + R`, full `K`, full `P = (I - KH)P`.
- [ ] NIS computed as `innovᵀ S⁻¹ innov` with 2 DoF, threshold `5.99` (chi-squared(2) 95th), named constant.
- [ ] `spoof_flag=true` after N=3 consecutive NIS > threshold; IMU dead-reckoning (accel-integrated) takes over; GPS rejected.
- [ ] `spoof_flag=false` after M=5 consecutive NIS < threshold.
- [ ] Q and R tuned via field tests; final values in `modules/tracking/README.md`.
- [ ] `timestamp_hlc` from Person B's `HLC.now()`, persisted across restart.
- [ ] `SensorStream` downsamples IMU to 1 Hz; background location works screen-off 5 min.
- [ ] GPS permission requested on first launch.
- [ ] `RiderMarkerOverlay`: green (fresh+verified), red (spoof), grey (>10s stale), tap card with NIS in debug mode.
- [ ] Offline queue: disconnect → buffer → reconnect → flush latest.
- [ ] `demo()` runnable prints EKF run with/without spoof injection.
- [ ] Tests pass: `nis_chi_squared_sanity` (mean ≈ 2), `spoof_injection_detected` (flag + state stays IMU), `spoof_recovery`, `stale_marker_grey`, `mock_producer_contract`, covariance SPD.
- [ ] CPU <1% measured on ≥2 devices, documented in README.
- [ ] `npm run lint && npm run typecheck && npm test` green in `modules/tracking` (CI order).
- [ ] Week 4 integration swap: mock replaced by real EKF for B, C, D without contract drift.

### 5. Final Demo Flow Mapping

Spec §12 item 1 / §10 demo script:

| Demo step | Implementation component | Task/Phase |
|---|---|---|
| 1. Live Map with ≥2 riders as green dots | `RiderMarkerOverlay` + Socket listener + `TrackingService` publishing | Phases 4.1, 4.2, 6.1 |
| 2. GPS spoof → teleport 1km | `MockLocationProducer.injectSpoof` or real GPS-spoof app feeding `SensorStream` | Task 5.1 (mock) / Phase 2 (real) |
| 3. Within ~3s: marker red, NIS spike (debug overlay) | `Ekf.update` NIS spike → `SpoofDetector` flag after N=3 → marker red via `RiderMarkerOverlay` color logic → NIS shown in tap card (debug) | Tasks 1.2, 0.1, 4.2, 4.4 |
| 3b. Marker stays at IMU-projected real position | `predict` integrates `accelForward` + `headingRate`; GPS update skipped when flagged | Task 1.4 |
| 4. Stop spoofing → marker green after recovery | `SpoofDetector` clears after M=5 low-NIS ticks → `RiderMarkerOverlay` green | Tasks 0.1, 1.2 |
| 5. "IMU dead-reckoning held the real position; NIS caught the jump" | `demo()` runnable demonstrates this offline; live demo follows same path | Task 5.2 |

**Timing risk (§7):** "spoof needs to be visibly detected within ~3s." With tick=1 Hz and N=3, worst case is 3 ticks = 3s. If demo feels slow, option: temporarily lower N to 2 for the demo run (document as demo-only, restore N=3 for submission). **Undecided** — decide after rehearsal.