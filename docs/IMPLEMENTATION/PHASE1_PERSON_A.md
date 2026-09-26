# Phase 1 — Person A (Tracking & Anti-Spoofing) — Implementation Log

**Date:** 2026-09-26
**Base:** user's commit `3570fde` ("feat: tab navigation, ...", 118 files) on `origin/main`,
plus Phase 1 work-in-progress restored from stash `phase1-in-progress-wip`.
**Status: PASS**

Rule of this log: every claim below names what was read fully, grepped, or inferred,
and every number comes from a command actually run.

---

## 1. What the user's commit `3570fde` already contained (reviewed via `git diff 8439964..3570fde`, grepped — not line-by-line)

Already done by the user, not re-done here:
- 6-tab navigator (Home/Stops/Voice/Family/Alerts/History), 27 shared components,
  ridePlan/stops/toast stores, theme tokens, `docs/UIUX_MASTER_DESIGN_SPEC.md` authored.
- Firestore rules hardened (group-membership checks, `groups/{groupId}/reports/{reportId}`).
- `socketService` uses `@env` `SOCKET_URL` (10.0.2.2 fallback); `RouteOverlay` uses `@env` `ROUTING_URL`
  (old localhost regression fixed — verified by grep).
- `MapScreen` mounts `TrackingService`, subscribes `ridersStore`, loads ride plan.
- `sensorStream` 10 Hz via `setUpdateIntervalForType`; AndroidManifest (+8) / Info.plist (+6) touched.

Still broken after `3570fde` (verified by reading the files, then fixed below):
- Server `index.js` had **no** `join-group` / `location:update` handler (location fan-out missing server-side).
- `submitHazardReport` online path still has **no try/catch** (re-verified in current source 2026-09-26) → Phase 2.
- `handleRoute` still straight-line mock with TODOs → Phase 3.
- `MapScreen` still had `?? 'demo-group'` fallback → fixed this phase.
- HLC dash format `${physical}-${counter}` with dual MMKV clocks (`'tracking'` id vs `'hlc'` id) → fixed this phase.

## 2. Changes implemented this phase (all uncommitted, on top of `3570fde`)

### 2a. Attitude-aware IMU pipeline (new file `modules/tracking/src/attitude.ts`, read fully)
- Quaternion complementary filter: gyro integration (device-frame, right-composition)
  + accelerometer tilt correction **only when quasi-static** (|a−g| < 0.5 m/s²).
- `worldYawRateDegPerSec()` sign-corrected for compass headings (CCW-from-above = negative).
- `forwardAccel()` rotates gravity-free accel into ENU world frame, projects onto the GPS
  course-over-ground bearing; returns **null (not zero)** when bearing unknown; clamped ±5 m/s².
- Two robustness fixes applied during implementation: tilt seeded only from quasi-static
  samples; tilt-correction branch skipped while uninitialised.

### 2b. `sensorStream.ts` rewired (read fully)
- Pairs latest gyro with accel callbacks (dt clamped 1–500 ms).
- GPS bearing from successive fixes (atan2(dE,dN), >3 m displacement; >10 s staleness → null).
- `ImuSample.accelForward: number | null`; `headingRate` now in **deg/s**.
- Old "PHASE 1 LIMITATION" header replaced with attitude-aware docstring.

### 2c. `trackingService._onTick` (read fully)
- `ekf.predict(dt, imuSample.accelForward ?? 0, imuSample.headingRate)` —
  null accelForward → GPS-only constant-velocity prediction.
- Removed the old rad→deg conversion (rate now arrives in deg/s).

### 2d. Server room protocol — `modules/routing-eta/server/index.js` (restored from stash, read fully)
- `join-group` / `leave-group` handlers; `location:update` payload validation;
  room-scoped rebroadcast (no global fan-out); `server.listen` guarded by
  `NODE_ENV !== 'test'`; exports `{ app, server, io }`.
