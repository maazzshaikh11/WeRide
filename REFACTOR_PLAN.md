# WeRide Refactoring Plan

**Author:** Senior Staff Engineer refactoring assessment
**Date:** 2026-09-25
**Scope:** Code-quality refactoring across all packages. **Zero behavior changes, zero new features, zero contract/API changes.**

> **Note:** This plan was written to `.opencode/plans/REFACTOR_PLAN.md` because permission rules block writing to the repo root. The user requested it at `REFACTOR_PLAN.md` (repo root). Please copy/symlink it there when ready to implement, or adjust permissions.

---

## Table of Contents

1. [Behavior Baseline](#1-behavior-baseline)
2. [Debt Inventory (evidence)](#2-debt-inventory-evidence)
3. [Quick Wins (safe, mechanical)](#3-quick-wins-safe-mechanical)
4. [Structural Refactors](#4-structural-refactors)
5. [Optional / Later](#5-optional--later)
6. [Execution Order](#6-execution-order)
7. [Risk Register](#7-risk-register)
8. [Verification Gates (summary)](#8-verification-gates-summary)

---

## 1. Behavior Baseline

> Nothing in Phase 2 may alter any of the behaviors below. Every refactor item must be verified against this baseline.

### 1.1 App (React Native shell)

- **Entry flow:** `index.js` → `App.tsx` (initStorage + initFirebase) → `RootStack` (Login → Groups → MainTabNavigator with 6 tabs: Home/Stops/Voice/Family/Alerts/History).
- **Live tracking:** `MapScreen` constructs `TrackingService` (EKF + sensors + publisher + HLC) on mount when userId/groupId valid; calls `start()` on mount, `stop()` on unmount; `loadHlc()` called once.
- **Rider markers:** Color-coded by marker state (verified=green, flagged/stale=red/grey) computed from `verified_location` payload fields (spoof_flag, timestamp_hlc freshness, NIS).
- **Hazard overlay:** Subscribes to `hazard_cluster` Firestore listener via `subscribeToHazardClusters`; renders polygon fill + symbol + marker info card; resolve-hazard calls `resolveHazard` and shows toast.
- **SOS overlay:** Trigger via `SosModal` (hold-to-trigger 2000ms guard per spec); writes via `triggerSos`; renders active SOS markers with animated pulse; resolve via `resolveSos`.
- **Route overlay:** `RoutingClient` calls `POST /route` to server; debounced recalculation (500ms); distance-gated origin recalc (100m threshold); route line drawn via GeoJSON; Google Maps deep link generation; "avoid hazards" toggle via module-level singleton `routeControls`.
- **Group list / create / join:** `GroupService` Firestore CRUD; create-ride modal; join by code; navigate to MainApp with groupId.
- **Voice screen:** `VoxClient` start/stop; mic permission request; avatar grid; VoxZone display.
- **FL status overlay:** Reads `fl_data` MMKV round log; displays badge.
- **Theme:** Shared `theme.ts` (colors, fonts, icon set, hazard color map, safety thresholds) — owned by Person C, not to be edited casually.
- **5 Zustand stores:** appStore, ridePlanStore, ridersStore, stopsStore, toastStore — each independent `create()`.

### 1.2 Tracking module (Person A)

- **EKF:** 4-state Extended Kalman Filter (lat, lng, speed, heading); analytical Jacobian with π/180 conversions; Joseph-form covariance update; NIS chi-squared(2) threshold 5.99; mat2x2Invert with regularization + `lastUpdateRejected` flag.
- **Anti-spoof:** SpoofDetector state machine — flags when N consecutive ticks exceed threshold (N=3); clears when M consecutive below (M=5). When flagged, GPS rejected, IMU dead-reckoning continues.
- **Sensor stream:** GPS (foreground Geolocation or background BackgroundGeolocation) + IMU (accelerometer/gyroscope at 10Hz); IMU downsampled via `popImuSample` (O(1) aggregation); accelForward = sqrt(x²+y²+z²)-9.81 clamped ±5 m/s².
- **Location publisher:** Socket.io `location:update` + Firestore throttled write; offline queue with retry on next tick.
- **TrackingService:** 1Hz tick loop; predict (rad/s→deg/s) → HLC now + persist → persist EKF → publish; concurrent start guard via `_startPromise`.
- **HLC store:** MMKV-persisted HLC state; `fresh()` factory loads from MMKV or creates new.
- **Mock producer:** Deterministic mock GPS/IMU for demos; `injectSpoof` for testing; `asSensorSource` adapter.

### 1.3 Hazard-SOS module (Person B)

- **DBSCAN:** Haversine-based; per-hazard-type clustering; eps=30m, minSamples=2; noise→singleton clusters; BFS expandCluster.
- **HLC:** Kulkarni HLC with MMKV persistence; `now()`/`receive()`/`parse()`/`compare()`; accepts both `-` and `:` separators in parse; emits `-` in toString.
- **CRDT OR-Set:** `adds: Map<tag, TaggedElement>`, `tombstones: Set<tag>`; add/remove/merge/getActive; idempotent on exact tag; dedupes by `sos_id` in getActive; MMKV persistence.
- **Local queue:** MMKV-backed FIFO; enqueue/dequeue/peek/updateRetry/size/clear; no retry cap (zero-data-loss invariant).
- **Sync worker:** NetInfo-driven; fires on offline→online transition only; syncHazardReports (Firestore write, dequeue on success, retry++ on failure); syncSosEvents (write + resolve without delete — preserves CRDT tombstone); mergeSosOnSync (7-step merge); `syncInProgress` guard; `previouslyConnected` first-event skip.
- **Hazard service:** submitHazardReport (online Firestore / offline enqueue); triggerClustering (fetch reports, clusterByType, match existing clusters by 50m centroid threshold, batch write); subscribeToHazardReports (onSnapshot + clustering on subsequent loads); subscribeToHazardClusters (filtered by group_id + status=active); resolveHazard (update status, no delete).
- **SOS service:** triggerSos (OR-Set add + persist FIRST, then network/enqueue with tag); resolveSos (OR-Set remove + persist, then Firestore update or enqueue sos_resolve); subscribeToSosEvents (initialMerge + onSnapshot with remote→OR-Set reconstruction); getLocalActiveSosEvents.
- **Mock services:** generateMockHazardCluster / generateMockSosEvent for demos.
- **UI components:** HazardReportButton, HazardReportSheet (spoof-flag alert, online/offline status), SosButton (2000ms hold guard, progress ring, no-op single tap).

### 1.4 Routing-ETA client (Person C)

- **RoutingClient:** HTTP `POST /route` via fetch; default baseUrl `http://localhost:3000`; `requestRoute` (immediate), `scheduleRecalculation` (debounced 500ms), `scheduleOriginRecalcIfMoved` (100m threshold).
- **Route store:** Zustand `useRouteStore` — route, avoidHazardTypes, isLoading, currentLocation, lastValidLocation, activeClusters + setters.
- **Deep link:** `googleMapsDeepLink(origin, destination)` → `https://www.google.com/maps/dir/?api=1&...&travelmode=driving`.
- **Route line:** `routeToGeoJsonLine` — swaps [lat,lng]→[lng,lat] for Mapbox.
- **GroupService:** Firestore groups/ CRUD (createGroup, getRidePlan, joinGroup, myGroups with onSnapshot).

### 1.5 Routing-ETA server (Node ESM)

- **Express server:** `POST /route` (handleRoute), `POST /fl/submit` + `GET /fl/global` (stubs), Socket.io `/vox` namespace (signaling relay). CORS wildcard (MVP).
- **A* pathfinding:** Haversine heuristic (admissible); MinHeap (array-sort based); gScore with `?? Infinity`.
- **Hazard penalties:** `applyHazardPenalties` — severity-weighted (accident 5.0 > oil_spill 4.0 > debris 3.0 > pothole 2.0 > other 1.0) × hazard_score × (1 - distance/500m); mutates graph in place AND returns it.
- **Safety score:** `routeSafetyScore` (astar.js) — `1 - totalExposure/maxExposure` clamped [0,1]; `calculateSafetyScore` (safety_score.js) — same formula; handler uses inline hardcoded `0.85` with `min(0.3, count*0.05)` penalty (mock).
- **ETA:** `extractEtaFeatures` (6 features: distance_km, turn_count, hour_of_day, day_of_week, hazard_count, avg_speed_limit); `predictEta` (async, calls Flask sidecar at 127.0.0.1:5000/predict with 2s AbortController timeout, falls back to heuristic).
- **HLC:** `generateHlcTimestamp` — `Date.now():counter` format, module-level `_counter`, `% 1000000`.
- **Contract validator:** `validateRouteResponse` — checks 6 fields of route_response.
- **Demo:** 5-stage deterministic rerouting demo (diamond graph, hazard injection, path-change assertion, exit 0/1).
- **VOX signaling:** Socket.io relay — join/sdp/ice/voice_active/disconnect events.
- **FL proxy:** Stubs returning received/global_weights_version.

### 1.6 FL-Voice module (Person D)

- **DpMasking:** L2-clip + Gaussian noise (Box-Muller); base64 encode/decode via `Buffer`.
- **FlClient:** fetchGlobal (GET /fl/global, zero-fill fallback), trainLocal (stub, zero delta), submit (POST /fl/submit), runRound (fetch→train→submit with hardcoded localLoss=0.0, sampleCount=0).
- **FlRoundLogger:** MMKV per-round storage; `latestRound` picks last key.
- **VoxClient:** start (getUserMedia, join socket, register handlers), _createPeer (RTCPeerConnection with STUN, MAX_PEERS=8), setVoiceActive (dedup + emit), stop (close peers, release stream). Signaling handlers are empty stubs.
- **VAD:** RMS energy + hold/release state machine; high-pass filter is TODO stub.
- **micPermission:** Android PermissionsAndroid.request(RECORD_AUDIO); iOS RTCAudioSession.requestRecordPermission.
- **UI:** PttButton (hold-to-talk), FlStatusIndicator, VoxIndicator (unwired), MusicWidget (stub).

### 1.7 Infra

- **Cloud Function:** `onSosCreate` — Firestore trigger on sos_events/{sosId} onCreate; fetches group members, FCM tokens; sendMulticast; skips sender.
- **Firestore rules:** Per-collection rules (users, groups, locations, reports, hazards, sos_events, routes, fl_rounds, legacy hazard_reports).
- **CI:** 6 per-package jobs (app, tracking, hazard-sos, routing-eta [+server], fl-voice, contracts); Node 20; lint→typecheck→test per job.
- **Contracts:** 7 JSON Schema files (verified_location, hazard_cluster, hazard_report, sos_event, route_contract, fl_model_update, vox_signal) — frozen, CI-validated via `python -m json.tool` loop.

---

## 2. Debt Inventory (evidence)

All findings below have exact `file:line` references from the Phase 1 analysis.

### 2.1 Committed cruft (should not be in git)

| # | File | Tracked? | Notes |
|---|------|----------|-------|
| C1 | `modules/hazard-sos/src/crdt/localQueue.ts.backup` | Yes | Dead backup of old class-based LocalQueue (36 lines) |
| C2 | `modules/hazard-sos/src/crdt/syncWorker.ts.backup` | Yes | Dead backup of old class-based SyncWorker (58 lines), stale TODO |
| C3 | `modules/hazard-sos/test_output.txt` | Yes | 47KB test log dump |
| C4 | `modules/hazard-sos/test_output2.txt` | Yes | 45KB test log dump |
| C5 | `modules/hazard-sos/test_result.txt` | Yes | 41KB test log dump |
| C6 | `modules/hazard-sos/test_result2.txt` | Yes | 39KB test log dump |
| C7 | `modules/hazard-sos/test_result3.txt` | Yes | 39KB test log dump |
| C8 | `app/env.d.ts` | Yes | Stale duplicate of `.env.d.ts` — only declares `MAPBOX_TOKEN`, missing `SOCKET_URL`/`ROUTING_URL`. tsconfig:12 points to `.env.d.ts` (the complete one), so `env.d.ts` is dead |
| C9 | `app/.index.js.swo` | Untracked (not gitignored) | Vim swap file — should be gitignored |
| C10 | `modules/hazard-sos/PHASE_4_COMPLETE.md` | Yes | Phase report in module dir (docs live in docs/) |
| C11 | `modules/hazard-sos/phase4_fix_report.md` | Yes | Phase report in module dir |
| C12 | `infra/firebase/.firebaserc` | Untracked (not gitignored) | Wrong project ID `aifashionrecommendation-c5e15` (leftover from unrelated project) |

### 2.2 Dead code / unused exports

| # | Location | What | Notes |
|---|----------|------|-------|
| D1 | `app/src/services/socketService.ts:36` | `sendSignal()` exported, never imported | SignalMenu emits directly via `getLocationSocket().emit()` |
| D2 | `app/src/services/socketService.ts:40` | `disconnectSockets()` exported, never called in app/src | Only mocked in tests |
| D3 | `app/src/services/localStorage.ts:20` | `getSosQueue()` exported, never imported in app/src | |
| D4 | `app/src/services/localStorage.ts:24` | `getHazardQueue()` exported, never imported in app/src | |
| D5 | `app/src/services/firebaseService.ts:10` | `firebaseFirestore` exported, never imported in app/src | |
| D6 | `app/src/hooks/useSocketStatus.ts` | Entire hook never imported | LivePill uses ridersStore `connected` instead |
| D7 | `app/src/hooks/useToast.ts` | Re-export module never imported | All consumers import directly from store/toastStore |
| D8 | `app/src/theme/typography.ts` | Entire module never imported | |
| D9 | `app/src/theme/colors.ts` | Re-export module never imported | |
| D10 | `app/src/theme/spacing.ts` | Re-export module never imported | |
| D11 | `app/src/components/NavFab.tsx` | Component never imported | MapScreen builds its own nav FAB inline |
| D12 | `app/src/utils/geoUtils.ts:18` | `straightLineMeters` alias never imported | |
| D13 | `app/src/screens/map/overlays/riderMarkerState.ts:122` | `getMarkerStateForMissing()` only used in tests | |
| D14 | `app/src/screens/map/MapScreen.tsx:404-414` | `fabSos`, `fabSosActive`, `fabSosText` styles unused | SOS FAB is `SosFab` component |
| D15 | `app/src/screens/map/overlays/SosOverlay.tsx:185-191` | `handleNavigate` useCallback never used | onPress calls onNavigate prop directly |
| D16 | `modules/tracking/src/ekf.ts:30` | `RAD_TO_DEG` constant never used | |
| D17 | `modules/tracking/src/ekf.ts:132-134` | `mat2x2Transpose` function never called | |
| D18 | `modules/tracking/src/ekf.ts:26` | `NIS_DOF` exported but never imported by any consumer | |
| D19 | `modules/tracking/src/mockLocationProducer.ts:49,51-52` | `_currentHeading`, `_prevHeading`, `_hasPrevHeading` fields never read | |
| D20 | `modules/hazard-sos/src/ui/hazardMarker.ts` | Entire file not exported from index.ts; has bug + unimplemented TODO | |
| D21 | `modules/hazard-sos/test/__mocks__/reactTestRendererMock.js` | 119-line stub returning null; real react-test-renderer is installed | 6 console.log debug statements |
| D22 | `modules/hazard-sos/test/__mocks__/mmkvMock.js` | Superseded by inline mocks in every test file | |
| D23 | `modules/routing-eta/src/group/groupService.ts:8` | `FirebaseFirestoreTypes` imported, never referenced | |
| D24 | `modules/routing-eta/server/demo.js:31` | `calculateHazardPenalty` imported, never used | |
| D25 | `modules/routing-eta/server/test/eta_model.test.js:11` | `handleRoute` imported, never used | |
| D26 | `modules/routing-eta/server/safety_score.js:135` | `haversineMeters` export unused | |
| D27 | `modules/routing-eta/server/hazard_penalty.js:153` | `haversineMeters` export unused | |
| D28 | `modules/routing-eta/server/test/route_response_contract.test.js:222` | `validateRouteResponse` exported from test file (unnecessary) | |
| D29 | `modules/fl-voice/src/ui/MusicWidget.tsx` | Entire component returns empty View; P2 stub | |

### 2.3 Duplicated code

| # | What | Locations | Intentional? |
|---|------|-----------|--------------|
| E1 | `initials()` helper (3 copies) | `app/src/components/AvatarStack.tsx:14-16`, `app/src/components/FamilyMemberCard.tsx:15-17`, `app/src/screens/map/overlays/RiderMarkerOverlay.tsx:20-22` | No — should be shared util |
| E2 | `haversineMeters` (4 copies across repo) | `app/src/utils/geoUtils.ts:6`, `modules/routing-eta/src/client/routingClient.ts:19-27`, `modules/routing-eta/server/astar.js:7-15`, `modules/routing-eta/server/safety_score.js:122-133`, `modules/routing-eta/server/hazard_penalty.js:140-151` | No — server has 3 copies alone. Comment in `hazard_penalty.js:138` says "re-defined here for clarity" |
| E3 | `getFirestore()` function (3 copies) | `modules/hazard-sos/src/crdt/syncWorker.ts:49-53`, `modules/hazard-sos/src/services/hazardService.ts:40-45`, `modules/hazard-sos/src/services/sosService.ts:43-48` | No — identical pattern |
| E4 | Remote SOS → OR-Set reconstruction (3 copies) | `modules/hazard-sos/src/crdt/syncWorker.ts:258-285`, `modules/hazard-sos/src/services/sosService.ts:217-239`, `modules/hazard-sos/src/services/sosService.ts:266-286` | No — near-identical blocks |
| E5 | HazardReport doc→object mapping (2 copies) | `modules/hazard-sos/src/services/hazardService.ts:130-142`, `:238-250` | No |
| E6 | `validateRouteResponse` (2 copies) | `modules/routing-eta/server/astar.js:119-172`, `modules/routing-eta/server/test/route_response_contract.test.js:14-68` | No — test has its own copy; if astar.js changes, test won't catch it |
| E7 | `applyHazardPenalties` (2 implementations) | `modules/routing-eta/server/astar.js:75-96`, `modules/routing-eta/server/hazard_penalty.js:104-134` | No — different mutation/return patterns |
| E8 | Route safety score (3 implementations) | `modules/routing-eta/server/astar.js:102-113`, `modules/routing-eta/server/safety_score.js:57-101`, `modules/routing-eta/server/astar.js:239-245` (handler inline) | No — three different formulas |
| E9 | `createDiamondGraph` (3 copies) | `modules/routing-eta/server/demo.js:99-126`, `benchmark_astar.js:23-50`, `benchmark_rerouting.js:30-57` | No |
| E10 | `pathDistance` / `pathToCoordinates` (2 copies) | `modules/routing-eta/server/road_graph.js:126-132,140-152`, `modules/routing-eta/server/demo.js:131-143,148-154` | No |
| E11 | Severity weights object (5 copies) | `modules/routing-eta/server/astar.js:76`, `hazard_penalty.js:33-39`, `safety_score.js:27-33`, `demo.js:64-70`, `benchmark_rerouting.js:80-86` | No |
| E12 | `HlcSource` interface (3 copies) | `modules/tracking/src/mockLocationProducer.ts:14`, `modules/tracking/src/trackingService.ts:29`, `modules/tracking/test/demo.test.ts:9` | No — identical shape |
| E13 | MMKV singleton pattern (2 copies) | `modules/tracking/src/ekfStore.ts:20-32`, `modules/tracking/src/hlcStore.ts:28-40` | No — each creates `new MMKV({ id: 'tracking' })` independently |
| E14 | `authFactory` in firebase mock (2 copies) | `modules/routing-eta/test/__mocks__/firebaseMock.js:54-56`, `modules/routing-eta/test/__mocks__/authMock.js:5-7` | No |
| E15 | Per-module test mocks (firebase, mmkv, sensors, geo, socket, webrtc) | Duplicated across all 4 TS modules | **YES — intentional per AGENTS.md**. Do NOT dedup. |

### 2.4 Oversized files (>200 lines source; >300 lines app)

| # | File | Lines | Notes |
|---|------|-------|-------|
| F1 | `modules/tracking/src/ekf.ts` | 554 | EKF class + 11 matrix helpers in one file |
| F2 | `modules/hazard-sos/src/crdt/syncWorker.ts` | 394 | |
| F3 | `modules/hazard-sos/src/ui/HazardReportSheet.tsx` | 337 | |
| F4 | `modules/hazard-sos/src/services/hazardService.ts` | 317 | |
| F5 | `modules/hazard-sos/src/services/sosService.ts` | 311 | |
| F6 | `modules/hazard-sos/src/dbscan/dbscan.ts` | 300 | |
| F7 | `modules/hazard-sos/src/crdt/orSet.ts` | 268 | |
| F8 | `modules/routing-eta/server/astar.js` | 268 | 6+ concerns in one file |
| F9 | `modules/tracking/src/mockLocationProducer.ts` | 242 | |
| F10 | `app/src/screens/map/MapScreen.tsx` | 423 | |
| F11 | `app/src/screens/map/overlays/HazardOverlay.tsx` | 406 | |
| F12 | `app/src/screens/map/overlays/SosOverlay.tsx` | 330 | |
| F13 | `modules/hazard-sos/test/hazardSos.test.ts` | 2796 | Extreme — all phases in one file |

### 2.5 Oversized functions (>50 lines)

| # | Function | Location | ~Lines |
|---|----------|----------|--------|
| G1 | `Ekf.update()` | `modules/tracking/src/ekf.ts:396-512` | 117 |
| G2 | `hazardService.triggerClustering()` | `modules/hazard-sos/src/services/hazardService.ts:117-219` | 103 |
| G3 | `sosService.subscribeToSosEvents()` | `modules/hazard-sos/src/services/sosService.ts:199-300` | 101 |
| G4 | `syncWorker.syncSosEvents()` | `modules/hazard-sos/src/crdt/syncWorker.ts:138-225` | 87 |
| G5 | `syncWorker.mergeSosOnSync()` | `modules/hazard-sos/src/crdt/syncWorker.ts:244-322` | 78 |
| G6 | `sosService.triggerSos()` | `modules/hazard-sos/src/services/sosService.ts:66-140` | 74 |
| G7 | `SensorStream.start()` | `modules/tracking/src/sensorStream.ts:54-116` | 63 |
| G8 | `server.handleRoute()` | `modules/routing-eta/server/astar.js:199-266` | 67 |

### 2.6 Inconsistent patterns

| # | Pattern | Details |
|---|---------|---------|
| P1 | Navigation prop typing | `LoginScreen.tsx:12`, `GroupListScreen.tsx:14` use `{ navigation }: any` while typed `RootStackParamList` exists |
| P2 | Catch-clause typing | Mixed `e: any` / `e: unknown` / untyped `catch (e)` across app screens |
| P3 | Log prefix convention | Most components use `[ComponentName]`; `GroupListScreen.tsx:44`, `RouteOverlay.tsx:78,83,113,167` omit it |
| P4 | `tsconfig.json` `jsx: react` in pure-TS modules | `modules/tracking/tsconfig.json:9`, `modules/routing-eta/tsconfig.json`, `modules/hazard-sos/tsconfig.json`, `modules/fl-voice/tsconfig.json` — all have `jsx: react` despite no JSX (except hazard-sos/fl-voice which do have .tsx). AGENTS.md says app-only |
| P5 | `substr` (deprecated) vs `slice` | `modules/hazard-sos/src/services/mockHazardService.ts:22`, `mockSosService.ts:27` use `.substr()` |
| P6 | Import style for types | `routeLine.ts:9`, `routeStore.ts:10-12` import interfaces as values; should use `import type` |
| P7 | `import` vs `require` mixing | hazard-sos source uses `import` for cross-module but `require()` for native deps; tests mix top-level `import` with in-`describe` `require()` |
| P8 | Test file naming | `phase6-ui-test-final.tsx` lacks `.test.` prefix, hardcoded in jest.config.js:5 |
| P9 | Assert import style (server) | `route_endpoint.test.js:7` uses `assert.strict`; others use `node:assert` default |
| P10 | Mutation vs return pattern | `astar.js:applyHazardPenalties` mutates AND returns; `hazard_penalty.js:applyHazardPenaltiesToGraph` mutates, returns undefined |
| P11 | Import placement (server) | `astar.js:175-176` imports mid-file after function definitions |
| P12 | `Coordinate` defined but not reused | `deepLink.ts:7` defines `Coordinate` interface; `routingClient.ts` uses inline `{lat,lng}` instead |

### 2.7 Logic bugs / smells (NOT to be fixed as "refactoring" — flagged for awareness only)

> These are **behavior bugs**, not refactoring targets. Fixing them would change behavior. They are documented here for the risk register (§7) and should be left alone in this refactoring effort.

| # | Location | Issue |
|---|----------|-------|
| B1 | `modules/hazard-sos/src/ui/hazardMarker.ts:29` | Returns string `'resolved'` as a "color" — but file is dead (D20), so no runtime impact |
| B2 | `modules/hazard-sos/test/hazardSos.test.ts:1579` | Assertion is on same line as `//` comment — never executes. Test "does not sync when already online" not actually verified |
| B3 | `modules/routing-eta/server/test/phase3.test.js:288-290` | Test hazard uses `lng` key instead of `centroid_lng` → `haversineMeters` receives `NaN` |
| B4 | `modules/routing-eta/server/test/eta_model.test.js:47-53` | `day_of_week === 1` assertion is timezone-dependent |
| B5 | `modules/fl-voice/src/fl/dpMasking.ts:55,60` | Uses Node `Buffer` — not available in RN runtime |
| B6 | `modules/fl-voice/src/fl/flRoundLogger.ts:30` | `latestRound()` assumes MMKV key ordering (not guaranteed) |
| B7 | `modules/fl-voice/src/vox/voxClient.ts:93-99` | `stop()` doesn't remove socket listeners → double-register on re-`start()` |

---

## 3. Quick Wins (safe, mechanical)

These are low-risk, mechanical changes that can be done one package at a time with high confidence.

### Q1: Remove committed cruft from hazard-sos

**What:** `git rm` the following files:
- `modules/hazard-sos/src/crdt/localQueue.ts.backup` (C1)
- `modules/hazard-sos/src/crdt/syncWorker.ts.backup` (C2)
- `modules/hazard-sos/test_output.txt` (C3)
- `modules/hazard-sos/test_output2.txt` (C4)
- `modules/hazard-sos/test_result.txt` (C5)
- `modules/hazard-sos/test_result2.txt` (C6)
- `modules/hazard-sos/test_result3.txt` (C7)

**Why:** Dead backup files and test log dumps committed to git. No code references them.

**Risk:** Low. Files are not imported or required by any source or test.

**Verification:** `cd modules/hazard-sos && npm run lint && npm run typecheck && npm test` — all existing tests must pass unmodified.

### Q2: Remove stale `app/env.d.ts` duplicate

**What:** `git rm app/env.d.ts` (C8). The complete declaration is in `app/.env.d.ts` (which tsconfig:12 and jest.config.js:21 already reference).

**Why:** `env.d.ts` only declares `MAPBOX_TOKEN` (missing `SOCKET_URL`/`ROUTING_URL`). It's not referenced by tsconfig or jest. Leaving it is confusing.

**Risk:** Low. Verify no config references `env.d.ts` (only `.env.d.ts` is referenced).

**Verification:** `cd app && npm run lint && npm run typecheck && npm test`.

### Q3: Add `.index.js.swo`, `*.swo`, `*.swp`, `.firebaserc` to `.gitignore`

**What:** Add to `.gitignore`:
```
# Editor swap files
*.swo
*.swp

# Firebase project config (per-environment, not shared)
infra/firebase/.firebaserc
```

**Why:** `app/.index.js.swo` (C9) and `infra/firebase/.firebaserc` (C12) are untracked and not gitignored — easy to accidentally commit. The `.firebaserc` also has a wrong project ID.

**Risk:** Low. No code depends on these files.

**Verification:** `git status` shows the files are now ignored. No package tests affected.

### Q4: Move phase report files from hazard-sos module dir to docs/

**What:** `git mv modules/hazard-sos/PHASE_4_COMPLETE.md docs/` and `git mv modules/hazard-sos/phase4_fix_report.md docs/` (C10, C11).

**Why:** Phase reports are reference documentation, not module source. They belong in `docs/`. AGENTS.md says `docs/` is reference-only (out of scope for refactoring), but *moving* files *into* docs/ is a cleanup, not a docs edit.

**Risk:** Low. No code references these markdown files.

**Verification:** `cd modules/hazard-sos && npm run lint && npm run typecheck && npm test`.

### Q5: Remove dead unused exports in app/

**What:** Remove the following dead exports/files:
- `sendSignal()` at `app/src/services/socketService.ts:36` (D1)
- `disconnectSockets()` at `app/src/services/socketService.ts:40` (D2) — **caveat:** see risk register R3
- `getSosQueue()` at `app/src/services/localStorage.ts:20` (D3)
- `getHazardQueue()` at `app/src/services/localStorage.ts:24` (D4)
- `firebaseFirestore` export at `app/src/services/firebaseService.ts:10` (D5)
- `app/src/hooks/useSocketStatus.ts` entire file (D6)
- `app/src/hooks/useToast.ts` entire file (D7)
- `app/src/theme/typography.ts` entire file (D8)
- `app/src/theme/colors.ts` entire file (D9)
- `app/src/theme/spacing.ts` entire file (D10)
- `app/src/components/NavFab.tsx` entire file (D11)
- `straightLineMeters` at `app/src/utils/geoUtils.ts:18` (D12)
- `getMarkerStateForMissing()` at `app/src/screens/map/overlays/riderMarkerState.ts:122` (D13) — **caveat:** used in tests; see risk register R4
- Dead styles at `app/src/screens/map/MapScreen.tsx:404-414` (D14)
- `handleNavigate` at `app/src/screens/map/overlays/SosOverlay.tsx:185-191` (D15)

**Why:** Dead code increases maintenance burden and confuses readers.

**Risk:** Low–Medium. Must verify each removal doesn't break tests (some "unused in app/src" exports are used in `__tests__/`).

**Verification:** `cd app && npm run lint && npm run typecheck && npm test`. For items used only in tests (D13), either keep the export or update the test to use an alternative — **prefer keeping the export if removing it would require changing test code**, since tests must pass unmodified per the constraint. See Risk Register R4.

### Q6: Remove dead unused exports in tracking module

**What:**
- Remove `RAD_TO_DEG` at `modules/tracking/src/ekf.ts:30` (D16)
- Remove `mat2x2Transpose` at `modules/tracking/src/ekf.ts:132-134` (D17)
- Remove `NIS_DOF` export at `modules/tracking/src/ekf.ts:26` (D18) — **caveat:** check if any test imports it
- Remove dead fields `_currentHeading`, `_prevHeading`, `_hasPrevHeading` at `modules/tracking/src/mockLocationProducer.ts:49,51-52` (D19)

**Why:** Dead code.

**Risk:** Low. Must verify no test imports `NIS_DOF`.

**Verification:** `cd modules/tracking && npm run lint && npm run typecheck && npm test`.

### Q7: Remove dead code in routing-eta client and server

**What:**
- Remove `FirebaseFirestoreTypes` import at `modules/routing-eta/src/group/groupService.ts:8` (D23)
- Remove `calculateHazardPenalty` import at `modules/routing-eta/server/demo.js:31` (D24)
- Remove `handleRoute` import at `modules/routing-eta/server/test/eta_model.test.js:11` (D25)
- Remove `haversineMeters` export at `modules/routing-eta/server/safety_score.js:135` (D26) — **after** E2 dedup ensures no importer exists
- Remove `haversineMeters` export at `modules/routing-eta/server/hazard_penalty.js:153` (D27) — **after** E2 dedup
- Remove `validateRouteResponse` export at `modules/routing-eta/server/test/route_response_contract.test.js:222` (D28)

**Why:** Dead imports/exports.

**Risk:** Low. The server has no lint/typecheck (plain JS, no eslint config), so verification is `npm test` only.

**Verification:**
- Client: `cd modules/routing-eta && npm run lint && npm run typecheck && npm test`
- Server: `cd modules/routing-eta/server && npm install && npm test`

### Q8: Remove dead mock file in hazard-sos

**What:** `git rm modules/hazard-sos/test/__mocks__/reactTestRendererMock.js` (D21).

**Why:** 119-line stub returning null; real `react-test-renderer` is a devDependency. Has 6 `console.log` debug statements.

**Risk:** Low. Verify no test file imports it explicitly (jest moduleNameMapper doesn't reference it — it's not a module name mock, it's a manual mock that must be explicitly imported).

**Verification:** `cd modules/hazard-sos && npm run lint && npm run typecheck && npm test`.

### Q9: Fix `substr` → `slice` in hazard-sos mock services

**What:**
- `modules/hazard-sos/src/services/mockHazardService.ts:22`: `.substr(2, 9)` → `.slice(2, 11)`
- `modules/hazard-sos/src/services/mockSosService.ts:27`: `.substr(2, 9)` → `.slice(2, 11)`

**Why:** `substr` is deprecated. `slice(2, 11)` produces the same 9-character substring (start=2, end=2+9=11). **Behavior-identical.**

**Risk:** Low. Same output for the same input.

**Verification:** `cd modules/hazard-sos && npm run lint && npm run typecheck && npm test`. Mock service tests verify the generated IDs — they should produce the same format.

### Q10: Remove dead `MusicWidget.tsx` stub in fl-voice

**What:** `git rm modules/fl-voice/src/ui/MusicWidget.tsx` (D29).

**Why:** Returns empty `<View/>`; header says "P2 — cut first if behind schedule." It's not exported from `index.ts` and not imported anywhere.

**Risk:** Low. Not exported, not imported.

**Verification:** `cd modules/fl-voice && npm run lint && npm run typecheck && npm test`.

---

## 4. Structural Refactors

These involve more significant code movement or deduplication. Each is a commit-worthy slice.

### S1: Extract `initials()` shared util in app/

**What:** Create `app/src/utils/text.ts` with `initials(name: string): string`. Update the 3 call sites (E1) to import from `@app/utils/text`.

**Files:**
- New: `app/src/utils/text.ts`
- Edit: `app/src/components/AvatarStack.tsx:14-16`
- Edit: `app/src/components/FamilyMemberCard.tsx:15-17`
- Edit: `app/src/screens/map/overlays/RiderMarkerOverlay.tsx:20-22`

**Why:** Duplicated logic across 3 components.

**Risk:** Low. Pure function, identical logic.

**Verification:** `cd app && npm run lint && npm run typecheck && npm test`.

### S2: Dedup `haversineMeters` in routing-eta server

**What:** Keep `haversineMeters` in `astar.js` (the original). Update `safety_score.js:122-133` and `hazard_penalty.js:140-151` to import from `astar.js` instead of redefining. Remove their local copies and unused exports (D26, D27).

**Files:**
- Edit: `modules/routing-eta/server/safety_score.js` — remove local `haversineMeters`, add `import { haversineMeters } from './astar.js'`
- Edit: `modules/routing-eta/server/hazard_penalty.js` — remove local `haversineMeters`, add `import { haversineMeters } from './astar.js'`

**Why:** 3 copies of identical function in the same package (E2).

**Risk:** Medium. ESM import path must be correct (`.js` extension required). `road_graph.js:20` already imports from `astar.js` successfully — follow that pattern.

**Verification:** `cd modules/routing-eta/server && npm install && npm test`. All 48 server tests must pass.

### S3: Dedup `getFirestore()` in hazard-sos

**What:** Create `modules/hazard-sos/src/services/firestoreAccess.ts` with a shared `getFirestore()` function. Update the 3 call sites (E3) to import from it.

**Files:**
- New: `modules/hazard-sos/src/services/firestoreAccess.ts`
- Edit: `modules/hazard-sos/src/crdt/syncWorker.ts:49-53` — import from `../services/firestoreAccess`
- Edit: `modules/hazard-sos/src/services/hazardService.ts:40-45` — import from `./firestoreAccess`
- Edit: `modules/hazard-sos/src/services/sosService.ts:43-48` — import from `./firestoreAccess`

**Why:** Identical `getFirestore()` pattern triplicated (E3).

**Risk:** Medium. The `@ts-ignore` + `require()` pattern must be preserved exactly. All 3 copies use `require('@react-native-firebase/firestore')` with `@ts-ignore` — the shared version must replicate this.

**Verification:** `cd modules/hazard-sos && npm run lint && npm run typecheck && npm test`.

### S4: Extract remote SOS → OR-Set reconstruction helper in hazard-sos

**What:** Create `modules/hazard-sos/src/services/sosMerge.ts` with a `rebuildRemoteORSet(remoteDocs, localSet)` function. Update the 3 call sites (E4) to use it.

**Files:**
- New: `modules/hazard-sos/src/services/sosMerge.ts`
- Edit: `modules/hazard-sos/src/crdt/syncWorker.ts:258-285` — replace inline block with call to helper
- Edit: `modules/hazard-sos/src/services/sosService.ts:217-239` — replace inline block
- Edit: `modules/hazard-sos/src/services/sosService.ts:266-286` — replace inline block

**Why:** Near-identical 20-line blocks triplicated (E4). High risk of drift.

**Risk:** Medium–High. The 3 blocks are *near*-identical but not *exactly* identical (different surrounding context, slightly different variable names). Must carefully verify the extracted helper covers all 3 cases without behavior change. The `syncWorker.ts` version also tombstones resolved events; the `sosService.ts` versions do similarly but in different ways. **Recommend extracting only the common core (doc→SOSElement + orSetAddWithTag) and leaving the tombstone logic at each call site if it differs.**

**Verification:** `cd modules/hazard-sos && npm run lint && npm run typecheck && npm test`. The `hazardSos.test.ts` CRDT correctness tests (lines 1598-2225) are the critical validation — they test tag preservation, concurrent tags, repeated sync, resolve-before-create, reconnect, batch failure.

### S5: Extract HazardReport doc→object mapping in hazard-sos

**What:** Create a `mapHazardReport(doc)` helper in `modules/hazard-sos/src/services/hazardService.ts` (or a shared internal utils file). Update the 2 call sites (E5).

**Files:**
- Edit: `modules/hazard-sos/src/services/hazardService.ts:130-142` and `:238-250` — extract to helper, call helper

**Why:** Same doc→HazardReport mapping duplicated (E5).

**Risk:** Low. Pure data mapping within a single file.

**Verification:** `cd modules/hazard-sos && npm run lint && npm run typecheck && npm test`.

### S6: Dedup `validateRouteResponse` in routing-eta server

**What:** The test file `test/route_response_contract.test.js:14-68` has its own copy of `validateRouteResponse`. Update the test to import from `astar.js` instead. Remove the local copy and the unnecessary export (D28).

**Files:**
- Edit: `modules/routing-eta/server/test/route_response_contract.test.js:14-68,222` — import from `../astar.js`, remove local copy

**Why:** Test has its own copy of the validator (E6). If `astar.js` changes, the test won't catch it — it tests its own copy.

**Risk:** Low–Medium. Must verify the two copies are functionally identical (they appear to be). If they differ, this becomes a behavior change — **do not proceed if they differ**.

**Verification:** `cd modules/routing-eta/server && npm install && npm test`. The contract test suite (9 tests) must pass.

### S7: Consolidate `createDiamondGraph` / `pathDistance` / `pathToCoordinates` in routing-eta server

**What:** Move `createDiamondGraph` to `road_graph.js` (or a new `test_graphs.js`). Update `demo.js`, `benchmark_astar.js`, `benchmark_rerouting.js` to import it. Replace `demo.js`'s local `pathDistance`/`pathToCoordinates` with imports from `road_graph.js`.

**Files:**
- Edit or new: `modules/routing-eta/server/road_graph.js` (add `createDiamondGraph`) or new `modules/routing-eta/server/test_graphs.js`
- Edit: `modules/routing-eta/server/demo.js:99-126,131-143,148-154` — import from shared location
- Edit: `modules/routing-eta/server/benchmark_astar.js:23-50` — import
- Edit: `modules/routing-eta/server/benchmark_rerouting.js:30-57` — import

**Why:** Duplicated graph utilities (E9, E10).

**Risk:** Medium. `demo.js` uses `process.exit()` and must remain self-contained. Verify the imported functions produce identical graphs. Benchmarks are not run in `npm test` but must not break on import.

**Verification:** `cd modules/routing-eta/server && npm install && npm test` + `node demo.js` (exit 0).

### S8: Consolidate severity weights constant in routing-eta server

**What:** Define `SEVERITY_WEIGHTS` once (in `hazard_penalty.js` which already has the most complete definition). Export it. Update `astar.js:76`, `safety_score.js:27-33`, `demo.js:64-70`, `benchmark_rerouting.js:80-86` to import from `hazard_penalty.js`.

**Files:**
- Edit: `modules/routing-eta/server/astar.js:76`
- Edit: `modules/routing-eta/server/safety_score.js:27-33`
- Edit: `modules/routing-eta/server/demo.js:64-70`
- Edit: `modules/routing-eta/server/benchmark_rerouting.js:80-86`

**Why:** 5 copies of the same severity weights object (E11).

**Risk:** Medium. Must verify all 5 copies have identical values. `demo.js` is a standalone script — ESM import must work. If any copy differs, **do not consolidate** — flag as a behavior discrepancy instead.

**Verification:** `cd modules/routing-eta/server && npm install && npm test` + `node demo.js`.

### S9: Unify `HlcSource` interface in tracking module

**What:** Define `HlcSource` once in `trackingService.ts` (already exported via `index.ts:5`). Update `mockLocationProducer.ts:14` and `test/demo.test.ts:9` to import from `./trackingService` / `../src/trackingService` respectively.

**Files:**
- Edit: `modules/tracking/src/mockLocationProducer.ts:14-16` — remove local interface, import from `./trackingService`
- Edit: `modules/tracking/test/demo.test.ts:9` — import from `../src/trackingService`

**Why:** Interface duplicated 3 times (E12).

**Risk:** Low. Identical shape. Must verify no circular dependency (mockLocationProducer is imported by trackingService? No — trackingService imports from ekf/sensorStream/locationPublisher/hlcStore, not mockLocationProducer. mockLocationProducer is independent). **Verify no circular import is introduced.**

**Verification:** `cd modules/tracking && npm run lint && npm run typecheck && npm test`.

### S10: Fix `tsconfig.json` `jsx` setting in pure-TS modules

**What:** In modules that have NO `.tsx` files, remove `"jsx": "react"` from tsconfig.json. Specifically:
- `modules/tracking/tsconfig.json:9` — no .tsx files in src/ or test/

**Keep** `jsx: react` in:
- `modules/hazard-sos/tsconfig.json` — has `.tsx` files (HazardReportSheet.tsx, etc.)
- `modules/fl-voice/tsconfig.json` — has `.tsx` files
- `modules/routing-eta/tsconfig.json` — technically no .tsx in src/, but harmless to keep since it's client-only; **lower priority**

**Why:** AGENTS.md states `jsx: react` is app-only. Tracking module has no JSX (P4).

**Risk:** Low. Removing `jsx` from tsconfig for a module with no JSX has no effect on compilation. If `tsc` complains, re-add it.

**Verification:** `cd modules/tracking && npm run lint && npm run typecheck && npm test`.

### S11: Fix inconsistent patterns in app/ (navigation typing, catch typing, log prefixes)

**What:**
- `app/src/screens/LoginScreen.tsx:12` — replace `{ navigation }: any` with typed `RootStackNavigationProp` (P1)
- `app/src/screens/GroupListScreen.tsx:14` — same (P1)
- Standardize `catch (e: any)` → `catch (e: unknown)` where feasible (P2) — **only if it doesn't change runtime behavior** (e.g., if `e.message` is accessed, add a type guard)
- Add `[ComponentName]` prefix to log statements missing it: `GroupListScreen.tsx:44`, `RouteOverlay.tsx:78,83,113,167` (P3)

**Why:** Inconsistent patterns across the codebase (P1, P2, P3).

**Risk:** Low–Medium. Navigation prop typing is pure type-level (no runtime change). Catch typing changes are type-level only if error access is guarded. Log prefix changes are string-only (no behavior change, but test assertions that match log output would break — verify no test asserts on console output).

**Verification:** `cd app && npm run lint && npm run typecheck && npm test`.

### S12: Fix import style for types in routing-eta client

**What:**
- `modules/routing-eta/src/client/routeLine.ts:9` — `import { RouteResponse }` → `import type { RouteResponse }` (P6)
- `modules/routing-eta/src/client/routeStore.ts:10-12` — same for `RouteResponse`, `VerifiedLocation`, `HazardCluster`

**Why:** Type-only imports should use `import type` (P6). With `esModuleInterop: true` this compiles either way, but `import type` is more correct and enables better tree-shaking.

**Risk:** Low. Pure type-level change. `verbatimModuleSyntax` is not enabled, so this is stylistic.

**Verification:** `cd modules/routing-eta && npm run lint && npm run typecheck && npm test`.

---

## 5. Optional / Later

These are larger structural changes that carry higher risk or lower ROI. Documented for future consideration but **not recommended for this refactoring pass**.

### O1: Split `ekf.ts` (554 lines) into matrix utils + EKF class

**What:** Extract matrix helpers (`mat4x4Multiply`, `mat2x2Invert`, etc.) into `modules/tracking/src/matrixUtils.ts`. Keep EKF class in `ekf.ts`.

**Why:** F1 — 554 lines, 11 matrix helpers + EKF class in one file.

**Risk:** Medium. Must ensure all exports used by tests remain accessible. `index.ts` re-exports `* from './ekf'` — matrix helpers would need to be re-exported too if any test imports them.

**Defer because:** High effort, low immediate ROI. The file is large but cohesive (all math-related). No duplication risk.

### O2: Split `hazardSos.test.ts` (2796 lines) by phase

**What:** Split into `test/hlc.test.ts`, `test/dbscan.test.ts`, `test/orSet.test.ts`, `test/localQueue.test.ts`, `test/syncWorker.test.ts`, `test/hazardService.test.ts`, `test/sosService.test.ts`, `test/crdtCorrectness.test.ts`.

**Why:** F13 — 2796 lines in one test file is extreme.

**Risk:** Medium. Must preserve every test case exactly. The file has shared mock setup at the top that all test blocks depend on. Splitting requires duplicating or sharing the mock setup.

**Defer because:** Test refactoring is explicitly lower priority than source refactoring. All tests pass today. Risk of accidentally dropping a test case during the split is non-trivial.

### O3: Split `astar.js` (268 lines, 6+ concerns) in routing-eta server

**What:** Split into `haversine.js`, `minheap.js`, `astar.js` (search only), `routeHandler.js` (handleRoute), `hlc.js`, `contractValidator.js`.

**Why:** F8 — 6+ concerns in one file.

**Risk:** High. The server has no lint/typecheck safety net (plain JS, no eslint). Import path errors would only surface at runtime or test time. Many inter-dependencies within the file.

**Defer because:** High risk, no type safety net. Better to address after adding eslint to the server (which is itself a separate task).

### O4: Add ESLint config to routing-eta server

**What:** Add `.eslintrc.js` to `modules/routing-eta/server/` matching the shared base config.

**Why:** P-server — server is the only package without eslint. Inconsistent with repo convention.

**Risk:** Low to add, but may surface many lint warnings (80+ `console.log` in demo.js, `as any` in tests, etc.). Would need `ignorePatterns` for `demo.js`, `benchmark_*.js`, and `training/`.

**Defer because:** This is tooling addition, not refactoring. Surfaces warnings that would need to be addressed — scope creep.

### O5: Split oversized app screens (MapScreen 423, HazardOverlay 406, SosOverlay 330)

**What:** Decompose `MapScreen.tsx` into smaller sub-components; extract info-card logic from `HazardOverlay.tsx` and `SosOverlay.tsx` into separate files.

**Why:** F10, F11, F12.

**Risk:** High. These are React components with complex state/effect interactions. Splitting risks introducing subtle re-render behavior changes. No behavior-change allowed.

**Defer because:** High risk of behavior regression in UI components. ROI is marginal — the files are large but readable.

### O6: Decompose oversized functions (G1–G8)

**What:** Break `Ekf.update()` (117 lines), `triggerClustering()` (103 lines), `subscribeToSosEvents()` (101 lines), etc. into smaller helper methods.

**Why:** G1–G8.

**Risk:** Medium–High. Extracting methods from tightly-coupled class methods risks subtle this-binding or closure issues. Must preserve exact control flow.

**Defer because:** High risk, moderate effort. Functions are long but well-documented. No duplication within them.

### O7: Consolidate `Coordinate` type usage in routing-eta client

**What:** Replace inline `{ lat: number; lng: number }` in `routingClient.ts:44,64,78` with the exported `Coordinate` interface from `deepLink.ts:7` (P12).

**Why:** P12 — package defines a coordinate type but doesn't use it internally.

**Risk:** Low, but it touches the `RoutingClient` public method signatures which are consumed by the app. Must verify app-side calls still typecheck.

**Defer because:** Low ROI. The inline type and `Coordinate` are structurally identical. The change is purely cosmetic.

---

## 6. Execution Order

Each step is a commit-worthy slice. Run verification gates after each step before proceeding to the next.

### Step 1: hazard-sos cruft cleanup (Q1 + Q4 + Q8 + Q9)
```
cd modules/hazard-sos
git rm src/crdt/localQueue.ts.backup src/crdt/syncWorker.ts.backup
git rm test_output.txt test_output2.txt test_result.txt test_result2.txt test_result3.txt
git rm test/__mocks__/reactTestRendererMock.js
git mv PHASE_4_COMPLETE.md ../../docs/
git mv phase4_fix_report.md ../../docs/
# Fix substr → slice
npm install && npm run lint && npm run typecheck && npm test
```

### Step 2: app cruft cleanup (Q2 + Q3 + Q5)
```
cd app
git rm env.d.ts
# Edit: remove dead exports from socketService, localStorage, firebaseService
# Delete: hooks/useSocketStatus.ts, hooks/useToast.ts, theme/typography.ts, theme/colors.ts, theme/spacing.ts, components/NavFab.tsx
# Edit: remove straightLineMeters, dead styles, handleNavigate
# Add .gitignore entries (root-level)
npm install && npm run lint && npm run typecheck && npm test
```

### Step 3: tracking module dead code (Q6)
```
cd modules/tracking
# Edit: remove RAD_TO_DEG, mat2x2Transpose, NIS_DOF (if test-safe), dead mock fields
npm install && npm run lint && npm run typecheck && npm test
```

### Step 4: routing-eta dead code (Q7)
```
cd modules/routing-eta
# Edit: remove FirebaseFirestoreTypes import
npm install && npm run lint && npm run typecheck && npm test

cd modules/routing-eta/server
npm install && npm test
# Edit: remove calculateHazardPenalty import (demo.js), handleRoute import (test)
npm test
```

### Step 5: fl-voice dead code (Q10)
```
cd modules/fl-voice
git rm src/ui/MusicWidget.tsx
npm install && npm run lint && npm run typecheck && npm test
```

### Step 6: app `initials()` dedup (S1)
```
cd app
# New: src/utils/text.ts
# Edit: AvatarStack, FamilyMemberCard, RiderMarkerOverlay
npm run lint && npm run typecheck && npm test
```

### Step 7: routing-eta server `haversineMeters` dedup (S2)
```
cd modules/routing-eta/server
# Edit: safety_score.js, hazard_penalty.js — import from astar.js
npm test
```

### Step 8: hazard-sos `getFirestore()` dedup (S3)
```
cd modules/hazard-sos
# New: src/services/firestoreAccess.ts
# Edit: syncWorker, hazardService, sosService
npm run lint && npm run typecheck && npm test
```

### Step 9: hazard-sos HazardReport mapping dedup (S5)
```
cd modules/hazard-sos
# Edit: hazardService.ts — extract mapHazardReport helper
npm run lint && npm run typecheck && npm test
```

### Step 10: routing-eta server test dedup (S6)
```
cd modules/routing-eta/server
# Edit: test/route_response_contract.test.js — import validateRouteResponse from astar.js
npm test
```

### Step 11: routing-eta server graph utils dedup (S7)
```
cd modules/routing-eta/server
# Edit: add createDiamondGraph to road_graph.js or new test_graphs.js
# Edit: demo.js, benchmark_astar.js, benchmark_rerouting.js
npm test && node demo.js
```

### Step 12: routing-eta server severity weights dedup (S8)
```
cd modules/routing-eta/server
# Edit: astar.js, safety_score.js, demo.js, benchmark_rerouting.js
npm test && node demo.js
```

### Step 13: tracking HlcSource dedup (S9)
```
cd modules/tracking
# Edit: mockLocationProducer.ts, test/demo.test.ts
npm run lint && npm run typecheck && npm test
```

### Step 14: tracking tsconfig jsx fix (S10)
```
cd modules/tracking
# Edit: tsconfig.json — remove jsx: react
npm run lint && npm run typecheck && npm test
```

### Step 15: app pattern fixes (S11)
```
cd app
# Edit: LoginScreen, GroupListScreen — navigation typing
# Edit: catch typing, log prefixes
npm run lint && npm run typecheck && npm test
```

### Step 16: routing-eta client import type fix (S12)
```
cd modules/routing-eta
# Edit: routeLine.ts, routeStore.ts — import type
npm run lint && npm run typecheck && npm test
```

### Step 17 (optional, higher risk): hazard-sos SOS merge dedup (S4)
```
cd modules/hazard-sos
# New: src/services/sosMerge.ts
# Edit: syncWorker.ts, sosService.ts (2 sites)
npm run lint && npm run typecheck && npm test
# CRITICAL: verify CRDT correctness tests (hazardSos.test.ts:1598-2225) all pass
```

---

## 7. Risk Register

Things that look tempting to refactor but **should be left alone**.

| # | Tempting Target | Why Leave It Alone |
|---|----------------|-------------------|
| R1 | `contracts/route_contract.json` non-standard schema (`request`/`response` keys) | Contracts are **frozen** — no solo edits, all 4 members must approve. CI only validates JSON is parseable, not schema-valid. Changing this is a contract change, which is explicitly out of scope. |
| R2 | `contracts/*.json` custom `transport`/`privacy`/`crdt` extension fields | Same as R1 — frozen contracts. |
| R3 | `disconnectSockets()` at `app/src/services/socketService.ts:40` | It's dead code (D2), but removing it removes the only socket cleanup mechanism. If someone later needs it, they'd have to re-add it. **Recommendation:** Keep it but add a `// @internal — not currently called in app/src; available for future cleanup` comment. OR remove it — it's a judgment call. If removed, verify no test mocks it. |
| R4 | `getMarkerStateForMissing()` at `app/src/screens/map/overlays/riderMarkerState.ts:122` | Used only in tests (D13). Removing it would require modifying test code, which violates "all existing tests must pass unmodified." **Recommendation:** Keep it. It's a legitimate test utility export. |
| R5 | Server `/route` handler mock (3 TODOs at `astar.js:223-225`) | The handler is a mock — real routing not implemented. This is **unfinished feature work**, not refactoring debt. Do not implement it (that's a new feature). |
| R6 | Server FL proxy stubs (`fl_proxy.js:10,16` TODOs) | Same as R5 — unfinished feature work. Do not implement. |
| R7 | `fl-voice` VOX signaling empty handlers (`voxClient.ts:74-84`) | Unfinished feature work. Do not implement. |
| R8 | `fl-voice` `FlClient.trainLocal` stub | Unfinished feature work. Do not implement. |
| R9 | `hazardMarker.ts` bug (B1: returns `'resolved'` string as color) | It's a bug, but the file is dead (D20: not exported from index.ts, not imported anywhere). Fixing the bug is a behavior change to dead code. **Recommendation:** Delete the file entirely (it's dead) rather than fixing the bug. But verify no test imports it. |
| R10 | `hazardSos.test.ts:1579` commented-out assertion (B2) | This is a **test bug** — the assertion is on the same line as a `//` comment. Fixing it (moving the `expect` to a new line) would change what the test verifies — that's a behavior change to the test suite. **Recommendation:** Flag it but don't fix it in this refactoring pass. Fixing test bugs is a separate task. |
| R11 | Server `phase3.test.js:288-290` `lng` vs `centroid_lng` typo (B3) | Test data bug. Fixing it would change the test's behavior (currently passes trivially because `haversineMeters` receives `NaN`). **Recommendation:** Flag but don't fix — same reasoning as R10. |
| R12 | Server `eta_model.test.js:47-53` timezone-dependent assertion (B4) | Test flakiness risk, but fixing it would change test behavior. **Recommendation:** Flag but don't fix. |
| R13 | `fl-voice` `Buffer` usage in `dpMasking.ts:55,60` (B5) | This is a portability bug (Buffer not in RN). But fixing it (replacing with a base64 polyfill) would change runtime behavior. **Recommendation:** Flag but don't fix — it's a feature implementation issue, not refactoring. |
| R14 | `fl-voice` `FlRoundLogger.latestRound()` ordering assumption (B6) | Bug, but fixing it changes behavior. Flag but don't fix. |
| R15 | `fl-voice` `VoxClient.stop()` doesn't remove listeners (B7) | Bug, but fixing it changes behavior. Flag but don't fix. |
| R16 | Firestore rules weaknesses (`firestore.rules:46-47,53,57-58`) | Security rules are not code refactoring. Changing them alters access control behavior. **Recommendation:** Out of scope. Flag for security review. |
| R17 | `infra/firebase/firebase.json:4` `"source": "."` should be `"source": "functions"` | This is a config bug that breaks `firebase deploy`. But it's infrastructure config, not source code. **Recommendation:** Flag but don't fix in this refactoring pass (it's a 1-line fix but it's infra, not code). |
| R18 | `infra/firebase/.firebaserc` wrong project ID | Same as R17 — infra config, not code. |
| R19 | `infra/firebase/functions/` missing lint script + eslint config | Infra tooling, not source refactoring. |
| R20 | Per-module duplicated test mocks (`test/__mocks__/` in all 4 TS modules) | **Intentional per AGENTS.md** — "These are duplicated per module intentionally." Do NOT dedup. |
| R21 | `hazard-sos` 4 different MMKV mock variants across test files | These are inline `jest.mock` overrides in each test file. Consolidating them would change test setup behavior. **Recommendation:** Leave alone — test refactoring is lower priority and risks breaking test isolation. |
| R22 | `hazard-sos` deprecated exports in `dbscan.ts:26-98` and `orSet.ts:28-66` | Marked `@deprecated` but still exported. Removing them would be a breaking API change for any external consumer. **Recommendation:** Leave alone — they're explicitly marked deprecated, which is the correct signal. |
| R23 | Server `MinHeap` using `Array.sort()` (O(n²) A*) | Performance issue, not correctness. A* still produces optimal paths. Replacing with a real binary heap would change performance characteristics (could expose previously-masked bugs). **Recommendation:** Leave alone — it's a performance optimization, not refactoring. |
| R24 | Server wildcard CORS (`index.js:11,24`) | Security concern, but tightening CORS would change runtime behavior (reject requests from previously-allowed origins). **Recommendation:** Out of scope for refactoring. |
| R25 | `routing-eta` `.eslintrc.js:13` ignores `test/` from lint | Changing this would surface many lint errors in test files. **Recommendation:** Leave alone — enabling lint on tests is a separate task with its own cleanup effort. |
| R26 | `routing-eta` `GroupService` instantiated per-render in app | App-side pattern, but the service class lives in routing-eta. Making it a singleton would change behavior (shared state across screens). **Recommendation:** Leave alone. |
| R27 | Server 3 different safety-score formulas (E8) | `astar.js:routeSafetyScore`, `safety_score.js:calculateSafetyScore`, and the handler's inline hardcoded `0.85`. Consolidating these would change the handler's output (currently uses neither real formula). **Recommendation:** Do NOT consolidate — the handler's inline calculation is mock behavior. Changing it alters the `/route` response. This is unfinished feature work (R5), not refactoring. |
| R28 | `app/src/screens/map/overlays/SosOverlay.tsx:101-136` unreachable resolved-events logic | The service "deliberately emits active OR-Set members only" so `resolvedEvents` is always `[]` and the mapping is dead. But this is a behavioral assumption about the service — removing the dead code might break if the service behavior changes later. **Recommendation:** Leave alone — it's defensive code for a future service change. |

---

## 8. Verification Gates (summary)

Every change must pass these gates, in order, run from the **package's own directory**:

| Package | Lint | Typecheck | Test |
|---------|------|-----------|------|
| `app/` | `npm run lint` | `npm run typecheck` | `npm test` (jest) |
| `modules/tracking/` | `npm run lint` | `npm run typecheck` | `npm test` (jest) |
| `modules/hazard-sos/` | `npm run lint` | `npm run typecheck` | `npm test` (jest) |
| `modules/routing-eta/` | `npm run lint` | `npm run typecheck` | `npm test` (jest) |
| `modules/routing-eta/server/` | N/A (no eslint) | N/A (plain JS) | `npm test` (node --test) |
| `modules/fl-voice/` | `npm run lint` | `npm run typecheck` | `npm test` (jest) |
| `contracts/` | N/A | N/A | CI: `python -m json.tool` loop (no local test command) |

**Rules:**
1. Always `npm install` first in the package directory (no root install).
2. Run **lint → typecheck → test** in that order (CI enforces this per AGENTS.md).
3. All existing tests must pass **unmodified** — no test code changes except import path updates for deduped helpers.
4. Contracts must stay green (no changes to `contracts/*.json`).
5. For the routing-eta server, also run `node demo.js` after graph-related changes (S7, S8) — must exit 0.
6. One package at a time — each step is a commit-worthy slice.

---

*End of REFACTOR_PLAN.md. No code has been modified. Awaiting instruction on which items to implement first.*