# WeRide Full Application Audit

Date: 2026-09-15 (Asia/Karachi)
Scope: complete end-to-end audit per phase 0–16 instructions, plus fixes.

---

## 1. Executive summary

The app launches on Android but had **one fatal crash** and **four high-severity runtime failures**, plus a large set of dead-code wiring gaps where UI existed but backend was never connected. This audit traced each failure to root cause and fixed confirmed bugs without changing architecture, contracts, or module boundaries.

| Area | Before | After |
|---|---|---|
| Android build | PASS | PASS |
| App launch | FATAL crash (logback/slf4j) in background-geolocation logger | PASS — app stays alive |
| Sensor start | `setUpdateIntervalForType is not a function` | Fixed — correct API, correct unit (ms) |
| Firestore hazard/SOS writes | permission-denied | Rules fixed in repo; **deploy is a manual step** (no CLI login on this machine) |
| Mapbox | HTTP 401 style load | Root cause: `MAPBOX_TOKEN` empty in `.env` — **manual token entry required** |
| Voice | `SecurityError: Permission denied` | Mic permission requested before `getUserMedia`, denied-UX added, Android/iOS declared |
| Rider markers | Dead code (store never subscribed) | Wired + cleanup |
| Tests | mixed failures | 446 passing / 0 failing across all packages |

---

## 2. Critical bugs (fixed)

### C1 — FATAL: logback ClassCastException at launch
- **Feature:** app startup (background-geolocation)
- **File:** `app/android/app/build.gradle`
- **Problem:** `java.lang.ClassCastException: org.slf4j.helpers.SubstituteLogger cannot be cast to ch.qos.logback.classic.Logger` in `TSLog` killed the process within seconds of launch.
- **Root cause:** `com.github.tony19:logback-android` was resolved in the library's dependency graph but not packaged into the app APK (jitpack repo + app-level packaging gap).
- **Severity:** CRITICAL (app crash)
- **Fix:** added `implementation("com.github.tony19:logback-android:2.0.1")` + `slf4j-api` to app dependencies; added `maven { url 'https://jitpack.io' }` to repositories.
- **Verification:** `adb logcat` after rebuild+reinstall shows zero FATAL exceptions; process stays alive.
- **Status:** FIXED / verified on emulator.

### C2 — TrackingService start failed: `setUpdateIntervalForType is not a function`
- **Feature:** tracking (Person A)
- **File:** `modules/tracking/src/sensorStream.ts:91`
- **Problem:** the earlier edit called `accelerometer.setUpdateIntervalForType(...)` — no such method exists on the sensor observables; it's a **separately exported function** (verified in installed `react-native-sensors@7.3.6` `index.js:2`). Also the value passed (100000) was microseconds while the JS API takes **milliseconds** (verified in `RNSensor.java`: `registerListener(..., interval * 1000)` — native converts ms→µs).
- **Root cause:** wrong API surface + wrong unit; comment claimed "10 Hz" next to 100000 (which would be 0.01 Hz).
- **Severity:** CRITICAL (tracking unusable)
- **Fix:** `import { setUpdateIntervalForType } from 'react-native-sensors'`; call with `100` (ms) = 10 Hz hardware rate, matching the ~1 Hz EKF aggregation design.
- **Verification:** module test suite (92 tests) green; `sensorStream.test.ts` mock updated to export the function; verified against installed package source.
- **Status:** FIXED.

### C3 — Mapbox style HTTP 401
- **Feature:** map (all map-dependent features)
- **File:** `app/.env` (token), `app/src/screens/map/MapScreen.tsx:53`
- **Problem:** `RNMBXMapView` style load failed 401.
- **Root cause (proven):** `app/.env` contains `MAPBOX_TOKEN=` with an **empty value** (file is 13 bytes: literal `MAPBOX_TOKEN=` + newline). `MapboxGL.setAccessToken('')` → Mapbox API returns 401. Confirmed independently: `curl https://api.mapbox.com/styles/v1/mapbox/dark-v11?access_token=` → 401. Token injection path itself is correct (`@env` → babel dotenv → `setAccessToken`).
- **Severity:** CRITICAL (map unusable)
- **Fix:** none possible from code — **manual configuration step**: paste a valid Mapbox public token (pk.…) into `app/.env` as `MAPBOX_TOKEN=<token>`. Code was verified correct so no code change needed.
- **Status:** BLOCKED on manual credential entry. (Everything else on the map path — overlays, camera follow, user location — is now wired.)

