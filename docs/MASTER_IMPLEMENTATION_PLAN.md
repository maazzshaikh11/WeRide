# WeRide — Master Implementation Plan

**Goal: a real, working, end-to-end WeRide application.**
Not "compiles". Not "unit tests pass". Actual user flows must work.

- **Created:** 2026-09-26
- **Codebase snapshot:** commit `8439964` ("fix: resolve Person C integration issues")
- **Audits re-read in full:** Person A, Person B, Person C, UI/Design-System
- **Method:** every audit finding was re-checked against the CURRENT code (grep + targeted reads). Findings are marked **CONFIRMED (still present)**, **FIXED**, or **VERIFY** (needs a closer look during implementation).
- **Status gate:** ⛔ DO NOT WRITE CODE until this plan is reviewed. Implementation starts only after plan approval.

---

## Table of contents

1. [Global rules](#global-rules)
2. [Scope decisions (locked)](#scope-decisions-locked)
3. [Re-verification summary](#re-verification-summary)
4. [Phase 1 — Person A: Tracking + Anti-Spoofing](#phase-1--person-a-tracking--anti-spoofing)
5. [Phase 2 — Person B: Hazards + SOS](#phase-2--person-b-hazards--sos)
6. [Phase 3 — Person C: Routing + ETA](#phase-3--person-c-routing--eta)
7. [Phase 4 — UI/UX: Frontend + Design System + Demo Matching](#phase-4--uiux-frontend--design-system--demo-matching)
8. [Phase 5 — Cross-Module Integration](#phase-5--cross-module-integration)
9. [Phase 6 — Complete End-to-End Test](#phase-6--complete-end-to-end-test)
10. [Automated verification (per phase)](#automated-verification-per-phase)
11. [Runtime verification](#runtime-verification)
12. [Final master report template](#final-master-report-template)

---

## Global rules

1. DO NOT rewrite working algorithms unnecessarily. EKF, spoof detector, DBSCAN, OR-Set, A*, hazard penalty, safety score, LightGBM pipeline are REAL — keep them.
2. DO NOT replace existing architecture because another approach is easier.
3. Preserve the four-person module boundaries (`modules/tracking`, `modules/hazard-sos`, `modules/routing-eta`, `modules/fl-voice`).
4. Fix wiring/integration problems BEFORE rebuilding existing algorithms. The repo's dominant failure mode is **unmounted/unwired code**, not broken algorithms.
5. A feature is WORKING only when its complete user-facing flow works — not when a file exists, a function exists, a test passes, TypeScript compiles, or a screen renders.
6. Do not weaken tests to make them pass. Exception: tests that certify a bug (B's HLC dash-format test) must be corrected to the canonical spec, not deleted.
7. Do not remove functionality to hide errors. Do not suppress runtime errors without fixing root cause.
8. Do not make Firebase publicly readable/writable. Rules stay scoped to authenticated group members.
9. Do not invent API keys, Mapbox tokens, Firebase credentials, or secrets. Manual credential steps go in `docs/SETUP_CREDENTIALS.md`.
10. Do not modify `node_modules` directly. Use the project's patch mechanism if a dependency patch is unavoidable.
11. Do not touch Person D's unfinished VOX WebRTC peer communication unless an already-built feature requires it. VOX peer-to-peer is DEFERRED.
12. Federated Learning is not rebuilt/invented unless the current project scope explicitly requires it.
13. Do not declare success until runtime verification is performed and documented.

---

## Scope decisions (locked)

| Decision | Ruling | Grounding |
|---|---|---|
| Road graph source | **Option A**: Mapbox Directions API base route + hazard-avoidance post-processing | The distribution doc itself recommends Option A for MVP ("start Option A, upgrade to B if time permits", `Person_C_Routing_ETA.md` §3.1). True safety-weighted A* on a raw OSM graph (Option B) is out of scope for this phase. |
| VOX WebRTC peer communication | **DEFERRED** | Explicit in the task. Voice tab UI is built; transport comes later. |
| Federated Learning | **DEFERRED / out of scope** | Not rebuilt unless project scope requires it. |
| Canonical HLC format | **`physical:counter` (colon)** | Server `generateHlcTimestamp` (astar.js:190) and the strict marker parser `extractHlcPhysical` (riderMarkerState.ts:58, regex `/^(\d+):(\d+)$/`) both use colon. B's dash format is the outlier — fix B, not everyone else. |
| HLC clock instances | **ONE shared causal clock** per device | A's MMKV id `'tracking'` and B's `'hlc'` must converge to a single persisted clock. |
| Clustering authority (§7) | **Server-side clustering is the target; client clusters only as offline fallback** | Client-side clustering without a decided protocol is the current race. Decide and document in `docs/IMPLEMENTATION/PHASE2_PERSON_B.md`. |
| Firestore hazard write path | **`groups/{groupId}/reports/{reportId}`** (what the client writes) | Rules must be fixed to allow it — not the client rewritten to a different path. |

---

## Re-verification summary

Re-checked 2026-09-26 against commit `8439964`. Result: **nearly every audit finding is still present.** The latest commit touched only app-side files (RoutePanel tests, GroupListScreen, MapScreen, RouteOverlay, SosOverlay, routingClient) and fixed none of the P0s. It introduced **one regression**: `RouteOverlay.tsx` changed `process.env.SERVER_URL ?? 'http://localhost:3000'` → hardcoded `'http://localhost:3000'`, removing the env override (C P1-10 got worse).

| # | Finding | Status in current code |
|---|---|---|
| A-P0-1 | `ridersStore.subscribe()` never called | **CONFIRMED** — defined at `app/src/store/ridersStore.ts:115`, zero call sites in app |
| A-P0-2 | Server never rebroadcasts `location:update` | **CONFIRMED** — client emits (`locationPublisher.ts:51,107`); server has no location handler at all |
| A-P1-3 | `fetchLastKnown` never called | **CONFIRMED** — defined `locationPublisher.ts:61`, never called |
| A-P1-4 | Background location never enabled | **CONFIRMED** — `react-native-background-geolocation` is imported in `sensorStream.ts` but never started; no background permission in manifest |
| A-P1-5 | Forward accel is `|a|−g` placeholder | **CONFIRMED** — `sensorStream.ts:9` still says "placeholder" |
| B-P0-1 | HLC dash vs colon mismatch | **CONFIRMED** — B emits `physical-counter` (`hlc.ts:94`); marker parser requires colon (`riderMarkerState.ts:66`); server uses colon (`astar.js:193`) |
| B-P0-2 | Hazard/SOS layers outside MapView | **CONFIRMED** — `SosOverlay`, `HazardOverlay`, `RouteOverlay`, `VoxOverlay`, `FlStatusOverlay` all mounted after `</MapboxGL.MapView>`; MapScreen has TODO for hazard markers + route line as Mapbox sources |
| B-P0-3 | Rules deny `groups/{groupId}/reports` | **CONFIRMED** — client writes that path (`hazardService.ts:32`); rules only allow top-level `hazard_reports` |
| B-P0-4 | SOS/hazard buttons + `startSyncWorker` unmounted | **CONFIRMED** — zero call sites for `SosButton`, `HazardReportButton`, `HazardReportSheet`, `startSyncWorker` in `app/src` |
| B-P0-5 | FCM token never saved | **CONFIRMED** — `App.tsx` only requests FCM permission; no token save |
| B-P1-6 | `submitHazardReport` online path no try/catch | **CONFIRMED** — `hazardService.ts:86-94` awaits Firestore with no catch; failed write = lost report |
| B-P1-7 | No cold-start sync | **CONFIRMED** — `App.tsx` starts nothing |
| B-P2-9 | `demo-group`/`demo-rider` fallbacks | **CONFIRMED** — `MapScreen.tsx:52`, `HazardReportSheet.tsx:44-45` |
| C-P0-1 | `handleRoute` straight-line mock | **CONFIRMED** — TODO at `astar.js:225`, straight line at `:252` |
| C-P0-2 | No road graph data | **CONFIRMED** — decision: Option A per spec |
| C-P0-3 | km vs meters unit mismatch | **CONFIRMED** — `astar.js:229` `distanceKm = distanceM/1000`; haversine `R=6371000` (meters) |
| C-P0-5 | `active_hazards` never sent | **CONFIRMED** — no references in `RouteOverlay.tsx` / `routingClient.ts` |
| C-P0-6 | NYC hardcoded destination | **CONFIRMED** — `RouteOverlay.tsx:37` `MOCK_DESTINATION = { lat: 40.7140, lng: -74.0089 }` |
| C-P1-7 | Sidecar undeployed, hollow features | **CONFIRMED** — no compose/Procfile/systemd unit; `handleRoute` passes only `distance_km` |
| C-P1-10 | localhost:3000 hardcoded ×3 | **CONFIRMED** (+1 regression: env override removed) |
| UI-P0-1 | theme.ts wrong system | **CONFIRMED** — no demo tokens (`#0A0A0A`, `#FF5C00`, Bebas, Inter, Space Mono) |
| UI-P0-2 | Fonts not bundled | **CONFIRMED** — no font files under `app/android` / `app/ios` |
| UI-P0-3 | No 6-tab navigation | **CONFIRMED** — only `RootStack`; no bottom-tab navigator |
| — | `docs/UIUX_MASTER_DESIGN_SPEC.md` | **MISSING** — must be authored from the demo HTML in Phase 4 |

Items marked VERIFY below need a closer read during implementation (behavioral, not grep-able).

---

## PHASE 1 — PERSON A: Tracking + Anti-Spoofing

### Audit findings (re-verified current status)

| # | Finding | Current status |
|---|---|---|
| A-P0-1 | `ridersStore.subscribe()` never called | CONFIRMED — defined `app/src/store/ridersStore.ts:115`, zero call sites |
| A-P0-2 | Server never rebroadcasts `location:update` | CONFIRMED — client emits (`locationPublisher.ts:51,107`); server has no location handler |
| A-P1-3 | `fetchLastKnown` never called | CONFIRMED — defined, never called |
| A-P1-4 | Background location never enabled | CONFIRMED — `react-native-background-geolocation` imported in `sensorStream.ts:19` but never started; no background permission declared |
| A-P1-5 | Forward accel is `|a|−g` placeholder | CONFIRMED — `sensorStream.ts:9` header still says "placeholder" |
| A-P2-6 | Stale comment in `hlcStore.ts` | VERIFY during cleanup |
| — | Dual HLC clocks (A `'tracking'` vs B `'hlc'` MMKV ids) | CONFIRMED — converge to one (see scope decisions) |

### Files involved

- `modules/tracking/src/ekf.ts`, `spoofDetector.ts`, `sensorStream.ts`, `trackingService.ts`, `locationPublisher.ts`, `hlcStore.ts`, `permissions.ts`, `mockLocationProducer.ts`, `index.ts`
- `modules/routing-eta/server/index.js` (add location namespace/rebroadcast — server file lives in Person C's package but the handler is Person A's data flow; coordinate ownership)
- `app/src/store/ridersStore.ts`, `app/src/screens/map/overlays/RiderMarkerOverlay.tsx`, `riderMarkerState.ts`, `RiderInfoCard` (if exists)
- `app/src/screens/map/MapScreen.tsx` (mount path)
- `app/src/services/socketService.ts` (socket URL config)
- `contracts/` — `verified_location` schema (frozen; read-only unless all 4 members review)

### Confirmed bugs

1. No live rider data reaches the UI: subscribe never called AND server never fans out. Both must be fixed together — fixing only one still yields a dead map.
2. Cold start shows an empty map (no `fetchLastKnown`).
3. Tracking dies on background (ride app — fatal).
4. EKF's IMU leg is fed device-frame `|a|−g` as "forward acceleration" — fake confidence.

### Missing functionality

- Server-side `location:update` → group-room broadcast (`socket.to(groupId).emit('location:update', payload)`)
- Map-screen mount: `subscribe(groupId)` + `fetchLastKnown()`; unmount: `unsubscribe()`
- Background location: start `react-native-background-geolocation`, declare `ACCESS_BACKGROUND_LOCATION` (Android) / `location` background mode (iOS), handle permission denial gracefully
- Attitude-aware forward acceleration OR honest GPS-only fallback

### Dependencies

- None from other phases. Phase 1 is the foundation — B's staleness coloring and C's route recalc both consume A's location stream.

### Implementation tasks

1. **Server:** add `location:update` handler → validate → broadcast to group room. Include HLC merge (use the canonical colon clock; see Phase 5).
2. **Client:** in `MapScreen` mount, call `useRidersStore.getState().subscribe(groupId)` and `fetchLastKnown()`; cleanup calls `unsubscribe()`. Guard against duplicate listeners on re-render (the `subscribed` flag exists — use it).
3. **Background:** start background-geolocation on tracking start; stop on tracking stop; document the manual permission step in `docs/SETUP_CREDENTIALS.md`.
4. **IMU:** verify `react-native-sensors` v7 API against the installed package (observable `.subscribe()`; `setUpdateIntervalForType` is a separate export — do NOT call it as a method). Set 10 Hz (100 ms — verify units, not 100000 ms) for accel/gyro; verify the EKF runs at ~1 Hz.
   - If device attitude can be obtained reliably (rotation vector / gyro+accel fusion), project acceleration onto the vehicle-forward axis.
   - If not: implement GPS-only fallback with accuracy-gated confidence. DO NOT ship `|a|−g` labeled as forward acceleration.
5. **HLC:** converge A's and B's clocks to one persisted MMKV instance and the colon format (do this once, here, and B consumes it in Phase 2).
6. **Cleanup:** stale comment in `hlcStore.ts`; remove `demo-group` fallback in `MapScreen.tsx:52` (replace with explicit "no group" state).

### Verification tasks

- Trace the full chain by reading code AND runtime logs: tracking start → sensors → GPS → EKF → NIS → spoof flag → verified location → publisher → socket → server → broadcast → ridersStore → marker.
- Confirm no duplicate socket listeners after navigation away and back (log listener counts).
- Confirm reconnect does not duplicate listeners and resumes the stream.

### Acceptance criteria

- [ ] Tracking starts without runtime errors; GPS fix initializes tracking; IMU does not crash
- [ ] EKF runs at intended rate (~1 Hz processing of 10 Hz sensor data)
- [ ] Verified location is generated and published via socket
- [ ] Server rebroadcasts to the group room; a second client receives it
- [ ] `ridersStore` updates; markers render with green/amber/grey staleness
- [ ] Cold start seeds markers via `fetchLastKnown`
- [ ] Background tracking continues (or degrades with a clear user-visible state)
- [ ] Spoof detection flags injected mock locations (test with `mockLocationProducer.ts`)
- [ ] Cleanup on unmount; reconnect duplicates nothing
- [ ] Offline behavior matches spec (queue or clearly surface; no silent drops)

### Tests required

- Existing Person A tests keep passing (4 of 5 present — do not weaken).
- ADD: wiring test — subscribe → simulated socket `location:update` → store updates → staleness tier correct.
- ADD: server test — `location:update` in → broadcast to group room (node --test).
- ADD: reconnect test — no duplicate listeners.
- Unit tests use real units where physical quantities are involved.

### Runtime tests required

- Two emulators/devices in one group: move one, see the other's marker move < ~2 s.
- Kill network 30 s, restore: stream resumes, no duplicates.
- Background the app 2 min: location keeps publishing (or the documented degraded state appears).
- Enable mock locations (dev settings): spoof flag fires; marker shows spoof state.

### Package commands (per repo AGENTS.md)

```bash
cd modules/tracking && npm install && npm run lint && npm run typecheck && npm test
cd modules/routing-eta/server && npm install && npm test   # node --test
cd app && npm install && npm run lint && npm run typecheck && npm test
```

### Phase artifact

Create/update `docs/IMPLEMENTATION/PHASE1_PERSON_A.md` with PASS / FAIL / BLOCKED for every requirement above. **Do not start Phase 2 until every acceptance box is PASS or explicitly BLOCKED-with-reason.**

---

## PHASE 2 — PERSON B: Hazards + SOS

> Starts only after Phase 1 acceptance is met.

### Audit findings (re-verified current status)

| # | Finding | Current status |
|---|---|---|
| B-P0-1 | HLC dash vs colon | CONFIRMED — fix B to colon; fix B's dash-format test; fix `triggerClustering`'s `.split('-')` |
| B-P0-2 | Hazard/SOS layers outside MapView | CONFIRMED — `SosOverlay`, `HazardOverlay` mounted after `</MapboxGL.MapView>`; MapScreen TODO still open |
| B-P0-3 | Rules deny `groups/{groupId}/reports` | CONFIRMED — client writes that path; rules only allow top-level `hazard_reports` |
| B-P0-4 | SOS/hazard buttons + `startSyncWorker` unmounted | CONFIRMED — zero call sites in `app/src` |
| B-P0-5 | FCM token never saved | CONFIRMED — `App.tsx` only requests permission |
| B-P1-6 | `submitHazardReport` online path no try/catch | CONFIRMED — `hazardService.ts:86-94` |
| B-P1-7 | No cold-start sync | CONFIRMED — `App.tsx` starts nothing |
| B-P1-8 | Clustering authority (§7) undecided | VERIFY — decide: server-side clustering; client clusters only as offline fallback |
| B-P2-9 | `demo-group`/`demo-rider` fallbacks, dead `hazardMarker.ts` | CONFIRMED — `HazardReportSheet.tsx:44-45`; verify `hazardMarker.ts` is unimported, then delete |

### Files involved

- `modules/hazard-sos/src/hlc/hlc.ts`, `dbscan/`, `crdt/`, `services/hazardService.ts`, `services/sosService.ts`, `crdt/syncWorker.ts`, `ui/HazardReportButton.tsx`, `ui/HazardReportSheet.tsx`, `ui/SosButton.tsx`, `ui/hazardMarker.ts`
- `app/src/screens/map/MapScreen.tsx`, `app/src/screens/map/overlays/SosOverlay.tsx`, `HazardOverlay.tsx` (check contents — may already host report UI)
- `app/src/App.tsx` (cold-start sync, FCM token save)
- `infra/firebase/firestore.rules`, `infra/firebase/functions/` (SOS FCM trigger)
- `contracts/` hazard/SOS schemas (frozen)

### Confirmed bugs

1. HLC format mismatch — silent map-killer for staleness (compounds A-P0-1 fix).
2. Firestore rules reject the client's actual write path — every online hazard report currently fails, and with no try/catch the failure propagates and the report is lost (B-P0-3 × B-P1-6 compound).
3. Nothing the user can tap: report/SOS buttons and the sync worker exist but are unreachable.

### Missing functionality

- Mount hazard report button + sheet and SOS button in the map UI (inside the new tab shell from Phase 4 — but the mounting/wiring is Phase 2's job; Phase 4 skins it).
- `startSyncWorker()` at app init + one cold-start sync pass.
- FCM: login → `getToken()` → save to `users/{uid}` → Cloud Function on SOS → push to group.
- try/catch on the online write path with offline-queue fallback (zero data loss).
- Initial sync + reconnect sync with duplicate prevention (idempotency keys on report/sos ids).
- Remove `demo-group`/`demo-rider` permanent fallbacks (explicit "no group" state instead).

### Dependencies

- Phase 1 (location stream + canonical HLC clock). B consumes A's clock — do not create a third.

### Implementation tasks

1. **HLC:** change `HLC.toString()` to colon format; update `HLC.parse` (keep lenient, emit canonical); fix `triggerClustering`'s split; correct B's test to assert the colon format (fix the test, don't delete it); point B's persistence at the shared clock from Phase 1.
2. **Map layers:** move hazard/SOS `ShapeSource`+`Layer` components inside `<MapboxGL.MapView>`; keep cards/sheets/panels as RN views outside.
3. **Rules:** add `match /groups/{groupId}/reports/{reportId}` — allow create/update by authenticated group members, read by members; keep everything else as-is. Deploy with `firebase deploy --only firestore:rules`. Verify with the emulator (`firebase emulators:start --only firestore,auth`).
4. **Mounting:** mount `HazardReportButton` + `HazardReportSheet` and `SosButton` (or their overlay equivalents) in the map screen; wire SOS confirmation modal per the SOS flow.
5. **Sync:** call `startSyncWorker()` in `App.tsx` init; add one cold-start sync pass; ensure idempotent uploads.
6. **Zero data loss:** wrap the online write in try/catch → on failure, enqueue to the offline queue.
7. **FCM:** save token on login and on token refresh; verify the Cloud Function trigger end to end.
8. **Decide §7** and document the clustering authority; delete dead `hazardMarker.ts` after verifying zero imports.

### Verification tasks

- Rules: attempt unauthorized write (non-member) → denied; member write → allowed (emulator).
- Offline: airplane mode → report hazard → queued in MMKV → reconnect → synced exactly once (check Firestore, no dupes).
- SOS: trigger → confirmation → persists offline → syncs → other rider gets FCM (or the documented degraded state if FCM isn't configured).
- Hazard appears on map inside MapView; info card opens; clustering merges nearby reports.

### Acceptance criteria

- [ ] Hazard report can be triggered from UI and reaches persistence
- [ ] Offline report queues; reconnect syncs it exactly once
- [ ] Hazard clustering works; markers appear inside the map
- [ ] SOS can be triggered from UI; persists offline; syncs after reconnect
- [ ] Other riders receive SOS (push or in-app, per scope)
- [ ] Firestore rules allow intended ops and deny unauthorized ops (verified, not assumed)
- [ ] FCM token stored on login/refresh (if notifications in scope)
- [ ] No data loss on failed writes (try/catch → queue)
- [ ] HLC colon-canonical across A, B, server; staleness colors correct
- [ ] No `demo-group`/`demo-rider` fallbacks in production paths

### Tests required

- Existing 10 B tests keep passing; the HLC test is corrected to the colon format.
- ADD: rules test (emulator) — allowed/denied matrix for `groups/{groupId}/reports`.
- ADD: offline→reconnect sync test — exactly-once delivery.
- ADD: try/catch fallback test — failed online write lands in the queue.

### Runtime tests required

- Two devices: device 1 reports hazard offline, reconnects; device 2 sees the cluster marker.
- Device 1 triggers SOS; device 2 receives notification; resolve flow works.
- Cold start with queued reports: app launch triggers sync without user action.

### Package commands

```bash
cd modules/hazard-sos && npm install && npm run lint && npm run typecheck && npm test
cd infra/firebase/functions && npm install && npm run lint
cd app && npm install && npm run lint && npm run typecheck && npm test
```

### Phase artifact

Create/update `docs/IMPLEMENTATION/PHASE2_PERSON_B.md` — PASS / FAIL / BLOCKED per requirement. **Do not start Phase 3 until acceptance is met.**

---

## PHASE 3 — PERSON C: Routing + ETA

> Starts only after Phases 1 and 2 acceptance is met.

### Audit findings (re-verified current status)

| # | Finding | Current status |
|---|---|---|
| C-P0-1 | `handleRoute` straight-line mock | CONFIRMED — `astar.js:225` TODO, `:252` straight line |
| C-P0-2 | No road graph data | CONFIRMED — scope decision: **Option A** (Mapbox Directions + post-process) |
| C-P0-3 | km vs meters unit mismatch | CONFIRMED — `astar.js:229` km weights; haversine meters |
| C-P0-4 | Route line outside MapView | CONFIRMED — `RouteOverlay`'s `ShapeSource` lives in an RN `<View>` outside the map |
| C-P0-5 | `active_hazards` never sent / `avoid_hazard_types` ignored | CONFIRMED — no client references; server ignores the field |
| C-P0-6 | NYC hardcoded destination | CONFIRMED — `RouteOverlay.tsx:37` |
| C-P1-7 | Sidecar undeployed; hollow features | CONFIRMED — no deploy config; only `distance_km` passed |
| C-P1-8 | In-place graph mutation | VERIFY — read `applyHazardPenalties` paths during implementation |
| C-P1-9 | Duplicated penalty/safety implementations | VERIFY — dedupe to one source of truth |
| C-P1-10 | localhost:3000 ×3 (+1 regression) | CONFIRMED — `RouteOverlay.tsx:58`, `socketService.ts:9`, `routingClient.ts:38`; env override was removed in `8439964` — restore it |

### Files involved

- `modules/routing-eta/server/astar.js`, `hazard_penalty.js`, `safety_score.js`, `road_graph.js`, `eta_model.js`, `index.js`, `training/` (reference only — model already trained)
- `modules/routing-eta/src/client/routingClient.ts`, `routeStore.ts`, `routeLine.ts`, `deepLink.ts`
- `app/src/screens/map/overlays/RouteOverlay.tsx`, `RoutePanel.tsx`, `app/src/screens/GroupListScreen.tsx`
- `app/src/services/socketService.ts` + new shared server-URL config
- `contracts/route_contract.json` (frozen — the request/response shape; `active_hazards` addition needs contract review per repo rules)

### Confirmed bugs

1. The routing endpoint is a straight-line mock with its own TODOs still in the body.
2. Unit mismatch voids A* optimality (1000× heuristic overestimate → greedy search).
3. The hazard→reroute loop is dead at both ends.
4. Every route on every phone goes to New York.

### Missing functionality (per Option A scope)

- Mapbox Directions integration: base route fetch → post-process against active hazard clusters → if the route passes within R of a hazard, request an alternative avoiding that area (this is "reroute around hazards", not true safety-weighted A* — per spec).
- `handleRoute` composition: validate → Mapbox base route → hazard post-process → safety score → ETA (sidecar or heuristic fallback) → contract response.
- Client: destination picker (tap-to-set / search) replacing `MOCK_DESTINATION`.
- Client: send `active_hazards`; server: consume `active_hazards` + `avoid_hazard_types`.
- Real ETA features: turn count from geometry, hazard count near path, hour/weekday, speed limit (no more constant-40 placeholders where computable).
- Sidecar deploy config (compose/systemd) for dev; documented prod path.
- Central server-URL config (dev/prod), restoring the env override.

### Dependencies

- Phase 1 (origin = verified location), Phase 2 (hazard clusters feed rerouting).

### Implementation tasks

1. **Units first:** meters everywhere in `astar.js`/`road_graph.js`; rewrite optimality/admissibility tests with real units (the current unitless tests cannot catch this).
2. **Option A integration:** Mapbox Directions client in the server; hazard post-processing (route-vs-cluster proximity check; alternative request on conflict). Document the Mapbox token as a manual setup step — do NOT invent one.
3. **Compose `handleRoute`** per the intended pipeline (destination → request → Mapbox → hazards → penalties → safety → ETA → response). Keep A* + penalty + safety-score modules as the unit-tested algorithmic core (they remain the source of truth for hazard weighting logic used in post-processing).
4. **Hazard loop:** add `active_hazards` to the request type/serializer (contract review required); consume server-side with `avoid_hazard_types`.
5. **Map:** move the route `ShapeSource`/`LineLayer` inside `<MapboxGL.MapView>`; keep `RoutePanel` outside.
6. **Destination:** build the picker flow; thread from UI → `routeRequest`; delete `MOCK_DESTINATION`.
7. **ETA:** deploy sidecar for dev; feed real features; keep the heuristic fallback when the sidecar is unreachable (log it, don't hide it).
8. **Hygiene:** dedupe penalty/safety implementations; clone-before-penalize; centralize server URL config; fix the `8439964` localhost regression.

### Verification tasks

- POST /route with a real origin/destination → real road geometry back (not a straight line).
- Place a hazard cluster on the route → recalculation returns an avoiding alternative; safety score drops/rises accordingly.
- Toggle avoid-hazards off → route ignores hazards (behavioral change confirmed).
- ETA changes with hazard count and time of day (not just distance).

### Acceptance criteria

- [ ] User can specify a destination (no NYC hardcode in production flow)
- [ ] Route request valid; real route geometry returned and rendered on Mapbox
- [ ] Hazard penalties actually influence route selection (demonstrated, not asserted)
- [ ] Safety score computed from actual route/hazard data
- [ ] ETA from the intended pipeline (sidecar when available, logged fallback otherwise)
- [ ] Avoid-hazards control changes route behavior
- [ ] Route recalculates after relevant hazard changes (<1 s target measured, not mocked)
- [ ] No localhost dependency for physical-device operation

### Tests required

- Existing C tests keep passing; optimality/admissibility rewritten with real units.
- ADD: `recalc_latency_under_1s` against a real (Option A) pipeline — no mocked fetch.
- ADD: `eta_panel_updates` (app), `group_list_create_join` (app).
- ADD: hazard-avoidance behavioral test — hazard on route → alternative returned.

### Runtime tests required

- Two devices, one group: rider A sets destination; route renders on both; rider B reports hazard on the route; both see recalculation.
- Sidecar down: ETA falls back with a visible/logged degraded state, route still works.

### Package commands

```bash
cd modules/routing-eta && npm install && npm run lint && npm run typecheck && npm test
cd modules/routing-eta/server && npm install && npm test   # node --test
cd app && npm install && npm run lint && npm run typecheck && npm test
```

### Phase artifact

Create/update `docs/IMPLEMENTATION/PHASE3_PERSON_C.md` — PASS / FAIL / BLOCKED per requirement. **Do not start Phase 4 until acceptance is met.**

---

## PHASE 4 — UI/UX: Frontend + Design System + Demo Matching

> Starts only after Phases 1–3 acceptance is met. The app must be rebuilt to match the demo **exactly** — no redesign latitude.

### Audit findings (re-verified current status)

| # | Finding | Current status |
|---|---|---|
| UI-P0-1 | theme.ts is the wrong design system | CONFIRMED — zero demo tokens present |
| UI-P0-2 | Fonts not bundled | CONFIRMED — no font files in `app/android` / `app/ios` |
| UI-P0-3 | No 6-tab navigation | CONFIRMED — only `RootStack` |
| UI-P0-4..5 | HOME / ALERTS tabs | MISSING — build |
| UI-P1-6..9 | STOPS / VOICE / FAMILY / HISTORY tabs | MISSING — build |
| UI-P1-10 | Material Icons vs demo emoji iconography | CONFIRMED — swap |
| UI-P2-11 | Music/Spotify | No integration — UI/state architecture only, clearly labeled placeholder |
| — | `docs/UIUX_MASTER_DESIGN_SPEC.md` | MISSING — author from the demo HTML first |

### Files involved

- `WeRide_DEMO (1).html` — the visual/structural source of truth (read it fully; it is the spec)
- `docs/UIUX_MASTER_DESIGN_SPEC.md` — **to be authored** (tokens, type scale, spacing, components, tab specs)
- `app/src/theme/theme.ts` — full rewrite on demo tokens (note: repo AGENTS.md says theme.ts is Person C-owned — coordinate, don't edit casually)
- `app/src/navigation/` — new `TabNavigator` (HOME/STOPS/VOICE/FAMILY/ALERTS/HISTORY) under Login → Groups → Ride shell
- `app/src/screens/` — six tab screens + ride header context (ride name, origin, destination, start time, LIVE state)
- Font assets + native registration (Android `res/font`, iOS `Info.plist` + Xcode)

### Design system (from the demo — implement exactly)

- Backgrounds: `#0A0A0A`, `#111111`, `#1A1A1A`; borders `#2A2A2A`
- Text: `#F0F0F0` primary, `#888888` secondary; accent `#FF5C00`
- Status/rider colors per the design spec doc
- Fonts: Bebas Neue (display/stat numbers), Inter (body/UI), Space Mono (technical labels)
- Icons: demo emoji set (🏠 📍 🎙️ 👪 ⚠️ 🏆 ⛽ ☕ 🍽️ 🏁) — consistent visual language, no random substitution

### App shell

Login → Groups → Ride → six-tab shell. Ride header context: ride name, origin, destination, start time, LIVE state.

### Tab build order (each tab: layout → real data wiring → states)

1. **theme.ts rewrite** (tokens only — unblocks everything)
2. **Font bundling** + on-device render verification (font failures are silent — verify before building on top)
3. **Tab shell** (bottom nav, dark, orange active state, demo iconography)
4. **HOME** — map, rider markers (Phase 1 data), LIVE pill, stale states, connection-loss + resync banners, quick signals + toast, SOS FAB + confirmation modal + active SOS feedback, compass, route bottom sheet (Phase 3 data), rider avatar stack + count, convoy status, next stop, music mini-player, fuel banner, stop markers, route info. Every control must work — no dead buttons.
5. **ALERTS** — active count, quick report chips, hazard cards (distance, timestamp, reporter, severity); reporting functional (Phase 2 flows)
6. **STOPS** — stop progress, nodes, upcoming/current/completed states, details, status tags; backed by the real ride/session model, no permanent fake data
7. **VOICE** — demo UI only; WebRTC transport DEFERRED; mic permission handling stays functional; degraded state must be honest
8. **FAMILY** — sharing toggle, live tracking link, copy link, watchers, notified/watching states; minimum backend contract if needed, no fake permanent data
9. **HISTORY** — total KM, rides, cities, ride cards, route summary, statistics, share card; real ride-session persistence if required
10. **Music** — UI/state architecture only, explicitly labeled placeholder (no fake Spotify integration)

### Toasts/feedback

One demo-style toast system (loading / success / failure / empty / offline) replacing scattered ad-hoc feedback. Every important action gets all five states.

### Dependencies

- Phases 1–3 (real data for HOME, ALERTS, STOPS). UI may scaffold with the tab shell + theme first, but no tab ships on fake permanent data.

### Verification tasks

- Side-by-side demo-vs-app review per tab: layout, navigation, colors, typography, spacing, cards, pills, buttons, sheets, modals, status states.
- Font render check on a real device (screenshot each family).
- Tap every visible control; each must do its thing or show its honest empty/offline/degraded state.

### Acceptance criteria

- [ ] Visually matches the demo in layout, colors, typography, spacing, components
- [ ] Fonts actually render on-device (verified, not assumed)
- [ ] All six tabs navigable; every interactive element works
- [ ] No dead buttons; no permanent fake data; placeholders explicitly labeled
- [ ] Toast system covers loading/success/failure/empty/offline

### Tests required

- Component/render tests for the tab shell and each tab (app `__tests__/`).
- Navigation test: Login → Groups → Ride → all six tabs.

### Runtime tests required

- Full visual pass on a real Android device; screenshot comparison against the demo per tab.

### Phase artifact

Create/update `docs/IMPLEMENTATION/PHASE4_UIUX.md` — PASS / FAIL / BLOCKED per requirement.

---

## PHASE 5 — Cross-Module Integration

> Starts after Phases 1–4 are individually complete. This phase finds the seams.

Verify each data flow end to end and check specifically for:

- **Contracts:** snake_case vs camelCase mismatches; wrong field names; frozen `contracts/` schemas vs actual payloads (any change needs all-4-member review)
- **HLC:** one canonical `physical:counter` format and one shared clock across A, B, server
- **State:** stale Zustand state; duplicate socket listeners; leaked subscriptions; incorrect cleanup on unmount
- **Identity:** wrong group IDs, rider IDs, auth state (no `demo-group`/`demo-rider` in production paths)
- **Time:** incorrect timestamps; non-monotonic HLCs across restarts
- **Map:** every Mapbox `ShapeSource`/`Layer` inside `<MapboxGL.MapView>`; panels outside
- **Network:** socket rooms correct per group; no localhost URLs in device builds; env config per dev/prod
- **Firebase:** rules match actual code paths; auth-gated reads/writes verified in emulator

### Flow checklist

- [ ] A: Tracking → Server → Riders Store → Map UI
- [ ] B: Hazards → Firestore → Clustering → Map → Routing (reroute trigger)
- [ ] B: SOS → Offline persistence → Sync → Firestore → Notification
- [ ] C: Destination → Routing → Hazards → Safety → ETA → Map/UI
- [ ] UI: all modules → real data (no fake feeds)

### Phase artifact

Integration findings appended to `docs/MASTER_IMPLEMENTATION_FINAL_REPORT.md` §6 as they're found and fixed.

---

## PHASE 6 — Complete End-to-End Test

> Only after all previous phases pass. One complete E2E pass of the actual application on a real Android device if available; otherwise emulator (mark what couldn't be physically verified).

### Happy-path script (30 steps)

1. Fresh launch 2. Authentication 3. Group creation 4. Group joining 5. Ride entry 6. Home screen 7. Map 8. Location permission 9. Tracking 10. Rider marker 11. Stale rider behavior 12. Hazard loading 13. Hazard reporting 14. Hazard clustering 15. SOS 16. Offline SOS 17. Reconnect 18. SOS synchronization 19. Routing 20. Destination selection 21. Hazard-aware rerouting 22. ETA 23. Stops 24. Voice UI 25. Family 26. Alerts 27. History 28. Navigation between all six tabs 29. Logout 30. Login again

### Failure cases (must fail gracefully)

Location permission denied · microphone permission denied · no internet · Firebase unavailable · Mapbox unavailable · socket disconnected · routing unavailable · empty group · no hazards · stale rider · Firestore write failure.

### Phase artifact

E2E results → `docs/MASTER_IMPLEMENTATION_FINAL_REPORT.md` §8.

---

## Automated verification (per phase)

After each phase, in every touched package (repo has no workspace root — per-package):

```bash
npm run lint && npm run typecheck && npm test
```

At final stage: **ALL TESTS MUST PASS.** Do not reduce coverage. Do not modify tests to turn red into green unless the test itself is proven incorrect (B's HLC dash test is the known exception — correct it to the canonical format).

---

## Runtime verification

Collect per phase: Android logcat, Metro logs, network errors, Firebase errors, Mapbox errors, socket errors. Classify each as CRITICAL / HIGH / MEDIUM / LOW / EXPECTED. Do not hide warnings. Runtime evidence goes in the final report §9.

---

## Final master report template

Create `docs/MASTER_IMPLEMENTATION_FINAL_REPORT.md`:

1. Initial audit summary
2. Person A — originally broken / fixed / remaining / verification
3. Person B — originally broken / fixed / remaining / verification
4. Person C — originally broken / fixed / remaining / verification
5. UI/UX — originally missing / implemented / remaining / verification
6. Cross-module integration
7. Test results
8. E2E results
9. Runtime results
10. Configuration requirements (credentials, tokens, manual steps)
11. Deferred functionality (VOX WebRTC, FL, Option B A*)
12. Remaining blockers

Feature status vocabulary (only these): **IMPLEMENTED + VERIFIED** / **IMPLEMENTED + NOT VERIFIED** / **PARTIALLY IMPLEMENTED** / **DEFERRED** / **BLOCKED**. No "should work".

---

## Final success condition

Complete only when: A works AND B works AND C works AND UI works AND the modules communicate correctly AND the complete user journey works end to end — verified by the Phase 6 E2E run, documented in the final report.

---

## ⛔ PLAN GATE — STOP HERE

This plan is complete up to the implementation gate. **No code has been written.** Next step: review this plan, then approve Phase 1 to begin. Suggested supporting docs to create alongside implementation:

- `docs/SETUP_CREDENTIALS.md` — Mapbox token, Firebase config, FCM setup (manual steps; no invented secrets)
- `docs/UIUX_MASTER_DESIGN_SPEC.md` — authored from the demo HTML (Phase 4 prerequisite)
- `docs/IMPLEMENTATION/PHASE{1,2,3,4}_{PERSON_A,PERSON_B,PERSON_C,UIUX}.md` — per-phase PASS/FAIL/BLOCKED logs
