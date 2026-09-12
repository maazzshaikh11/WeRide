# Phase 5 Implementation Plan — Mock Producer Completion & Demo Tooling

## 1. Phase Objective

Make the mock location producer useful for the spoof demo (spec §10) and add the ponytail `demo()` runnable (spec §7). This means: (a) add a method to inject a GPS spoof jump into the mock, and (b) create a Node-runnable script that wires mock GPS/IMU data through the real EKF so the spoof is detected by NIS, not faked by a hardcoded flag.

---

## 2. Source-of-Truth Requirements (with file + section/line citations)

| # | Requirement | Source | Citation |
|---|---|---|---|
| R1 | Add `injectSpoof(deltaLat, deltaLng)` to `MockLocationProducer` — next tick emits the jumped position. | `phase5_tasks.md` Task 5.1 lines 8–14 | |
| R2 | Calling `injectSpoof(0.01, 0.01)` causes the consuming EKF to flag within N ticks. | `phase5_tasks.md` Task 5.1 line 14 | |
| R3 | Mock should act as a synthetic GPS+IMU source feeding the real EKF, so spoof is detected by NIS, not faked. | `phase5_tasks.md` Task 5.2 lines 16–21 | |
| R4 | `MockLocationProducer` gains `asSensorSource()` returning a fake `SensorStream` interface. | `phase5_tasks.md` Task 5.2 line 22 | |
| R5 | Create `modules/tracking/src/demo.ts` — a runnable that runs EKF on mock polyline, injects spoof at tick 50, prints state + NIS + flag each tick. | `phase5_tasks.md` Task 5.2 lines 22–24 | |
| R6 | `npx ts-node modules/tracking/src/demo.ts` prints a table showing NIS spike at spoof tick. | `phase5_tasks.md` Task 5.2 line 25 | |
| R7 | Spec §7 ponytail: "prints a sample EKF run with and without a spoof injection." | `Person_A_Tracking_AntiSpoofing.md` §7 line 156; `WeRide_Project_Spec.md` §7 (referenced indirectly via ponytail rule) | |
| R8 | Spec §10 demo step 2: "Use a GPS-spoofing app to teleport marker 1km sideways." | `Person_A_Tracking_AntiSpoofing.md` §10 lines 200–204; `WeRide_Project_Spec.md` §12 line 333 | |
| R9 | Spec §3.5: spoof_flag=true after N=3 consecutive NIS > threshold; IMU dead-reckoning takes over; GPS rejected. Flag clears after M=5 consecutive NIS < threshold. | `Person_A_Tracking_AntiSpoofing.md` §3.5 lines 66–67 | |
| R10 | NIS threshold: 5.99 (chi-squared(2) 95th percentile), named constant. | `Person_A_Tracking_AntiSpoofing.md` §3.4 line 63; `modules/tracking/src/ekf.ts` lines 27–28 | |

---

## 3. Current Repository State

### 3.1 Components that exist and are reusable (Phase 0–4)