### C4 — Voice SecurityError (mic permission)
- **Feature:** VOX intercom (Person D)
- **Files:** `modules/fl-voice/src/vox/micPermission.ts` (new), `app/src/screens/VoiceScreen.tsx`, `AndroidManifest.xml`, `ios/weride/Info.plist`
- **Problem:** `VoxClient.start()` calls `getUserMedia` with no microphone permission declared or requested → `SecurityError: Permission denied` on Android.
- **Root cause:** `RECORD_AUDIO` missing from manifest; no runtime request; iOS `NSMicrophoneUsageDescription` absent.
- **Severity:** CRITICAL (feature unusable + unhandled UX)
- **Fix:** (1) added `RECORD_AUDIO` to AndroidManifest; (2) new `micPermission.ts` in fl-voice requesting via `PermissionsAndroid` (Android) / audio-session (iOS); (3) VoiceScreen requests permission *before* constructing/starting VoxClient, shows an explanatory banner when denied, app remains usable; (4) added `NSMicrophoneUsageDescription` + `NSMotionUsageDescription` + real location string to Info.plist; (5) unmount cleanup stops VoxClient and removes socket listener.
- **Status:** FIXED (permission flow); actual audio transport remains stubbed (see H5).

---

## 3. High-priority bugs

### H1 — Firestore permission-denied (hazard + SOS)
- **Files:** `infra/firebase/firestore.rules`, `modules/hazard-sos/src/services/{hazard,sos}Service.ts`
- **Problem:** listeners/writes on `hazards/`, `sos_events/`, and hazard reports failed with `firestore/permission-denied`.
- **Root cause (two layers):**
  1. **Repo rules did not cover the code's real write path**: hazard reports are written to `groups/{groupId}/reports/{id}` (a subcollection) but rules only had a top-level `hazard_reports/{id}` match — subcollection writes fell through to deny-all.
  2. **Rules in the repo were never confirmed deployed** — no Firebase CLI login exists on this machine, so the live project's rules are unknown (possibly default locked rules). Firestore REST probe of the project returns 403 for anonymous reads (expected under secure rules; project is reachable, so the project ID/config is valid).
- **Fix:** rewrote `firestore.rules` to match actual code paths, still secure: reports subcollection rule with group-membership read + own-report create; groups create/join restricted to `arrayUnion`-style membership changes; SOS create restricted to own rider_id + `resolved==false`; hazards create/update require auth + string group_id; deletes denied everywhere.
- **Verification:** rule/collection path audit (all 6 collections matched to code); live end-to-end verification **blocked on `firebase login` + `firebase deploy --only firestore:rules`** (manual).
- **Status:** RULES FIXED IN REPO; **deployment is a required manual step**.

### H2 — ridersStore never subscribed (rider markers dead)
- **Files:** `app/src/screens/map/MapScreen.tsx`, `app/src/store/ridersStore.ts`
- **Problem:** `ridersStore.subscribe(groupId)` had zero callers in `app/src` — other riders' markers, LivePill connectivity, network-lost banner were all dead code.
- **Fix:** MapScreen tracking effect now subscribes on start and unsubscribes on cleanup.
- **Status:** FIXED.

### H3 — MapScreen stale-closure identity bug
- **File:** `MapScreen.tsx` effect deps `[]`
- **Problem:** if userId was null at mount (auth not yet restored), tracking never started even after identity arrived.
- **Fix:** deps `[userId, groupId]` with double-start guard; also added camera `followUserLocation` + `UserLocation` render (map previously showed fixed SF camera with no user dot).
- **Status:** FIXED.

### H4 — Hardcoded `localhost:3000` backend defaults
- **Files:** `app/src/services/socketService.ts:9`, `app/src/screens/map/overlays/RouteOverlay.tsx:57`
- **Problem:** sockets and routing client defaulted to `http://localhost:3000`, unreachable from any Android device/emulator.
- **Fix:** default to `http://10.0.2.2:3000` (Android emulator host alias); overridable via `.env` `SOCKET_URL` / `ROUTING_URL` (wired through `@env`). **Physical devices still need `SOCKET_URL=http://<LAN-IP>:3000` in `.env`** (manual step).
- **Status:** FIXED for emulator; physical-device URL is a documented manual step.

