# Phase 6 — Final Local E2E Verification Log

Date: 2026-09-26. No new broad implementation changes were made in this phase
(only verification work).

## 1. Environment

- Container: Linux, 2 vCPU, ~7 GB RAM (1 GB free), 7 GB free disk.
- `adb`: not installed. Android SDK: absent. Java: absent. `/dev/kvm`: absent.
- Paired devices (`device.list`): none. The user is on web; no phone is paired.
- Network: available (used for nothing credentialed).

### Emulator feasibility evaluation (documented, not attempted blindly)

Installing cmdline-tools + platform-tools + emulator + system image + JDK 17
needs ~3 GB download / ~5 GB installed, then a Gradle `assembleDebug` (needs
3 GB+ heap) and a KVM-less x86_64 emulator boot (15–45 min on 2 shared vCPUs,
frequent hangs) on a box with 1 GB free RAM. Expected outcome: OOM or
multi-hour failure, with no path to a stable result. The device-dependent steps
below are therefore recorded as BLOCKED BY DEVICE, per the Phase 6 failure
handling rules — not skipped, not mocked.

## 2. Runtime verification actually performed

### 2a. Routing + Socket.io server (live, PORT=3101)

`PORT=3101 node index.js` — booted clean, `WeRide server on :3101`.

| Check | Result |
|---|---|
| `POST /route` with `{}` | **PASS** — HTTP 400, server stays up (validation path) |
| `POST /route` valid Pune→Lonavala shape, no Mapbox token | **PASS** — HTTP 200, full contract response (`route_id`, `path_points`, `distance_km: 54.14`, `eta_minutes`, `safety_score`, `recalculated_at_hlc: "1790432054347:1"`). Server log shows the designed degradation: `MAPBOX_ACCESS_TOKEN unset — degraded straight-line routing`, ETA heuristic fallback. No crash. |
| Live response vs frozen `contracts/route_contract.json` | **PASS** — all 6 required fields present, types/bounds OK, HLC colon format with advancing counter (`…:0` → `…:1` across requests) |
| Socket.io: 2 clients connect | **PASS** |
| `join-group` + `location:update` fanout to room member | **PASS** — payload delivered intact |
| No echo to sender | **PASS** |
| Malformed payloads (bad lat type, missing `rider_id`) dropped | **PASS** — receiver got 0 |
| Cross-group isolation (`g1` vs `g2`) | **PASS** |
| `leave-group` stops delivery | **PASS** |

7/7 socket checks passed via a real `socket.io-client` script (removed after the run).

### 2b. Metro bundler — full Android JS bundle

`node node_modules/react-native/cli.js start` (RN 0.73.11) → dev server ready.
`GET /index.bundle?platform=android` → **HTTP 200, 9,190,097 bytes**.
Bundle contains all Phase 4/5 code: `Inter-Regular`, `BebasNeue-Regular`,
`SpaceMono-Regular`, `location:update` (11×), `join-group` (3×), `Up next`,
`Kesariya`, tab navigator (65 matches). **PASS** — every import in the app
(including `@tracking/*`, `@hazard/*`, `@routing/*` aliases) resolves and
compiles under Metro's own transform, independent of jest's module mapping.

## 3. E2E step checklist

**PASS (runtime, this phase):** server boot · route validation path ·
degraded-mode routing + contract conformance · socket fanout/no-echo/drop/
isolation/leave (7 checks) · Metro full-bundle compile · bundle content check.

**BLOCKED BY CONFIGURATION** (external credential/service; exact requirement):
- Firebase configuration — needs a Firebase project, `google-services.json` in
  `app/android/app/`, `.firebaserc` (`firebase login` + `firebase use --add`;
  deliberately uncommitted). Blocks: login, group create/join (Firestore),
  hazard persistence, offline hazard sync, SOS sync, Firestore rule enforcement.
- Mapbox token — needs `MAPBOX_ACCESS_TOKEN` in `app/.env` with Directions +
  Maps SDK scopes. Blocks: map tile rendering, road-based routing (server falls
  back to straight-line, verified above), turn-by-turn.
- `ROUTING_URL` / `SOCKET_URL` / `ETA_SIDECAR_URL` — needs a reachable deployed
  server. Blocks: production routing/ETA/socket endpoints on device.

**BLOCKED BY DEVICE** (no emulator or physical Android device available):
- Install/build APK (`assembleDebug` — no Android SDK/Java/KVM; see §1)
- App launch without crash
- All six navigation tabs reachable
- Map rendering, current location, live rider tracking, rider markers
- Anti-spoof/NIS on-device behavior
- Hazard reporting UI, hazard persistence UI, offline hazard behavior,
  reconnect/synchronization UI
- SOS UI (hold-to-confirm, modal, info cards)
- Destination selection, real route generation on map, hazard-aware rerouting UI,
  ETA display
- Alerts / Stops / Voice / Family / History screens as rendered
- Loading states, empty states, error states, permission flows (location, mic)
- Complete crash-free application flow

### UI runtime verification (theme, fonts, spacing, header, tab bar, Map screen,
### bottom sheets, rider markers, hazard UI, SOS UI, Alerts, Stops, Voice,
### Family, History)

**BLOCKED BY DEVICE** — every item. Not marked PASS: per the Phase 6 rule, a
component existing or its test passing is not render verification. Static
evidence only: fonts are bundled/registered on both platforms (Phase 4 log),
theme tokens match the demo spec, and the Metro bundle compiles with all
screens included.

## 4. Failures encountered / fixes performed

None in the runtime checks performed — no crashes, no contract violations, no
dropped valid messages. No fixes were required, so no rebuild and no
regression re-run was triggered by this phase. (Full regression state from
2026-09-26: 473/473 tests, 0 lint errors, 0 type errors — unchanged, since no
implementation code was touched.)

## 5. Remaining limitations

1. Nothing in this phase renders on a screen — the single largest unverified
   area remains on-device execution.
2. Firestore security rules are verified statically only (no emulator).
3. Mapbox road-based routing is verified by code path only (no token).
4. Family circle is demo data (TODO: contacts source) — noted in Phase 4 log.
5. All Phase 1–6 work remains uncommitted on top of `3570fde`.

## Final status: BLOCKED

Blocked by device (no Android emulator or physical device in this environment;
emulator install evaluated infeasible — §1) and by configuration (Firebase
project, Mapbox token, server URLs — exact requirements in
`docs/SETUP_CREDENTIALS.md`). Every runtime check that could be performed
without those passed (server 9/9, socket 7/7, Metro bundle 2/2). No genuine
application defect was found; no failure was hidden, mocked, or downgraded.