| Component | File | Status | Reusable for Phase 5? |
|---|---|---|---|
| `Ekf` class | `modules/tracking/src/ekf.ts` | Phase 1 complete. Full 4-state EKF with Jacobian F, full S, Joseph-form P update, NIS, SpoofDetector composed internally. | **Yes** — demo constructs an `Ekf` instance directly. |
| `SpoofDetector` class | `modules/tracking/src/spoofDetector.ts` | Phase 0 complete. Standalone state machine with `update(nis)`, `isFlagged`. | **Yes** — composed inside `Ekf`; also independently testable. |
| `MockLocationProducer` class | `modules/tracking/src/mockLocationProducer.ts` | Phase 0 complete. Walks polyline at 1 Hz, computes heading, uses `HlcSource` for timestamps, emits `VerifiedLocationPayload` via publisher. **Hardcoded `spoofFlag: false`, `nisScore: 1.0`**. | **Yes** — base class for `injectSpoof()` and `asSensorSource()`. |
| `VerifiedLocationPayload` type | `modules/tracking/src/locationPublisher.ts:7–16` | CamelCase internal type with all 10 fields. | **Yes** — demo prints this shape. |
| `HlcSource` interface | `modules/tracking/src/mockLocationProducer.ts:14–16` | `{ now(): string }` — lightweight interface. | **Yes** — demo uses a trivial `HlcSource` implementation (`Date.now()` + counter). |
| `HLC` class | `modules/hazard-sos/src/hlc/hlc.ts` | Real HLC with `now()`, `receive()`, `compare()`, `toState()`/`fromState()`. | **Yes** — demo can use `HLC.fresh()` directly. No MMKV dependency in Node. |
| `SensorStream` | `modules/tracking/src/sensorStream.ts` | Ties to React Native APIs. | **No** — demo runs in Node.js. Need synthetic alternative. |
| `TrackingService` | `modules/tracking/src/trackingService.ts` | Wires sensors→ekf→publisher with RN dependencies. | **No** — demo wires manually. |
| `LocationPublisher` | `modules/tracking/src/locationPublisher.ts` | Socket.io + Firestore dependencies. | **No** — demo uses console logging or no-op. |
| `hlcStore` | `modules/tracking/src/hlcStore.ts` | MMKV-backed persistence. | **No** — demo uses in-memory `HLC.fresh()`. |
| `EkfParams` type | `modules/tracking/src/ekf.ts:32–42` | Constructor params including `lat`, `lng`, `speed`, `heading`, `nisThreshold`, `spoofTriggerTicks`, `spoofRecoveryTicks`, `q`, `r`. | **Yes** — demo configures EKF with these. |
| `NIS_THRESHOLD_CHISQ_95`, `NIS_DOF`, `METERS_PER_DEGREE_LAT` | `modules/tracking/src/ekf.ts:26–28` | Named constants. | **Yes** — demo references these. |
| Phase 4 marker-state system | `app/src/screens/map/overlays/riderMarkerState.ts` | `getMarkerState`, `isValidLocation`, `extractHlcPhysical`. | **No** — demo runs in Node, not RN. |
| Phase 4 ridersStore | `app/src/store/ridersStore.ts` | Zustand store for Socket events. | **No** — demo runs in Node, not RN. |

### 3.2 Components that need creation for Phase 5

| Component | File | What's Needed |
|---|---|---|
| `injectSpoof(deltaLat, deltaLng)` method | `modules/tracking/src/mockLocationProducer.ts` | New method on `MockLocationProducer`. Adds a one-shot offset to the next emitted position. |
| `asSensorSource()` method | `modules/tracking/src/mockLocationProducer.ts` | New method returning an object that can feed the real EKF (GPS callbacks + IMU sample popping) without React Native. |
| `demo.ts` runnable | `modules/tracking/src/demo.ts` (new) | Node-runnable script: constructs EKF, wires mock as sensor source, runs ticks, injects spoof at tick 50, prints state table. |
| Demo output formatting | `modules/tracking/src/demo.ts` | Console table with tick, lat, lng, speed, heading, NIS, spoofFlag columns. |

### 3.3 Key design decisions

- **Task 5.1 vs 5.2 independence:** `injectSpoof()` (Task 5.1) is useful on its own — it can be used with the existing publisher-based mock for the live app demo (teleport a marker). `asSensorSource()` (Task 5.2) is for the offline EKF demo. They are complementary but independent. The spec says "or let the real EKF run on the mock's GPS output — see 5.2" for the spoof flag computation, meaning Task 5.2 feeds the EKF properly.
- **Spoof detection in Task 5.1:** The current mock always emits `spoofFlag: false`. Task 5.1's `injectSpoof()` does NOT set `spoofFlag: true` directly — it offsets the position so a downstream EKF (or the mock's own publisher) sees a jump. However, when the mock runs **without** the EKF (publisher mode), there is no NIS computation. The task spec says "spoof_flag computed (or let the real EKF run on the mock's GPS output — see 5.2)." This means: in publisher-only mode (Task 5.1), `injectSpoof()` offsets the position but `spoofFlag` remains false (the mock has no NIS). In EKF mode (Task 5.2), the real EKF detects the NIS spike and the published `spoofFlag` comes from `Ekf.spoofFlag`.
- **HLC in demo:** The demo runs in Node.js. `HLC.fresh()` works without MMKV (MMKV is only needed for persistence across app restarts). `HLC` uses `Date.now()` as default clock, which works in Node.
- **`VerifiedLocationPayload` vs EKF output:** In the demo, the EKF produces `(lat, lng, speed, heading, spoofFlag, nisScore, accuracyM)`. These map directly to `VerifiedLocationPayload` fields. The demo will construct `VerifiedLocationPayload` from EKF state for printing.