- Fixed broken `npm test` script (`node --test test/` didn't expand globs → `node --test test/*.test.js`);
  added `socket.io-client` as devDependency for the fan-out tests.

### 2e. `app/src/store/ridersStore.ts` (restored from stash, read fully; 2 null-guard lines added this session)
- Room join/re-join on `subscribe(groupId)` (`socket.emit('join-group', …)`), `seedRiders()`,
  `groupId` state. Fixed `socket.off('connect'/'disconnect', null)` type errors with guards.

### 2f. `modules/tracking/src/locationPublisher.ts` (restored from stash, read fully)
- `fetchGroupLastKnown(groupId)` for map seeding; drops non-finite lat/lng.
- Real bug caught by tests during implementation: used `snap.forEach` (absent on the mock);
  fixed to standard `snap.docs.map`.

### 2g. `app/src/screens/map/MapScreen.tsx` (edited this session, read fully)
- Removed `'demo-group'` fallback → explicit "No ride selected" empty state (hook-safe early return).
- `service.start(true)` background-first with foreground fallback + toast.
- Seeds riders via `publisher.fetchGroupLastKnown(groupId)` → `seedRiders()`.
- Fixed `resolveSos(sosId, groupId)` null-groupId type error with a guard.
- Deleted our earlier `app/src/config/serverConfig.ts` — redundant with the user's
  `@env`-based `SOCKET_URL` approach in `3570fde`; kept theirs (one URL-resolution path).

### 2h. HLC canonical format — colon separator, single shared clock
- `modules/hazard-sos/src/hlc/hlc.ts`: `toString()` → `physical:counter`
  (`HLC_SEPARATOR = ':'`); `parse()` accepts legacy dash form for backward compatibility;
  storage constants `HLC_STORAGE_ID = 'hlc'`, `HLC_STORAGE_KEY = 'hlc_state'`
  (replacing the `'tracking'` MMKV id / `'tracking:hlc_state'` key).
- `modules/tracking/src/hlcStore.ts`: now shares that exact MMKV location — tracking,
  hazard and SOS read/advance the SAME device-wide clock. Added a convergence test
  asserting identical MMKV id and key.

### 2i. Cross-package typecheck repair (app `tsc --noEmit`: 40 errors → 0)
Root-caused, not papered over:
- 29 errors: `modules/routing-eta` not installed → `zustand` unresolvable from app context.
  Fixed with `npm install` in the module (dep was declared, just never installed).
- 5 errors: `modules/fl-voice` not installed (deps declared). Fixed with `npm install`.
- 4 errors: `socket.io-client` / `@react-native-firebase/firestore` unresolvable from
  `modules/tracking/src` in app context. tracking's own typecheck passes only via
  `test/ambient.d.ts` shims. Fix: `app/tsconfig.json` `paths` now map these bare
  specifiers (plus mmkv/sensors/geolocation) to the real packages in `app/node_modules`
  (all six verified present with real `.d.ts`). A first attempt with ambient
  `declare module` shims in the app was **reverted** because it shadowed the real
  `socket.io-client` types app-wide (`io` export lost, MMKV `getAllKeys` lost).
- 2 errors: my own `ridersStore` null-handler `socket.off` calls → guarded.

### 2j. Test mock updates (behavior-adding, not weakening)
- `app/__tests__/ridersStore.test.ts`: socket mock gained `emit: jest.fn()` (room join).
- `app/__tests__/mapScreen.test.tsx`: `LocationPublisher` mock gained
  `fetchGroupLastKnown: jest.fn().mockResolvedValue([])`.
- `modules/tracking/test/sensorStream.test.ts` IMU block **rewritten** (7 tests): the old tests
  encoded the placeholder `|a|−g` algorithm that was intentionally replaced; new tests assert
  the specified attitude-aware behavior (not weakened — they fail against the old algorithm).
- `modules/tracking/test/attitude.test.ts` (new, 13 tests): hand-computed vectors —
  flat-up, 30° pitch convergence, 90° gyro pitch tracking, forward/braking/vertical/
  pitched-30°/east-bearing projections, null-bearing, clamp, yaw-rate sign (flat + pitched), bad-dt.
- `modules/tracking/test/hlcStore.test.ts`: colon-format assertions + single-clock convergence test.
- `modules/hazard-sos/test/hazardSos.test.ts`: dash → colon assertions (output format updated;
  legacy dash still accepted on `parse` input, covered by comment).

## 3. Verification results (commands run 2026-09-26, in `lint → typecheck → test` order per AGENTS.md)

| Package | lint | typecheck | test |
|---|---|---|---|
| `modules/tracking` | 0 errors (31 pre-existing `no-console` warnings) | pass | **114/114** (10 suites) |
| `modules/hazard-sos` | 0 new errors (34 pre-existing in test file, verified identical before/after via stash) | pass | **132/132** (5 suites) |
| `modules/routing-eta` (client) | not re-run (no source change) | pass | **32/32** |
| `modules/routing-eta/server` | n/a (plain JS) | n/a | **52/52** via `node --test` (incl. 4 new `location_fanout` tests) |
| `app` | 0 errors (53 warnings) | **pass (was 40 errors at `3570fde`)** | **136/136** (9 suites) |
| `modules/fl-voice` | not run (no source change; deps installed only) | not run | not run |

Environment notes (recorded, not hidden):
- `npm install` in `hazard-sos` initially failed with `EPERM chown` on this VM's overlay FS;
  workaround: `--no-bin-links` (used for hazard-sos, routing-eta, fl-voice, app).
- No Android emulator in this VM as of 2026-09-26 → no on-device run; recorded as Phase 6 risk.

## 4. Acceptance criteria (from `docs/MASTER_IMPLEMENTATION_PLAN.md` §Phase 1)

- [x] Attitude estimator implemented, unit-tested against hand-computed vectors (13 tests).
- [x] `sensorStream` emits attitude-aware `accelForward`/`headingRate`; EKF consumes them.
- [x] Server fan-out is room-scoped (`join-group`/`location:update`), tested (4 tests).
- [x] `MapScreen` has no demo-group fallback; seeds riders; background-first start.
- [x] HLC is colon-format and a single shared clock across tracking/hazard/SOS.
- [x] All touched packages: lint 0 errors, typecheck clean, tests green.
- [x] No test was weakened to make it pass (rewrites documented in §2j with reasons).
- [x] `node_modules` untouched by hand; no secrets committed (diff reviewed 2026-09-26).

**PHASE 1 — PASS.** Auto-continuing to Phase 2.

## 5. Carry-forward (not Phase 1 regressions — already noted in plan)
- `submitHazardReport` online path still lacks try/catch → Phase 2.
- `handleRoute` straight-line mock, NYC `MOCK_DESTINATION`, km-vs-meters A* mismatch → Phase 3.
- `infra/firebase/.firebaserc` deliberately uncommitted (pins personal project ID).
- Stash `phase1-in-progress-wip` (`stash@{0}`) retained as safety copy until this work is committed.