### H5 — VOX WebRTC core is stubbed (Person D TODOs)
- **Files:** `modules/fl-voice/src/vox/voxClient.ts:74-84`
- **Problem:** `_onRemoteSdp`, `_onRemoteIce`, `_onVoiceActive` are empty TODO stubs — no audio is actually exchanged between peers; join signaling only emits `join`.
- **Severity:** HIGH (feature "runs" but doesn't function end-to-end).
- **Fix:** not attempted — implementing full mesh WebRTC is a Person D module feature, out of audit scope (per fixing rules: no rewriting architecture on spec-driven stubs).
- **Status:** OPEN — flagged as known-incomplete per Person D phase plan.

### H6 — Android permissions missing in manifest
- **File:** `AndroidManifest.xml`
- **Problem:** only `INTERNET` + `HIGH_SAMPLING_RATE_SENSORS` were declared. Missing: location (fine/coarse), microphone, notifications (FCM, Android 13+), foreground-service (background-geolocation requirement).
- **Fix:** added `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `RECORD_AUDIO`, `POST_NOTIFICATIONS`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `WAKE_LOCK`. Runtime requests exist in `tracking/permissions.ts` (location) and new mic flow (audio). Background location (`ACCESS_BACKGROUND_LOCATION`) intentionally NOT added — spec defers background tracking (trackingService TODO).
- **Status:** FIXED.

---

## 4. Medium bugs (fixed)

| ID | Issue | File | Fix |
|---|---|---|---|
| M1 | `TrackingService.stop()` didn't reset `_hasInitialFix` → restart used stale fix state | `modules/tracking/src/trackingService.ts:137` | reset on stop |
| M2 | `HazardOverlayInfoCard` early return before `useCallback` (rules-of-hooks violation, latent crash) | `app/src/screens/map/overlays/HazardOverlay.tsx:244` | moved hook above guard |
| M3 | `routing-eta/server` npm test script broken under zsh (`test/**/*.test.js` glob not expanded) | `server/package.json` | `node --test test/` |
| M4 | App `.eslintrc.js` referenced non-existent `react-native/react-native` env → lint crashed | `app/.eslintrc.js` | removed; added `react-hooks` plugin |
| M5 | Duplicate React copies in hazard-sos tests → "reading 'useState' of null" | `modules/hazard-sos/jest.config.js` | mapped `react` to single copy |
| M6 | fl-voice package missing its own deps (socket.io-client, react-native-webrtc, mmkv, react types) → typecheck broken | `modules/fl-voice/package.json` | installed exact versions |
| M7 | `@types/react` 18.3.x in app broke RN 0.73 component typing (TS2786 across overlays) | `app/package.json` | pinned `@types/react@18.2.0` |
| M8 | App tsconfig `@env` path pointed to missing `.env.d.ts` | `app/.env.d.ts` | created with MAPBOX_TOKEN/SOCKET_URL/ROUTING_URL |
| M9 | Server `eta_model.js` calls Flask sidecar at `127.0.0.1:5000` — fine server-side, documented | — | no change (server-side) |

---

## 5. Low-priority issues (documented, not fixed — outside audit fix scope)

- `StopsScreen` renders a hardcoded fake stop ("Destination") from `stopsStore` — placeholder data shown as real.
- `FamilyScreen`: sharing toggle is local-only; member cards show hardcoded "safe / just now"; tracking link is a fake URL.
- `RouteOverlay` destination is a hardcoded `MOCK_DESTINATION` (NYC) — no destination input flow exists (spec: Phase 7 feature).
- `HazardReportButton/Sheet` components in hazard-sos are orphaned (not imported by any screen; AlertsScreen chips serve the same purpose).
- `routeControls` global toggle registry not unregistered on unmount (minor leak).
- `MusicPlayer`, `RoutePanel` turn-by-turn, FCM token registration (`firebaseService.ts:15 TODO`) are spec'd placeholders.
- react-native-sensors `NativeEventEmitter` removeListeners warnings at startup — library-side on RN 0.73; dev-warning only; not patched per fixing rules (would require node_modules patch).

---

## 6. Configuration problems

1. **Mapbox token missing** — `app/.env` `MAPBOX_TOKEN=` is empty. **Manual:** paste pk. token.
2. **Firebase rules not deployed** — no `firebase login` on this machine. **Manual:** `firebase deploy --only firestore:rules` from `infra/firebase/` (or use the emulator suite for local dev).
3. **iOS `GoogleService-Info.plist` missing** (gitignored, never created) — iOS auth/Firestore will fail until added. Android `google-services.json` exists and points to project `aifashionrecommendation-c5e15` (reachable).
4. **Physical device backend URL** — set `SOCKET_URL`/`ROUTING_URL` to the Mac's LAN IP; `adb reverse tcp:8081 tcp:8081` for metro.

---

## 7. Test results (after fixes)

| Package | Lint | Typecheck | Tests |
|---|---|---|---|
| app | 0 errors (48 warnings) | 0 errors | **136/136 pass** |
| modules/tracking | 0 errors | 0 errors | **92/92 pass** |
| modules/hazard-sos | 0 errors | 0 errors | **132/132 pass** |
| modules/routing-eta | 0 errors | 0 errors | **32/32 pass** |
| routing-eta/server (node --test) | — | — | **48/48 pass** |
| modules/fl-voice | 0 errors | 0 errors | **6/6 pass** |
| contracts (JSON validation) | — | — | **7/7 valid** |

Invalid tests fixed (documented per rules):
- `tracking/test/hlcStore.test.ts` expected HLC format `physical:counter`; the canonical HLC (Person B, used by all services + contracts) emits `physical-counter`. Test regex corrected.
- `tracking/test/sensorStream.test.ts` mock lacked the (real) `setUpdateIntervalForType` export — mock updated to match the installed API.
- `routing-eta/test/__mocks__/firebaseMock.js` lacked static `FieldValue` on the module — added (matches real @react-native-firebase API).
- `hazard-sos/test/performance.test.ts` MMKV mock lacked `delete()` (real MMKV v2 API has it) — added.

---

## 8. Android runtime results (emulator-5554; physical device ROW8YD9XLNJB4XTO not connected during audit)

- BUILD: `./gradlew assembleDebug` → BUILD SUCCESSFUL.
- INSTALL: success; launch → app process alive, login screen renders (WERIDE / Email / Password / Sign In visible via UIAutomator dump).
- logcat: zero FATAL exceptions (logback fix verified); only benign dev warnings remain.
- Full login→ride flow not exercisable without real Firebase credentials/auth + Mapbox token.

---

## 9. Files changed

**App:**
- `app/android/app/build.gradle` (logback deps)
- `app/android/build.gradle` (jitpack repo)
- `app/android/app/src/main/AndroidManifest.xml` (permissions)
- `app/ios/weride/Info.plist` (mic/motion/location strings)
- `app/.env` / `app/.env.example` (SOCKET_URL/ROUTING_URL defaults)
- `app/.env.d.ts` (new), `app/.eslintrc.js`
- `app/src/screens/VoiceScreen.tsx` (permission flow + denied UI)
- `app/src/screens/map/MapScreen.tsx` (riders subscription, camera follow, deps fix)
- `app/src/screens/map/overlays/RouteOverlay.tsx` (env URL)
- `app/src/screens/map/overlays/HazardOverlay.tsx` (hooks fix)
- `app/src/screens/map/overlays/RiderMarkerOverlay.tsx` (event typing)
- `app/src/services/socketService.ts` (env URL)
- `app/src/store/ridersStore.ts` (null-safe unsubscribe)
- `app/src/components/BottomSheet.tsx`, `app/jest.setup.js`, `app/__tests__/mapScreen.test.tsx`, `app/__tests__/riderMarker.test.tsx`
- `app/package.json` (deps: @types/react@18.2.0, @types/node, eslint-plugin-react-hooks, react-native-get-random-values@1.11.0)

**Modules:**
- `modules/tracking/src/sensorStream.ts` (sensor API + 10 Hz fix)
- `modules/tracking/src/trackingService.ts` (fix-state reset)
- `modules/tracking/{permissions,ekfStore,hlcStore,locationPublisher}.ts` + `.eslintrc.js` (lint/import annotations)
- `modules/tracking/test/{sensorStream,hlcStore}.test.ts`, `test/__mocks__/sensorsMock.js` (+ mirrored to hazard-sos/routing-eta/fl-voice)
- `modules/hazard-sos/src/{hlc/hlc,services/hazardService,services/sosService,crdt/syncWorker}.ts` (ts-ignore annotations, MMKV v2/v4 compat, lint)
- `modules/hazard-sos/test/{performance.test.ts,phase6-ui-test-final.tsx}`, `jest.config.js`, `test/__mocks__/firebaseMock.js`, `package.json` (RN 0.73 / react 18.2 alignment)
- `modules/fl-voice/src/vox/micPermission.ts` (new), `package.json` (deps), `.eslintrc.js`
- `modules/routing-eta/test/__mocks__/firebaseMock.js`, `server/package.json` (test script)

**Infra:**
- `infra/firebase/firestore.rules` (complete secure rewrite matching code paths)

---

## 10. Remaining blockers / manual steps

1. **Enter Mapbox token** in `app/.env` (`MAPBOX_TOKEN=pk.…`) — map 401 persists until then.
2. **Deploy Firestore rules**: `firebase login && firebase deploy --only firestore:rules` — hazard/SOS permission-denied persists against the live project until then (or use the Firebase emulator).
3. **iOS `GoogleService-Info.plist`** must be created/downloaded for iOS to work at all.
4. **Physical device testing** (ROW8YD9XLNJB4XTO): reconnect device, `adb reverse tcp:8081 tcp:8081`, set `SOCKET_URL`/`ROUTING_URL` to LAN IP, then re-run the 16-test flow.
5. **VOX WebRTC** signaling/ICE/answer flow is a Person D work item (currently stubbed).
6. Destination input for routing (currently mock NYC destination) — Phase 7 feature per plan.