---

## 4. Task Breakdown

### Task 5.1 — Spoof injection mode in MockLocationProducer

- **Objective:** Add `injectSpoof(deltaLat, deltaLng)` to `MockLocationProducer` that offsets the next tick's emitted position, creating a GPS jump for spoof demonstration.
- **Source-of-truth citation:** `phase5_tasks.md` Task 5.1 lines 7–14.
- **Current state:** `MockLocationProducer` (99 lines) always emits `spoofFlag: false`, `nisScore: 1.0`. No spoof injection mechanism exists. The mock walks a polyline at 1 Hz and publishes via `LocationPublisher`.
- **Required changes:**

  1. Add private state fields to `MockLocationProducer`:
     - `_spoofOffsetLat: number = 0` — one-shot latitude offset applied to the next tick's position.
     - `_spoofOffsetLng: number = 0` — one-shot longitude offset applied to the next tick's position.

  2. Add `injectSpoof(deltaLat: number, deltaLng: number): void` method:
     - Sets `_spoofOffsetLat = deltaLat` and `_spoofOffsetLng = deltaLng`.
     - The offset is applied **once** on the next tick and then cleared to zero.
     - This creates a sudden position jump of `(deltaLat, deltaLng)` degrees — approximately `(deltaLat * 111320, deltaLng * 111320 * cos(lat))` meters at the current latitude.

  3. Modify the `setInterval` callback in `start()`:
     - After computing `currentPoint` and `nextPoint`, apply the spoof offset:
       ```
       lat: currentPoint[0] + this._spoofOffsetLat,
       lng: currentPoint[1] + this._spoofOffsetLng,
       ```
     - Then clear the spoof offset:
       ```
       this._spoofOffsetLat = 0;
       this._spoofOffsetLng = 0;
       ```
     - The offset is applied to the **current point** (the point the mock is walking), not the next point. This means the next tick emits the jumped position, and subsequent ticks resume the normal polyline walk from where it left off.

  4. `spoofFlag` in the published payload remains `false` for now (Task 5.1). The actual `spoof_flag` detection comes from the EKF (Task 5.2). If the mock feeds a real EKF (via Task 5.2's `asSensorSource()`), the EKF's `spoofFlag` property will flip to `true` after N consecutive high-NIS ticks. The mock itself does not set `spoofFlag`.

  5. `nisScore` in the published payload remains `1.0` (hardcoded) in publisher-only mode. In EKF mode (Task 5.2), the EKF's `nisScore` replaces this.

  6. **Edge case:** If `injectSpoof` is called multiple times before a tick, the last call wins (offset is overwritten, not accumulated). This is intentional — a single position jump is the demo requirement.

- **Files:**
  - **Modify:** `modules/tracking/src/mockLocationProducer.ts` — add `_spoofOffsetLat`, `_spoofOffsetLng` fields, `injectSpoof()` method, apply offset in tick callback.
  - **Modify:** `modules/tracking/src/index.ts` — no change needed (`MockLocationProducer` is already exported).
- **Dependencies:** None. `injectSpoof()` is self-contained within the existing class.
- **Tests:**
  - **Happy path:** Create mock with polyline, call `injectSpoof(0.01, 0.01)`, next tick's position is offset by exactly `(0.01, 0.01)`.
  - **Offset clears after one tick:** After spoof tick, the following tick resumes the normal polyline position (no residual offset).
  - **Multiple calls before tick:** Last call wins; offset is `(0.02, 0.02)` if called twice with `(0.01, 0.01)` then `(0.02, 0.02)`.
  - **No spoof injection:** Mock emits normal polyline positions when `injectSpoof` is never called.
  - **Negative offset:** `injectSpoof(-0.01, -0.01)` offsets position southwest.
  - **Zero offset:** `injectSpoof(0, 0)` has no effect on position.
  - **Calling `injectSpoof` before `start()`:** Offset is stored and applied on the first tick after `start()`.
  - All tests are pure JS (no RN, no device) — **automated**.
- **Definition of Done:** `injectSpoof(deltaLat, deltaLng)` causes the next emitted position to jump by `(deltaLat, deltaLng)`, then resume normal polyline. `spoofFlag` remains `false` in the mock's own payload. Existing mock tests pass without modification.

---

### Task 5.2 — Demo mode: mock feeds real EKF

- **Objective:** Create a `demo.ts` runnable that wires `MockLocationProducer`'s polyline as a synthetic GPS+IMU source through the real `Ekf`, so NIS spikes and spoof detection happen naturally. Also add `asSensorSource()` to `MockLocationProducer` to expose the mock's data in a format the EKF can consume.
- **Source-of-truth citation:** `phase5_tasks.md` Task 5.2 lines 16–25; `Person_A_Tracking_AntiSpoofing.md` §7 line 156.
- **Current state:** `Ekf` is fully implemented (Phase 1). `MockLocationProducer` emits `VerifiedLocationPayload` via a `LocationPublisher` — it does not expose a sensor-source interface for feeding the EKF directly. No `demo.ts` exists.
- **Required changes:**

  1. **Add `asSensorSource()` method to `MockLocationProducer`:**

     Returns an object that provides:
     - `onGpsFix: (callback: (lat: number, lng: number) => void) => void` — registers a callback that fires each tick with the mock's current polyline position.
     - `popImuSample(): { accelForward: number; headingRate: number } | null` — returns the IMU data derived from the current mock state (synthetic heading rate and acceleration).

     Implementation:
     - The mock already computes `heading` (bearing) at each tick. The heading rate between ticks can be derived from consecutive heading values: `headingRate = (heading_current - heading_previous) / dt` (converted to rad/s for the EKF's `predict` call).
     - `accelForward` (forward acceleration) can be derived from speed changes: `accel = (speed_next - speed_current) / dt`. Since the mock uses constant speed, this is 0 for normal ticks. During spoof injection, the position jump produces a large NIS spike even with `accelForward = 0` because the GPS position is far from the EKF's predicted position.
     - The method does NOT use `LocationPublisher` — it replaces the publisher-based tick loop with a sensor-source pattern. The caller (demo) drives the tick loop externally.

  2. **Create `modules/tracking/src/demo.ts`:**

     A Node-runnable script that:
     - Constructs a `MockLocationProducer` with a sample polyline (e.g., a square or figure-8 in San Francisco: `[[37.7749, -122.4194], [37.7759, -122.4184], ...]`).
     - Constructs an `Ekf` with initial position at the first polyline point.
     - Uses `HLC.fresh()` for timestamps (no MMKV — pure in-memory).
     - Runs a tick loop (e.g., 100 ticks at 1 Hz):
       - Each tick:
         1. Call `ekf.predict(dt=1, accelForward, headingRate)` with IMU data from the mock.
         2. Call `ekf.update(lat, lng)` with the mock's current GPS position.
         3. Print a row: `tick | lat | lng | speed | heading | NIS | spoofFlag`.
       - At tick 50, call `mock.injectSpoof(0.01, 0.01)` (≈1.1 km east, 1.1 km north at SF latitude).
     - After the loop, print a summary: spoof flag triggered at tick X, recovered at tick Y.

     Key design:
     - The demo **does not use `LocationPublisher`** — it prints to console instead.
     - The demo **does not use `SensorStream`** (RN dependency) — it uses `asSensorSource()` for synthetic data.
     - The demo **does not use `TrackingService`** (RN dependency) — it wires the EKF tick loop manually.
     - The demo **does not use `hlcStore`** (MMKV dependency) — it uses `HLC.fresh()` in memory.
     - The demo **does not use `react-native-dotenv`** — no RN dependencies at all.
     - The demo must be runnable via `npx ts-node modules/tracking/src/demo.ts`.

  3. **`asSensorSource()` interface design:**

     ```typescript
     interface MockSensorSource {
       /** Register callback for GPS positions from the mock polyline. */
       onPositionUpdate(callback: (lat: number, lng: number) => void): void;
       /** Get IMU-derived data for the current tick. */
       getImuSample(): { accelForward: number; headingRateDegPerSec: number };
       /** Advance the mock by one tick. Calls the registered onPositionUpdate callback. */
       tick(): void;
       /** Inject a spoof jump for the next tick. */
       injectSpoof(deltaLat: number, deltaLng: number): void;
     }
     ```

     This is a new interface, not the same as `SensorDataCallbacks` from `SensorStream` (which is RN-dependent). The demo uses `MockSensorSource`, not `SensorStream`.

  4. **Demo tick loop wiring:**

     ```typescript
     // Pseudocode for demo.ts:
     const ekf = new Ekf({ lat: polyline[0][0], lng: polyline[0][1], speed: 8.0, heading: 0 });
     const mock = new MockLocationProducer({ polyline, hlc: HLC.fresh() });
     const source = mock.asSensorSource();

     for (let tick = 0; tick < 100; tick++) {
       if (tick === 50) source.injectSpoof(0.01, 0.01);
       source.tick();
       const imu = source.getImuSample();
       ekf.predict(1, imu.accelForward, imu.headingRateDegPerSec);
       const pos = source.currentPosition(); // { lat, lng }
       const nis = ekf.update(pos.lat, pos.lng);
       console.log(`${tick} | ${ekf.lat.toFixed(6)} | ${ekf.lng.toFixed(6)} | ${ekf.speed.toFixed(2)} | ${ekf.heading.toFixed(1)} | ${nis.toFixed(2)} | ${ekf.spoofFlag}`);
     }
     ```

  5. **`injectSpoof()` and `asSensorSource()` are independent:** `asSensorSource()` can be used without `injectSpoof()` (normal EKF run). `injectSpoof()` can also be used in publisher mode (Task 5.1). The demo uses both together.

- **Files:**
  - **Modify:** `modules/tracking/src/mockLocationProducer.ts` — add `asSensorSource()` method, `MockSensorSource` interface, `_headingRateDegPerSec` state, `_accelForward` state.
  - **Create:** `modules/tracking/src/demo.ts` — Node-runnable script.
  - **Create:** `modules/tracking/test/demo.test.ts` — tests for `asSensorSource()` and `injectSpoof()` integration with EKF.
- **Dependencies:** Task 5.1 (injectSpoof method), Phase 1 (EKF complete), Phase 0 (HLC integration).
- **Tests:**
  - **asSensorSource happy path:** Create mock with polyline, get sensor source, call `tick()` 5 times, verify positions advance along polyline and `getImuSample()` returns reasonable values.
  - **asSensorSource + EKF integration:** Wire mock through EKF, run 100 ticks without spoof, verify EKF state tracks polyline and NIS stays low (mean ≈ 2).
  - **Spoof detection via EKF:** Run demo loop, inject spoof at tick 50, verify `ekf.spoofFlag` flips to `true` within 3 ticks of the jump, and `ekf.lat/lng` stays near the pre-jump position (IMU dead-reckoning holds).
  - **Spoof recovery via EKF:** After spoof, continue ticks with normal positions, verify `ekf.spoofFlag` flips back to `false` within 5 ticks of NIS returning below threshold.
  - **Demo runnable output:** `demo.ts` prints a table with columns: tick, lat, lng, speed, heading, NIS, spoofFlag. NIS spikes at spoof tick. This test can check stdout capture or just verify the demo doesn't crash.
  - All tests are pure JS — **automated** (no RN device needed).
- **Definition of Done:** `npx ts-node modules/tracking/src/demo.ts` prints a table showing EKF state at each tick, with NIS spike at the spoof injection tick. `ekf.spoofFlag` flips to `true` within N=3 ticks and recovers within M=5 ticks.

---

## 5. Cross-Person Dependencies

| Dependency | Owner | What Phase 5 Needs | Status |
|---|---|---|---|
| `HLC` class | Person B | `HLC.fresh()` for timestamps in demo. | Available — `modules/hazard-sos/src/hlc/hlc.ts`. Works in Node.js (no RN dependency). |
| `verified_location` contract | Person A (self) | Field shape for `VerifiedLocationPayload`. | Frozen — `contracts/verified_location.json`. |
| `Ekf` class | Person A (self) | Full EKF for demo. | Available — Phase 1 complete. |
| `SpoofDetector` | Person A (self) | Spoof flag lifecycle. | Available — Phase 0 complete. Composed inside `Ekf`. |
| `SensorStream` | Person A (self) | Real RN sensor source — NOT used in demo. | Available but RN-dependent. Demo uses `MockSensorSource` instead. |
| `LocationPublisher` | Person A (self) | Real Socket/Firestore publisher — NOT used in demo. | Available but RN-dependent. Demo uses console output instead. |

No cross-person dependencies (Person B's `HLC` is the only external dependency, and it works in Node.js).

---

## 6. Frozen Phase 0–4 Contracts

The following are frozen and must NOT be modified in Phase 5:

1. **`contracts/verified_location.json`** — 10 required fields, transport annotation. No changes.
2. **`VerifiedLocationPayload`** (`modules/tracking/src/locationPublisher.ts`) — Internal camelCase type. No changes to field names or types.
3. **`Ekf` public interface** — Constructor params, `predict()`, `update()`, getters (`lat`, `lng`, `speed`, `heading`, `spoofFlag`, `nisScore`, `accuracyM`), `SpoofDetector` composition. No changes.
4. **`SpoofDetector`** — `update(nis)`, `isFlagged`, threshold/trigger/recovery params. No changes.
5. **`HLC` class** (`modules/hazard-sos/src/hlc/hlc.ts`) — `now()`, `fresh()`, `physical` getter, `toString()`. No changes. `HLC.parse()` remains private.
6. **`HlcSource` interface** (`modules/tracking/src/mockLocationProducer.ts`) — `{ now(): string }`. No changes.
7. **Phase 4 marker-state system** (`app/src/screens/map/overlays/riderMarkerState.ts`) — `getMarkerState`, `isValidLocation`, `extractHlcPhysical`, precedence rules. No changes.
8. **Phase 4 ridersStore** (`app/src/store/ridersStore.ts`) — Zustand store API. No changes.
9. **Phase 4 `verifiedLocationFromJson`** (`app/src/models/verifiedLocation.ts`) — Parser. No changes.
10. **`NIS_DOF`, `NIS_THRESHOLD_CHISQ_95`, `METERS_PER_DEGREE_LAT`** named constants in `ekf.ts`. No changes.
11. **`MockLocationProducer` constructor params** — `publisher`, `polyline`, `hlc`, `intervalMs`, `speedMps`. No changes to existing params (new method additions only).

---

## 7. Blockers

1. **None identified.** Both tasks are self-contained within Person A's module. No cross-person blocker. The `Ekf` is complete (Phase 1), `HLC` works in Node.js, and the mock is already the right base class.

---

## 8. Ambiguities Requiring Decisions

### 8.1 — `spoofFlag` in mock publisher mode (Task 5.1)

**Ambiguity:** Task 5.1 says "`injectSpoof(deltaLat, deltaLng)` — next tick emits the jumped position with `spoof_flag` computed (or let the real EKF run on the mock's GPS output — see 5.2)."

**Two reasonable interpretations:**
- **(A)** In publisher-only mode, `injectSpoof` only offsets the position. `spoofFlag` remains `false`. The mock has no NIS computation — it cannot set `spoofFlag` to `true` on its own. The demo script (Task 5.2) is where `spoofFlag` flips via the real EKF.
- **(B)** In publisher-only mode, `injectSpoof` sets `spoofFlag: true` on the spoofed tick(s), as a hardcoded flag that downstream consumers (ridersStore, UI) can use to show a red marker.

**Decision:** Interpretation **(A)**. The spec says "or let the real EKF run on the mock's GPS output — see 5.2", which implies the EKF is the source of `spoofFlag`, not the mock. In publisher-only mode (without EKF), there is no NIS computation, so `spoofFlag` stays `false`. In EKF mode (Task 5.2), `spoofFlag` comes from `Ekf.spoofFlag`. This is consistent with the spec §3.5: spoof detection is the EKF's responsibility, not the mock's.

### 8.2 — `asSensorSource()` tick loop control

**Ambiguity:** Should `asSensorSource()` use the same `setInterval` pattern as `start()`, or should it be externally driven (caller calls `tick()` each iteration)?

**Decision:** Externally driven (`tick()` method). The demo needs deterministic control over when each tick happens (to inject spoof at exactly tick 50). `setInterval` is non-deterministic and hard to test. The `tick()` method makes the demo loop a simple `for` loop, which is both testable and printable.

### 8.3 — IMU data derivation in `asSensorSource()`

**Ambiguity:** The mock walks a polyline at constant speed. Between consecutive points, `accelForward = 0` and `headingRate = 0` (straight-line segments). This means the EKF's `predict` step has no IMU acceleration to work with — it just propagates at constant speed and heading. Is this sufficient for the demo?

**Decision:** Yes. The demo's purpose is to show that NIS spikes when the GPS position jumps (spoof), and that the EKF's spoof detection catches it. Constant-speed straight-line propagation is a valid test scenario. If needed, the demo can add small random noise to IMU data for realism, but this is not required by the spec.

---

## 9. Test Strategy

### Task 5.1 — `injectSpoof` tests

| # | Test Case | What It Asserts | Automated? |
|---|---|---|---|
| T5.1.1 | `injectSpoof(0.01, 0.01)` offsets next tick position by exactly (0.01, 0.01) | Position jump matches offset | Yes |
| T5.1.2 | Offset clears after one tick | Following tick resumes normal polyline position | Yes |
| T5.1.3 | Multiple `injectSpoof` calls before tick — last wins | Offset is (0.02, 0.02), not (0.03, 0.03) | Yes |
| T5.1.4 | No `injectSpoof` call — normal polyline walk | Positions match polyline points | Yes |
| T5.1.5 | `injectSpoof(-0.01, -0.01)` offsets southwest | Negative offset works | Yes |
| T5.1.6 | `injectSpoof(0, 0)` has no effect | Zero offset is no-op | Yes |
| T5.1.7 | `injectSpoof` called before `start()` | Offset stored and applied on first tick after `start()` | Yes |
| T5.1.8 | Existing mock tests still pass | No regression in heading, contract, HLC timestamp tests | Yes |

### Task 5.2 — `asSensorSource` + `demo.ts` tests

| # | Test Case | What It Asserts | Automated? |
|---|---|---|---|
| T5.2.1 | `asSensorSource()` returns a `MockSensorSource` with `tick()`, `getImuSample()`, `onPositionUpdate()`, `injectSpoof()` | Interface is correct | Yes |
| T5.2.2 | `tick()` advances mock along polyline, calls `onPositionUpdate` with correct positions | Positions match polyline | Yes |
| T5.2.3 | `getImuSample()` returns `accelForward` and `headingRateDegPerSec` | IMU data derived from consecutive polyline points | Yes |
| T5.2.4 | EKF tracks mock polyline without spoof — NIS stays low | Mean NIS over 100 ticks ≈ 2 (chi-squared sanity) | Yes |
| T5.2.5 | Spoof injection at tick 50 — `ekf.spoofFlag` flips `true` within 3 ticks | Spoof detection works via NIS | Yes |
| T5.2.6 | Spoof recovery — after spoof, `ekf.spoofFlag` flips `false` within 5 ticks of low NIS | Recovery works | Yes |
| T5.2.7 | `demo.ts` runs without crash | Script exits cleanly, prints table | Yes |
| T5.2.8 | Demo output shows NIS spike at spoof tick | NIS value at spoof tick > `NIS_THRESHOLD_CHISQ_95` (5.99) | Yes |

All tests are pure JS and fully automated. No RN device required. No manual validation steps.

---

## 10. Acceptance Criteria

| # | Criterion | Checkable? |
|---|---|---|
| AC1 | `MockLocationProducer.injectSpoof(deltaLat, deltaLng)` offsets next tick's position, then clears offset | Yes — T5.1.1, T5.1.2 |
| AC2 | `MockLocationProducer` existing tests pass unchanged | Yes — T5.1.8 |
| AC3 | `MockLocationProducer.asSensorSource()` returns a `MockSensorSource` with `tick()`, `getImuSample()`, `onPositionUpdate()`, `injectSpoof()` | Yes — T5.2.1 |
| AC4 | Demo runs via `npx ts-node modules/tracking/src/demo.ts` and prints a table with columns: tick, lat, lng, speed, heading, NIS, spoofFlag | Yes — T5.2.7 |
| AC5 | Demo shows NIS spike at spoof injection tick | Yes — T5.2.8 |
| AC6 | Demo shows `spoofFlag` flipping to `true` within 3 ticks of spoof, and back to `false` within 5 ticks of recovery | Yes — T5.2.5, T5.2.6 |
| AC7 | No Phase 0–4 code is modified (only additions to `MockLocationProducer` and new file `demo.ts`) | Yes — git diff review |
| AC8 | `npm run lint && npm run typecheck && npm test` green in `modules/tracking` | Yes — CI |

---

## 11. Explicit Scope Exclusions

The following are **NOT** in Phase 5 scope:

- Phase 6 (app-shell integration, `TrackingService` lifecycle wiring, Socket.io room joining, ride-data buffer for D)
- Phase 7 (tightened EKF NIS tests, `stale_marker_grey` widget test, `mock_producer_contract` test — Task 7.5 already depends on Task 0.3 and 0.4, which are done; but the full test suite belongs to Phase 7)
- Phase 8 (CPU/battery profiling)
- EKF algorithm changes (Phase 1 domain — already complete)
- SensorStream redesign (Phase 2 domain)
- HLC implementation changes (Person B's domain)
- Native Android/iOS configuration
- `RiderMarkerOverlay` or `ridersStore` changes (Phase 4 domain)
- Changes to `contracts/verified_location.json`
- Changes to `LocationPublisher` API
- Background location service (Phase 2)
- `react-native-background-geolocation` integration
- Rider display name resolution (Phase 6)
- Mapbox rendering (Phase 4)
- Any file in `app/` (demo is pure Node.js in `modules/tracking/src/`)

---

## 12. Source Document Gaps

| Gap | Source | Impact | Resolution |
|---|---|---|---|
| `asSensorSource()` interface not fully specified | `phase5_tasks.md` Task 5.2 line 22 says "add `asSensorSource()` returning a fake `SensorStream` interface" but doesn't specify the exact method signatures | Phase 5 must design the interface. | Defined in this plan as `MockSensorSource` (see §4 Task 5.2). Interface is derived from the existing `SensorDataCallbacks` and `ImuSample` patterns but simplified for Node.js. |
| Demo output format not specified | `phase5_tasks.md` Task 5.2 line 25 says "prints a table showing NIS spike at spoof tick" but doesn't specify column order or format | Low impact — any readable tabular format suffices. | Defined in this plan: tick, lat, lng, speed, heading, NIS, spoofFlag. |
| `spoof_flag` behavior in publisher-only mode | `phase5_tasks.md` Task 5.1 line 13 says "spoof_flag computed (or let the real EKF run on the mock's GPS output — see 5.2)" — ambiguous whether mock sets the flag | Two interpretations possible. | Resolved in §8.1: publisher-only mode keeps `spoofFlag: false`; EKF mode provides real `spoofFlag`. |

---

## 13. Confirmation: No Implementation Changes Made

No source code files were modified during the creation of this plan. Only the plan document `docs/P1Planning/implementation_plan_phase5.md` was created.

---

## 14. Confirmation: No Git State Modified

No `git add`, `git commit`, `git push`, `git reset`, `git checkout`, or `git restore` commands were executed. Working tree remains unchanged except for the new plan file.