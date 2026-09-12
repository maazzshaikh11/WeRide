# Phase 4 Implementation Plan — Live Map Rider Markers (UI)

## 1. Phase Objective

Implement the `RiderMarkerOverlay` component per Person A spec §4.1: render rider markers on the Live Map, color-coded by `spoof_flag` and freshness (green/red/grey), powered by Socket.io `location:update` events, with a debug NIS info card on tap. Also wire the Mapbox access token for build-time injection.

---

## 2. Source-of-Truth Requirements (with file + section/line citations)

| # | Requirement | Source | Citation |
|---|---|---|---|
| R1 | Rider markers: one per `verified_location` in current group. Green = `spoof_flag=false` + fresh (<10s). Red = `spoof_flag=true`. Grey = stale (>10s, no recent update). | `Person_A_Tracking_AntiSpoofing.md` §4.1 lines 82–84; `WeRide_Project_Spec.md` §4.2 "Live Map" lines 107 | |
| R2 | Marker updates come from Socket.io `location:update` listener for current group. | `Person_A_Tracking_AntiSpoofing.md` §4.1 line 85 | |
| R3 | Marker tap → small info card: rider name, speed, heading, NIS score (NIS only in debug/profile mode, not main screen). | `Person_A_Tracking_AntiSpoofing.md` §4.1 line 86 | |
| R4 | Late-joiner: open app mid-ride → read Firestore `groups/{gid}/locations/{rider_id}` → show last-known position immediately, then live updates flow over Socket.io. | `WeRide_Project_Spec.md` §8 Week 4 line 271; `Person_A_Tracking_AntiSpoofing.md` §6 Week 4 line 130; `phase3_tasks.md` Task 3.2 | |
| R5 | `verified_location` contract: 10 fields, Socket.io `location:update` + throttled Firestore. | `contracts/verified_location.json` (full file, 23 lines) | |
| R6 | Map uses `@rnmapbox/maps` (locked). | `WeRide_Project_Spec.md` §2 line 31; §9 line 289 | |
| R7 | Design system: shared theme, no hardcoded colors. | `WeRide_Project_Spec.md` §4.3 line 139; `Person_A_Tracking_AntiSpoofing.md` §4.1 line 80 | |
| R8 | `stale_marker_grey` test (spec §7). | `Person_A_Tracking_AntiSpoofing.md` §7 line 153 | |
| R9 | Mapbox token must be wired at build time (RN doesn't support `process.env` directly). | `person1_PhaseWisePlan.md` §Current Status line 35; `phase4_tasks.md` Task 4.5 line 53 | |

---

## 3. Current Repository State

### 3.1 Components that exist and are Phase 3–complete

| Component | File | Status |
|---|---|---|
| `LocationPublisher` | `modules/tracking/src/locationPublisher.ts` | Phase 3 complete. Emits `location:update` on Socket, throttled Firestore write, `fetchLastKnown()`, offline buffering, reconnect flush, error handling. |
| `VerifiedLocationPayload` | `modules/tracking/src/locationPublisher.ts` | Internal tracking type (camelCase: `timestampHlc`, `spoofFlag`, etc.) |
| `VerifiedLocation` | `app/src/models/verifiedLocation.ts` | App-level model (snake_case: `timestamp_hlc`, `spoof_flag`, etc.) with `verifiedLocationFromJson()` |
| `LocationPublisher.fetchLastKnown()` | `modules/tracking/src/locationPublisher.ts:61–89` | Implemented and tested. Returns `VerifiedLocationPayload \| null`. |
| Socket.io client | `app/src/services/socketService.ts` | `getLocationSocket()` singleton, websocket transport. **No room/join API exists.** See §3.4. |
| Firebase Firestore | `app/src/services/firebaseService.ts` | `firebaseFirestore` exported singleton. |
| HLC class | `modules/hazard-sos/src/hlc/hlc.ts` | `HLC` class with `now(): string`, `receive(remote): string`, `compare(a,b): number`, `physical` getter, `toState()/fromState()`. String format: `"<physical_ms>:<counter>"`. **`physical` field is Unix epoch milliseconds** (see `HLC.fresh()` → `new HLC({ physical: n(), counter: 0 })` where `n` defaults to `Date.now()`). |
| HLC persistence | `modules/tracking/src/hlcStore.ts` | MMKV-backed `loadHlc()` / `persistHlc()`. |
| TrackingService | `modules/tracking/src/trackingService.ts` | Wires sensors→ekf→publisher at 1 Hz. Uses HLC. |
| VerifiedLocation contract | `contracts/verified_location.json` | Frozen, all 10 fields. |
| Theme colors | `app/src/theme/theme.ts` | `WeRideColors.riderVerified` (`#2D6A4F`), `riderFlagged` (`#E63946`), `riderStale` (`#9AA0A6`) defined. |
| Mapbox version | `app/package.json` | `@rnmapbox/maps@^10.1.0`. |
| Jest mock for Mapbox | `app/jest.setup.js` | Mocks `@rnmapbox/maps` with string components: `MapView`, `Camera`, `ShapeSource`, `CircleLayer`, `LineLayer`, `SymbolLayer`. |

### 3.2 Components that need creation/modification for Phase 4

| Component | File | Current State | What's Needed |
|---|---|---|---|
| `RiderMarkerOverlay` | `app/src/screens/map/overlays/RiderMarkerOverlay.tsx` | Placeholder `<View/>`. No state, no Socket listener, no markers. | Full implementation: Socket listener via store, Mapbox ShapeSource+CircleLayer, stale timer, tap card. |
| Riders Zustand store | (new) `app/src/store/ridersStore.ts` | Does not exist. | Zustand store (see §4 Task 4.1 for detailed design). |
| `getMarkerState` helper | (new) `app/src/screens/map/overlays/riderMarkerState.ts` | Does not exist. | Centralized marker-state selector (see §4 "Marker State Precedence"). |
| `MapScreen` | `app/src/screens/map/MapScreen.tsx` | Renders `RiderMarkerOverlay` as a sibling `<View>` overlay **outside** `<MapboxGL.MapView>`. `MapView` has no `Camera`, no children. `process.env.MAPBOX_TOKEN` on line 26. | **Observation:** Mapbox `ShapeSource`/`CircleLayer` must be children of `MapView`. This is a Phase 4 requirement — `RiderMarkerOverlay`'s Mapbox layers must move inside `MapView`. Non-Mapbox overlays (SOS button, VOX toggle, etc.) remain sibling Views. No other unrelated `MapScreen` behavior is modified. |
| Mapbox token wiring | `app/src/screens/map/MapScreen.tsx` line 26 | `process.env.MAPBOX_TOKEN ?? ''` — doesn't work in RN. | See Task 4.5 for env mechanism. |
| App-level test infrastructure | `app/__tests__/` | Only `geoUtils.test.ts`. No component tests yet. | No test file creation in this phase — marker logic is testable via the Zustand store (pure JS) + helper functions (pure JS). Rendering requires RN device. |

### 3.3 Key design decisions already made

- **Contract shape on the wire:** snake_case (`spoof_flag`, `nis_score`, `timestamp_hlc`) — matches `contracts/verified_location.json` and what Socket.io emits.
- **Contract shape in tracking module:** camelCase (`spoofFlag`, `nisScore`, `timestampHlc`) — internal to `LocationPublisher` / `VerifiedLocationPayload`.
- **App model:** snake_case via `app/src/models/verifiedLocation.ts` → `verifiedLocationFromJson()` handles conversion.
- **Theme:** `WeRideColors.riderVerified` (green), `riderFlagged` (red), `riderStale` (grey) — already defined in `theme.ts`.
- **Socket event name:** `location:update` — used by `LocationPublisher.publish()` and defined in `socketService.ts` comment.

### 3.4 Dependency / scope audit findings

| Item | Found? | File Path | Sufficient for Phase 4? |
|---|---|---|---|
| `socketService` API | ✅ Found | `app/src/services/socketService.ts` | Partially. Provides `getLocationSocket()` singleton with `connect()`. **No room/join/leave API exists.** Phase 4 will listen to the global `location:update` stream and filter by `group_id` client-side. Room joining deferred to Phase 6. |
| `verifiedLocationFromJson` parser | ✅ Found | `app/src/models/verifiedLocation.ts:16–28` | Partially. Parses snake_case fields but does **not validate** required fields — `j.rider_id` on `undefined` becomes `undefined`, `Number(undefined)` becomes `NaN`, `Boolean(undefined)` becomes `false`. Guard logic needed in the store (see Task 4.1). |
| `@rnmapbox/maps` version | ✅ Found | `app/package.json` — `^10.1.0` | Sufficient. `ShapeSource`, `CircleLayer`, `Camera` are all available in this version. Data-driven `circle-color` expressions are supported. |
| `MapScreen` architecture | ✅ Found | `app/src/screens/map/MapScreen.tsx` | Needs modification: `RiderMarkerOverlay` must become a child of `MapView` (Mapbox layers only). No other `MapScreen` behavior changes. |
| Theme colors | ✅ Found | `app/src/theme/theme.ts:19–22` | Sufficient. `riderVerified`, `riderFlagged`, `riderStale` defined as hex strings. |
| HLC utilities | ✅ Found | `modules/hazard-sos/src/hlc/hlc.ts` | Sufficient for stale-time extraction. See §4 "Stale Time Strategy" for full analysis. |
| Existing env-var mechanism | ✅ Found | `app/babel.config.js` — only `module:metro-react-native-babel-preset`. No dotenv, no config plugin. `app/package.json` has no `react-native-dotenv` or `react-native-config`. Two `process.env` references exist in source (`MAPBOX_TOKEN` in `MapScreen.tsx:26` and `SOCKET_URL` in `socketService.ts:9`), neither resolved at build time. | Insufficient. `react-native-dotenv` is needed. See Task 4.5. |
| `.gitignore` for `.env` | ✅ Found | `.gitignore:39–41` — `.env`, `.env.local`, `.env.*.local` are gitignored at root level. | Sufficient. `app/.env` is covered by the root `.gitignore` pattern. |

---

## 4. Task Breakdown

### Marker State Precedence (applies to all tasks)

The marker state is determined by a single centralized helper function `getMarkerState`:

```
Input:  payload — a VerifiedLocation object (or null/undefined for unknown riders)
        now     — current device clock as Unix ms (Date.now())
Output: one of three named states: "RED" | "GREY" | "GREEN"
```

**Precedence (deterministic, no exceptions):**

1. If `payload` is null, undefined, or fails validation → **GREY** (safe fallback: "unknown/missing" is stale, never fresh).
2. If `payload.spoof_flag === true` → **RED** (spoof always wins, regardless of staleness or missing HLC).
3. If `payload` is stale (see Stale Time Strategy below) → **GREY**.
4. Otherwise → **GREEN** (verified + fresh).

**No partial states. No implicit fallthrough to GREEN.** The function always returns exactly one of `"RED"`, `"GREY"`, or `"GREEN"`.

**Malformed/missing data rule:** If `spoof_flag` cannot be determined (field missing, wrong type, entire payload null/undefined), the result is **GREY** — never GREEN. A missing field must never be treated as "fresh and verified."

### Stale Time Strategy

**`timestamp_hlc` is an HLC value, not a Unix timestamp.** It must not be parsed as `Date.now()`.

**Existing HLC utility for physical time extraction:**

- **Utility:** `HLC.parse(hlcString)` (static, `modules/hazard-sos/src/hlc/hlc.ts:83–86`)
  - Input: HLC string in format `"<physical_ms>:<counter>"` (e.g., `"1700000000000:3"`)
  - Output: `{ physical: number, counter: number }` where `physical` is **Unix epoch milliseconds** (same clock as `Date.now()`)
- **Property:** `HLC.physical` getter (`modules/hazard-sos/src/hlc/hlc.ts:67`) returns the `physical` field as `number` (Unix ms)
- **Import path:** `import { HLC } from '@hazard/hlc/hlc'` (already used in `trackingService.ts:22`)

**Stale determination algorithm:**

1. Parse `payload.timestamp_hlc` via `HLC.parse()` to extract `physical` (Unix ms).
2. Compare: `stale = (now - physical) > 10000` where `now = Date.now()` on the receiving device and `physical` is the sender's wall-clock time embedded in the HLC.
3. This works because both clocks use Unix epoch milliseconds — `HLC.fresh()` uses `Date.now()` as its physical clock source (line 29: `new HLC({ physical: n(), counter: 0 }, n)` where `n` defaults to `Date.now()`).

**Malformed/missing HLC handling:**

- If `timestamp_hlc` is missing, `undefined`, empty string, or fails `HLC.parse()` (malformed format) → treat as **stale** (marker state = GREY if `spoof_flag` is not true; RED if `spoof_flag === true` per precedence rule 2).
- `HLC.parse()` splits on `:` and calls `parseInt`. If the string is malformed, `parseInt` returns `NaN`. The stale helper must guard against `NaN`: if `isNaN(physical)`, treat as stale.
- **No fallback clock.** Do not invent a second timestamp parser. Do not use `Date.now()` as a replacement for HLC physical time. If HLC parsing fails, the marker goes GREY.

**Stale threshold:** 10 seconds (spec §4.1).

**Clock/reference:** Device clock (`Date.now()`) compared against HLC `physical` field. Both are Unix epoch milliseconds from their respective devices. This comparison is valid as long as device clocks are roughly synchronized (within a few seconds). For a group ride app, this is a reasonable assumption — NTP keeps phones within ~100ms. If clocks are significantly skewed (>10s), markers would incorrectly appear stale; this is acceptable and self-correcting (the next update resets staleness).

---

### Task 4.1 — Socket `location:update` listener + riders Zustand store

- **Objective:** Create a Zustand store that subscribes to Socket.io `location:update` events and maintains canonical in-memory state for all riders' current locations.
- **Source-of-truth citation:** Person A §4.1 line 85: "Marker updates come from your own Socket.io `location:update` listener." Spec §4.2 line 107: "rider markers … updated from `location:update` socket event." Phase 4 task doc Task 4.1.
- **Current state:** No `ridersStore` exists. `socketService.ts` provides `getLocationSocket()` singleton with `connect()` / `disconnect()`. No room/join API exists on the socket or server. The Socket.io server (`modules/routing-eta/server/index.js`) does not handle `location:update` events — it only sets up the `/vox` namespace for Person D. `location:update` events are emitted client-side by `LocationPublisher.publish()`.
- **Required changes:**

  1. Create `app/src/store/ridersStore.ts` with Zustand. **Canonical state shape:**

     ```
     interface RiderEntry {
       location: VerifiedLocation;       // latest valid location payload
       receivedAt: number;              // Date.now() at time of Socket receipt (device clock)
       markerState: 'RED' | 'GREY' | 'GREEN';  // derived state
     }

     interface RidersState {
       riders: Map<string, RiderEntry>; // riderId → latest entry
       connected: boolean;
       subscribed: boolean;
     }
     ```

  2. **Store responsibilities:**
     - `location:update` Socket event → parse via `verifiedLocationFromJson()`, validate (see below), upsert into `riders` Map, compute `markerState` via `getMarkerState()`, store `receivedAt = Date.now()`.
     - Multiple riders coexist — updating rider A does not remove rider B.
     - `removeRider(riderId)` — removes a single entry (e.g., rider leaves group).
     - `clear()` — removes all entries (e.g., group change).
     - `subscribe()` — calls `getLocationSocket().on('location:update', handler)` + `.on('connect')` / `.on('disconnect')` for connection status. Also performs late-joiner Firestore fetch for initial positions (see Task 4.1 late-joiner below).
     - `unsubscribe()` — removes all listeners. No memory leak.
     - `refreshStaleStates()` — recomputes `markerState` for all riders based on current `Date.now()`. Called by the stale sweep timer (Task 4.3).
     - Store is the **single source of truth** for rider location state. `MapScreen` and `RiderMarkerOverlay` read from this store — no duplicate state.

  3. **Socket room subscription:** The existing `socketService.ts` provides `getLocationSocket()` which connects to the default namespace (`/`). There is no room/join/leave API. The server (`modules/routing-eta/server/index.js`) does not implement `location:update` relay or room-based broadcasting. For Phase 4, the store will listen to the global `location:update` stream and **filter by `group_id` client-side**. This is acceptable for Phase 4's test scope because:
     - Phase 4 uses `MockLocationProducer` or direct `socket.emit('location:update', ...)` for testing.
     - Multiple mocked riders on one shared stream is sufficient to validate multi-rider behavior (Task 4.3 tests).
     - Full Socket.io room integration (`socket.emit('join', { groupId })` / server-side room relay) is deferred to Phase 6.
     - The store's `subscribe(groupId)` method stores `groupId` for client-side filtering and will be the hook point for room joining in Phase 6.

  4. **Malformed payload handling (Task 4.1 specific):**

     The existing `verifiedLocationFromJson()` (`app/src/models/verifiedLocation.ts:16–28`) performs no validation:
     - `j.rider_id` on `undefined` → `undefined` (string field, not coerced)
     - `Number(j.lat)` on `undefined` → `NaN`
     - `Boolean(j.spoof_flag)` on `undefined` → `false`

     **Definition of "malformed" for Phase 4:**

     A payload is **malformed** if any of the following is true:
     - `j` is not an object (null, undefined, string, number)
     - `j.rider_id` is missing, empty, or not a string
     - `j.group_id` is missing or not a string (used for client-side filtering)
     - `j.lat` or `j.lng` is missing or not a finite number (`Number.isFinite` returns false)
     - `j.spoof_flag` is missing or not a boolean
     - `j.timestamp_hlc` is missing or not a string

     **Guard logic in the store:**

     ```
     function isValidLocation(j: any): boolean {
       return (
         j != null &&
         typeof j === 'object' &&
         typeof j.rider_id === 'string' && j.rider_id.length > 0 &&
         typeof j.group_id === 'string' &&
         typeof j.lat === 'number' && Number.isFinite(j.lat) &&
         typeof j.lng === 'number' && Number.isFinite(j.lng) &&
         typeof j.spoof_flag === 'boolean' &&
         typeof j.timestamp_hlc === 'string'
       );
     }
     ```

     If `isValidLocation(payload)` is false, the store **must**:
     - Log a warning via `console.warn` suitable for development/test diagnostics.
     - **Discard the payload entirely** — do not mutate existing valid state.
     - **Never crash** the store, `MapScreen`, or the overlay.

     This guard runs **before** `verifiedLocationFromJson()` is called, because that function does not validate. If the payload passes `isValidLocation`, then `verifiedLocationFromJson()` can safely transform it.

  5. **Only valid `location:update` events add riders to the store.** An unknown `rider_id` is added only when a valid payload for that `rider_id` is received. No entry is created for a `rider_id` without a valid payload.

  6. **Late-joiner Firestore fetch:** On `subscribe(groupId)`, after Socket connection, the store should call `LocationPublisher.fetchLastKnown()` for known riders in the group. However, `fetchLastKnown()` takes `(groupId, riderId)` — it fetches one rider at a time. The store does not know which rider IDs to fetch initially. This requires a Firestore collection query (`groups/{groupId}/locations`) which does not currently exist in the codebase. **This is deferred to Phase 6** (app-shell integration) when the group membership list is available. For Phase 4, the store only populates from Socket `location:update` events.

- **Files:**
  - **New:** `app/src/store/ridersStore.ts`
  - **New:** `app/src/screens/map/overlays/riderMarkerState.ts` (centralized `getMarkerState` + `isValidLocation` helpers)
  - **Existing (read-only):** `app/src/services/socketService.ts`, `app/src/models/verifiedLocation.ts`, `app/src/store/appStore.ts`, `modules/hazard-sos/src/hlc/hlc.ts`
- **Dependencies:** Phase 3 (publisher emits `location:update`). Phase 0 (contract frozen). `@hazard/hlc/hlc` (for HLC.parse in stale calculation). No cross-person dependency for this task.
- **Tests:**
  - Happy path: receive valid `location:update` → rider appears in store with correct data and `receivedAt`.
  - Multiple riders: 2+ distinct `rider_id`s coexist.
  - Update: same `rider_id` updates position — previous position replaced, not duplicated.
  - Malformed payload: missing `rider_id` → discarded, existing state unchanged.
  - Malformed payload: `lat` is `NaN` → discarded, existing state unchanged.
  - Malformed payload: `spoof_flag` missing → discarded (not treated as `false`).
  - `spoof_flag=true` → `markerState` is RED regardless of staleness.
  - Stale HLC (`timestamp_hlc` physical time >10s ago) → `markerState` is GREY (when `spoof_flag=false`).
  - Malformed/missing `timestamp_hlc` → `markerState` is GREY (safe fallback).
  - `spoof_flag=true` + stale → `markerState` is RED (precedence: spoof > stale).
  - `refreshStaleStates()` recomputes all marker states.
  - Socket disconnect → `connected: false`.
  - `clear()` empties store.
  - `subscribe` / `unsubscribe` idempotent: no duplicate listeners.
  - Updating rider A does not remove rider B.
- **Definition of Done:** `ridersStore` unit tests pass. Socket listener correctly populates store from `location:update` events. Malformed payloads are rejected without mutating state.

---

### Task 4.2 — Green/red/grey marker rendering (Mapbox CircleLayer)

- **Objective:** Render rider markers on the map as Mapbox `ShapeSource` + `CircleLayer`, color-coded by marker state per spec §4.1.
- **Source-of-truth citation:** Person A §4.1 lines 82–84: "Green: `spoof_flag=false`, fresh timestamp (<10s old). Red: `spoof_flag=true`. Grey: stale (>10s old)." WeRide spec §4.2 line 107: "Rider markers: color-coded by `spoof_flag`." Theme: `theme.ts` lines 19–22.
- **Current state:** `RiderMarkerOverlay.tsx` is a placeholder `<View/>`. `MapScreen.tsx` renders `RiderMarkerOverlay` as a sibling `<View>` outside `<MapView>`. No Mapbox shape sources, no CircleLayer, no color logic. The `@rnmapbox/maps` version is `^10.1.0` which supports `ShapeSource`, `CircleLayer`, `Camera`, and data-driven style expressions.
- **Required changes:**

  1. **MapScreen restructure (scoped to RiderMarkerOverlay's Mapbox layers only):** Move `RiderMarkerOverlay`'s Mapbox children (`ShapeSource` + `CircleLayer`) inside `<MapboxGL.MapView>`. The `RiderMarkerOverlay` component will return its Mapbox children (not a wrapping `<View>`) when rendered inside `MapView`. The `MapScreen.tsx` change is limited to moving `RiderMarkerOverlay` from the sibling overlay section into the `MapView` children. No other `MapScreen` behavior is modified. Non-Mapbox overlays (SOS button, VOX toggle, etc.) remain as sibling Views.

     **Current structure:**
     ```tsx
     <View>
       <MapboxGL.MapView>{/* empty */}</MapboxGL.MapView>
       <SosOverlay />
       ...
       <RiderMarkerOverlay />  {/* sibling View — wrong for Mapbox layers */}
     </View>
     ```

     **New structure (only RiderMarkerOverlay moves):**
     ```tsx
     <View>
       <MapboxGL.MapView>
         <MapboxGL.Camera ... />
         <RiderMarkerOverlay groupId={groupId} />  {/* ShapeSource + CircleLayer */}
       </MapboxGL.MapView>
       <SosOverlay />
       <HazardOverlay />
       ...
     </View>
     ```

     Other overlays (`HazardOverlay`, `RouteOverlay`) are NOT moved in this task. They remain as siblings until their owners (B, C) move their Mapbox layers in their own phases.

  2. **`RiderMarkerOverlay.tsx` rewrite:**
     - Read from `ridersStore` via `useRidersStore()`.
     - Convert `riders` Map to a single GeoJSON `FeatureCollection` of `Point` features. **One `ShapeSource` + one `CircleLayer` for all riders**, not one per rider.
     - Each feature has properties:
       - `rider_id`: string (feature identifier)
       - `markerColor`: string hex color computed by `getMarkerState()` using `WeRideColors`
       - `speed_mps`: number
       - `heading_deg`: number
       - `nis_score`: number
       - `spoof_flag`: boolean
       - `accuracy_m`: number
     - Feature `id` is set to `rider_id` for efficient updates.
     - `CircleLayer` style uses `['get', 'markerColor']` expression for `circle-color`.
     - Circle radius: constant (e.g., 8pt). No per-rider size variation.

  3. **Mapbox data flow:**

     ```
     ridersStore (Zustand)
         ↓ (subscribe via useRidersStore hook)
     GeoJSON FeatureCollection (computed in RiderMarkerOverlay)
         ↓ (passed as ShapeSource url/feature prop)
     MapboxGL.ShapeSource
         ↓ (renders features)
     MapboxGL.CircleLayer
         ↓ (style expression: ['get', 'markerColor'])
     Colored circles on map
     ```

  4. Use `WeRideColors.riderVerified`, `WeRideColors.riderFlagged`, `WeRideColors.riderStale` from `theme.ts`. No hardcoded colors.

- **Files:**
  - **Modify:** `app/src/screens/map/overlays/RiderMarkerOverlay.tsx` (major rewrite)
  - **Modify:** `app/src/screens/map/MapScreen.tsx` (move RiderMarkerOverlay inside MapView, add Camera)
  - **New:** `app/src/screens/map/overlays/riderMarkerState.ts` (getMarkerState + isValidLocation)
  - **Existing (read-only):** `app/src/theme/theme.ts`, `app/src/store/ridersStore.ts` (Task 4.1)
- **Dependencies:** Task 4.1 (store must exist to read rider data).
- **Tests:**
  - `getMarkerState` helper (pure JS, fully automated):
    - Fresh verified (`spoof_flag=false`, HLC physical <10s ago) → GREEN
    - Spoofed (`spoof_flag=true`) → RED (regardless of staleness)
    - Stale verified (`spoof_flag=false`, HLC physical >10s ago) → GREY
    - Spoofed + stale (`spoof_flag=true`, stale) → RED (precedence: spoof > stale)
    - Missing/null payload → GREY
    - `spoof_flag` missing/undefined → GREY (not GREEN)
    - `timestamp_hlc` malformed → GREY
    - `timestamp_hlc` empty string → GREY
  - GeoJSON FeatureCollection construction: correct features from store data.
  - Empty store → empty FeatureCollection, no crash.
  - Full CircleLayer rendering: requires RN device (manual).
- **Definition of Done:** Markers render on map with correct colors. Spoofed = red. Fresh verified = green. Stale = grey.

---

### Task 4.3 — Stale tick (10s sweep)

- **Objective:** A periodic re-evaluation of marker staleness so riders who stop sending go grey even without a new event.
- **Source-of-truth citation:** Person A §4.1 line 84: "Grey: stale (>10s old, no recent update — signal lost)." `phase4_tasks.md` Task 4.3.
- **Current state:** No stale timer exists anywhere.
- **Required changes:**

  1. In `RiderMarkerOverlay.tsx`, add a `useEffect` with `setInterval(1000)` that calls `ridersStore.getState().refreshStaleStates()`.
  2. `refreshStaleStates()` recomputes `markerState` for all riders in the store using `Date.now()` and `HLC.parse(payload.timestamp_hlc).physical` for staleness.
  3. The stale sweep:
     - **Updates derived stale/marker state only.** Does not fabricate GPS locations.
     - **Does not modify the latest valid coordinates** (`location` field in `RiderEntry`).
     - **Does not interfere with `spoof_flag`** (which comes from the payload, not derived).
     - **Clears stale status** when a fresh `location:update` arrives (the upsert already sets `receivedAt` and recomputes `markerState`).
  4. Clean up the interval on unmount: `clearInterval` in the `useEffect` cleanup.
  5. **No duplicate intervals** across remounts/re-subscriptions: the `useEffect` dependency array ensures only one interval at a time.

- **Files:**
  - **Modify:** `app/src/screens/map/overlays/RiderMarkerOverlay.tsx`
  - **Modify:** `app/src/store/ridersStore.ts` (add `refreshStaleStates` action)
- **Dependencies:** Task 4.2 (markers must exist to go stale).
- **Tests:**
  - Fresh rider (`spoof_flag=false`, recent HLC) → GREEN.
  - Rider becomes stale (no update for >10s) → GREY.
  - Spoofed rider (`spoof_flag=true`) → RED (stale or not).
  - Spoofed + stale → RED (precedence: spoof > stale).
  - Fresh `location:update` received after stale → GREEN (stale cleared).
  - Multiple riders evaluated independently — rider A stale does not affect rider B.
  - No duplicate intervals across remounts/re-subscriptions.
  - Interval cleared on unmount — no memory leak, no state updates after unmount.
- **Definition of Done:** Rider with no updates for >10s renders GREY (unless `spoof_flag=true`, which stays RED). Within ~1s of the 10s boundary.

---

### Task 4.4 — Tap info card (debug NIS)

- **Objective:** Marker tap → small info card showing rider short identifier, speed, heading, accuracy. NIS visible only under `__DEV__`.
- **Source-of-truth citation:** Person A §4.1 line 86: "Marker tap → small info card: rider name, speed, heading, NIS score (only show NIS in a debug/profile mode — not on the main screen, it's noise for end users)." `phase4_tasks.md` Task 4.4. Demo script §10 step 3: "NIS spikes (visible in debug overlay)."
- **Current state:** No tap handler, no callout component. `@rnmapbox/maps@^10.1.0` supports `ShapeSource.onPress` and `Callout`.
- **Required changes:**

  1. In `RiderMarkerOverlay.tsx`, add an `onPress` handler on the `ShapeSource` that identifies the tapped feature by its `rider_id` property.
  2. Track `selectedRiderId` in local component state (or as a store field).
  3. When `selectedRiderId` is set, render a React Native `<View>` card **outside** `<MapboxGL.MapView>` (not inside — Callout inside MapView is more restrictive and harder to control). The card is positioned absolutely on screen, with data from the selected rider's `RiderEntry`.
  4. Info card contents:
     - **Rider identifier:** `rider_id.slice(0, 8)` — this is a **placeholder identifier**, not a display name. The UI label should say "Rider" or "ID", not "Name" or "Rider Name". Actual rider-name resolution is deferred to Phase 6.
     - **Speed:** `speed_mps` formatted as km/h (`speed_mps * 3.6`). If `speed_mps` is `NaN` or missing → display `"--"`.
     - **Heading:** `heading_deg` formatted as compass direction (N/NE/E/SE/S/SW/W/NW). If missing/NaN → `"--"`.
     - **Accuracy:** `accuracy_m` formatted as `"X.X m"`. If missing/NaN → `"--"`.
     - **NIS score:** Conditionally rendered. `if (__DEV__)` → show `nis_score`. In production → hidden entirely (not just zeroed out).
  5. Handle edge cases:
     - **No selected rider:** Card not rendered.
     - **Selected rider removed from store** (e.g., rider disconnects while selected) → card dismissed automatically (selectedRiderId reset to null).
     - **Missing optional fields:** Each field degrades independently to `"--"`. The card does not blank entirely if one field is missing.
  6. Tap on empty map area (no feature hit) → dismiss card. Second tap on same marker → dismiss card.

- **Files:**
  - **Modify:** `app/src/screens/map/overlays/RiderMarkerOverlay.tsx`
  - **Possibly modify:** `app/src/screens/map/MapScreen.tsx` (if the info card is positioned as a sibling of `MapView` rather than inside the overlay)
- **Dependencies:** Task 4.2 (markers must be tappable via ShapeSource.onPress).
- **Tests:**
  - Tap rider → `selectedRiderId` set.
  - `__DEV__` = true → NIS visible in card.
  - `__DEV__` = false → NIS not rendered.
  - Selected rider removed from store → `selectedRiderId` reset to null.
  - Missing `speed_mps` → displays `"--"`.
  - Missing `heading_deg` → displays `"--"`.
  - Missing `accuracy_m` → displays `"--"`.
  - Dismiss on second tap or map background tap.
- **Definition of Done:** Tapping a rider marker shows info card with rider short ID, speed, heading, accuracy. NIS hidden in production build. Each field degrades independently to `"--"` if missing.

---

### Task 4.5 — Wire `MapboxGL.setAccessToken` (build-time)

- **Objective:** Fix `process.env.MAPBOX_TOKEN ?? ''` which doesn't work in React Native. Inject the Mapbox access token at build time.
- **Source-of-truth citation:** `person1_PhaseWisePlan.md` §Current Status line 35; `phase4_tasks.md` Task 4.5.
- **Current state:**
  - `MapScreen.tsx` line 26: `MapboxGL.setAccessToken(process.env.MAPBOX_TOKEN ?? '')` — `process.env` is not available at RN runtime without configuration.
  - `socketService.ts` line 9 also uses `process.env.SOCKET_URL` — same issue, but works as fallback to `'http://localhost:3000'` in dev. Not in Phase 4 scope, but noted.
  - `app/babel.config.js` has only `module:metro-react-native-babel-preset`. **No existing environment-variable mechanism.** No `react-native-dotenv`, no `react-native-config`, no Babel plugins for env vars.
  - `app/package.json` does not include `react-native-dotenv` or any env plugin.
  - `.gitignore` (root) already includes `.env`, `.env.local`, `.env.*.local` — sufficient to prevent committing `app/.env`.
  - No `app/.env` file exists yet.

  **Why the existing mechanism is insufficient:** `process.env` in React Native is a compile-time substitution, not a runtime lookup. Without a Babel plugin like `react-native-dotenv` to replace `process.env.X` at build time, the reference evaluates to `undefined` at runtime. Metro's default preset does not perform this substitution.

- **Required changes:**
  1. Add `react-native-dotenv` to `app/package.json` devDependencies.
  2. Update `app/babel.config.js` to include `module:react-native-dotenv` plugin with `moduleName: '@env'` and `path: '.env'`.
  3. Create `app/.env` with `MAPBOX_TOKEN=your_mapbox_access_token_here` (placeholder — actual token gitignored).
  4. Create `app/.env.example` with `MAPBOX_TOKEN=your_mapbox_access_token_here` (committed, for onboarding).
  5. In `MapScreen.tsx`, replace `process.env.MAPBOX_TOKEN` with `import { MAPBOX_TOKEN } from '@env';`.
  6. Add `@env` module mapping to `app/tsconfig.json` `paths` section (for TypeScript resolution): `"@env": ["./env.d.ts"]` or use `paths` mapping.
  7. Add `@env` mock to `app/jest.setup.js` so tests don't fail on missing module.
  8. Verify `.gitignore` covers `app/.env` — root `.gitignore` already has `.env` pattern which covers `app/.env`. **No `.gitignore` change needed.**
  9. **Do not commit real Mapbox tokens.** Only `.env.example` is committed.

- **Files:**
  - **Modify:** `app/package.json` (add `react-native-dotenv` devDep)
  - **Modify:** `app/babel.config.js` (add dotenv plugin)
  - **Modify:** `app/src/screens/map/MapScreen.tsx` (import from `@env` instead of `process.env`)
  - **Modify:** `app/tsconfig.json` (add `@env` path mapping)
  - **Modify:** `app/jest.setup.js` (add `@env` mock)
  - **Create:** `app/.env` (gitignored)
  - **Create:** `app/.env.example` (committed)
- **Dependencies:** None.
- **Tests:**
  - `MAPBOX_TOKEN` loaded from `@env` without crash.
  - App doesn't crash when token is empty string (graceful fallback).
  - `.env.example` committed, `.env` gitignored.
- **Definition of Done:** Map renders Mapbox tiles with a valid token. `process.env.MAPBOX_TOKEN` no longer referenced. Token is not committed.

---

## 5. Cross-Person Dependencies

| Dependency | Owner | What Phase 4 Needs | Status |
|---|---|---|---|
| `verified_location` contract shape | Person A (self) | Field names and types for Socket event parsing | Available — frozen in `contracts/verified_location.json` |
| `HLC` implementation | Person B | `HLC.parse()` for extracting physical time from `timestamp_hlc` | Available — `modules/hazard-sos/src/hlc/hlc.ts`. `HLC.parse()` returns `{ physical: number, counter: number }` where `physical` is Unix ms. |
| Theme colors | Person C | `WeRideColors.riderVerified/riderFlagged/riderStale` | Available — defined in `app/src/theme/theme.ts`. |
| `MapScreen` overlay pattern | Person A (self) | Container for Mapbox children inside `MapView` | Needs restructuring — Task 4.2 moves RiderMarkerOverlay inside MapView only. |
| Socket.io server | Person C (routing-eta server) | Server that relays `location:update` events | **Not yet implemented.** Server at `modules/routing-eta/server/index.js` only handles `/vox` namespace and REST routes. No `location:update` relay. Phase 4 tests use mock data. Full integration deferred to Phase 6. |
| Rider display name | None currently | Spec says "rider name" but contract only has `rider_id` | **Deferred to Phase 6.** Phase 4 shows `rider_id.slice(0, 8)` as placeholder identifier. |

---

## 6. Frozen Contracts From Phase 0–3

The following are frozen and must NOT be modified in Phase 4:

1. **`contracts/verified_location.json`** — 10 required fields, transport annotation. No changes.
2. **`VerifiedLocationPayload`** (`modules/tracking/src/locationPublisher.ts`) — internal camelCase type. No changes.
3. **`VerifiedLocation`** (`app/src/models/verifiedLocation.ts`) — snake_case app model with `verifiedLocationFromJson()`. No changes to the parser. Guard logic wraps it in the store.
4. **`LocationPublisher`** API — `publish(payload)`, `fetchLastKnown(groupId, riderId)`. No changes.
5. **`socketService.ts`** API — `getLocationSocket()`, `disconnectSockets()`. No changes.
6. **`WeRideColors`** — `riderVerified`, `riderFlagged`, `riderStale` are frozen. No changes.
7. **`HLC` class** — `modules/hazard-sos/src/hlc/hlc.ts`. No changes. Used read-only (`HLC.parse()` and `HLC.physical` getter).
8. **EKF, SpoofDetector, SensorStream, TrackingService, hlcStore** — Phase 1–3 implementations frozen. No changes.

---

## 7. Automated Test Plan

### Task 4.1 — `ridersStore` + `riderMarkerState`

| Test Case | What It Asserts | Automated? |
|---|---|---|
| `upsertRider` adds new rider | Store has 1 entry with correct `lat/lng/spoof_flag/markerState` | Yes |
| `upsertRider` updates existing rider | Second emit for same `rider_id` updates position, not duplicates | Yes |
| Multiple distinct riders | Store has N entries for N unique `rider_id`s | Yes |
| `spoof_flag=true` → `markerState` is RED | Regardless of HLC freshness | Yes |
| Stale HLC (`physical` >10s ago) → `markerState` is GREY | When `spoof_flag=false` | Yes |
| Fresh HLC + `spoof_flag=false` → GREEN | Verified + recent | Yes |
| Malformed payload (missing `rider_id`) → discarded | Store unchanged, warning logged | Yes |
| Malformed payload (`lat` is NaN) → discarded | Store unchanged | Yes |
| Malformed payload (`spoof_flag` missing) → discarded | Not treated as `false` | Yes |
| Malformed `timestamp_hlc` → `markerState` is GREY | HLC parse fails | Yes |
| `spoof_flag=true` + stale → RED | Precedence: spoof > stale | Yes |
| Null/undefined payload → GREY via `getMarkerState(null)` | Safe fallback | Yes |
| `refreshStaleStates` recomputes all marker states | After advancing clock mock | Yes |
| `clear()` empties store | After clear, `riders.size === 0` | Yes |
| `subscribe` / `unsubscribe` idempotent | No duplicate listeners | Yes |
| Socket disconnect → `connected: false` | Flag updates | Yes |
| Updating rider A does not remove rider B | Independent coexistence | Yes |
| Only valid payloads add riders to store | Unknown rider_id only added via valid event | Yes |

### Task 4.2 — Marker rendering logic (`getMarkerState` + GeoJSON)

| Test Case | What It Asserts | Automated? |
|---|---|---|
| `getMarkerState` all 3 states | RED, GREY, GREEN correctly computed | Yes |
| GeoJSON FeatureCollection construction | Correct features from store data | Yes |
| Feature properties include `markerColor`, `rider_id`, `speed_mps`, etc. | Required properties present | Yes |
| Empty store → empty FeatureCollection | No crash | Yes |
| Full CircleLayer rendering | 3 riders render with correct colors | Requires RN device (manual) |

### Task 4.3 — Stale timer

| Test Case | What It Asserts | Automated? |
|---|---|---|
| Fresh rider → GREEN | HLC physical within 10s | Yes |
| Rider becomes stale → GREY | After 10s+ with no update | Yes |
| Spoofed rider → RED | Regardless of staleness | Yes |
| Spoofed + stale → RED | Spoof precedence | Yes |
| Fresh update clears stale → GREEN | After stale, new `location:update` arrives | Yes |
| Multiple riders independently evaluated | Rider A stale doesn't affect Rider B | Yes |
| No duplicate intervals across remounts | Only 1 interval active at a time | Yes |
| Interval cleared on unmount | No memory leak, no state updates after unmount | Yes |

### Task 4.4 — Info card

| Test Case | What It Asserts | Automated? |
|---|---|---|
| Tap rider → `selectedRiderId` set | State toggles | Yes |
| `__DEV__` = true → NIS visible | Conditional rendering | Yes |
| `__DEV__` = false → NIS hidden | Not in DOM | Yes |
| Selected rider removed from store → card dismissed | `selectedRiderId` reset to null | Yes |
| Missing `speed_mps` → displays `"--"` | Graceful degradation | Yes |
| Missing `heading_deg` → displays `"--"` | Graceful degradation | Yes |
| Missing `accuracy_m` → displays `"--"` | Graceful degradation | Yes |
| Dismiss on second tap | Card disappears | Yes |

### Task 4.5 — Mapbox token

| Test Case | What It Asserts | Automated? |
|---|---|---|
| Token loaded from `@env` | Import resolves, not `undefined` | Yes |
| App doesn't crash without token | Graceful handling (empty string fallback) | Yes |
| `.env.example` committed | File exists with placeholder | Yes |

---

## 8. Manual Verification Plan

| Task | What to verify manually | How |
|---|---|---|
| 4.1 | Socket connection and live updates | Run mock producer or 2 instances, verify both see each other's dots in store. |
| 4.2 | Markers render on real map | Launch app with Mapbox token, navigate to MapScreen, verify dots appear. |
| 4.3 | Stale marker turns grey | Stop emitting for one rider → after 10s marker turns grey. Spoofed rider stays red even when stale. |
| 4.4 | Tap card appears | Tap a marker → info card shows rider short ID, speed, heading, accuracy. NIS visible only in `__DEV__`. |
| 4.5 | Map renders tiles | Open MapScreen → tiles load, not blank. |
| Integration | Late-joiner path (Phase 6) | Deferred — store only populates from Socket events in Phase 4. |

---

## 9. Risks / Edge Cases

1. **Mapbox children requirement:** `ShapeSource` and `CircleLayer` must be children of `MapView` in `@rnmapbox/maps@^10.1.0`. Only `RiderMarkerOverlay`'s Mapbox layers move inside `MapView` in this phase. Other overlays (B, C, D) remain as siblings until their owners move them.

2. **Stale timer performance:** A 1-second `setInterval` calling `refreshStaleStates()` for ≤8 riders is negligible. The store update triggers a re-render only if `markerState` actually changes.

3. **Socket event format mismatch:** `LocationPublisher.publish()` sends snake_case (`spoof_flag`, `nis_score`). The app model `verifiedLocationFromJson()` expects snake_case. The `isValidLocation()` guard in the store validates types before passing to `verifiedLocationFromJson()`.

4. **HLC clock skew:** Stale determination compares device `Date.now()` against HLC `physical` (Unix ms from sender's clock). If sender and receiver clocks are significantly skewed (>10s), markers would incorrectly appear stale. This is acceptable for a group ride app where phones have NTP-synced clocks. The HLC `physical` field is sourced from `Date.now()` on the sender (see `HLC.fresh()`), so both clocks use the same epoch.

5. **Mapbox token in CI/CD:** Tests and CI won't have a real Mapbox token. The babel dotenv setup must handle missing tokens gracefully (dev warning, not crash). `MAPBOX_TOKEN` default in `.env.example` is a placeholder.

6. **React Native test environment for Mapbox:** `jest.setup.js` already mocks `@rnmapbox/maps` as string components. This is sufficient for logic tests but not rendering assertions. Mapbox rendering requires a real device or E2E test framework.

7. **No Socket.io server relay for `location:update`:** The routing-eta server (`modules/routing-eta/server/index.js`) does not implement `location:update` event relay. For Phase 4 development and testing, the store uses `MockLocationProducer` or direct `socket.emit('location:update', ...)` for local testing. Full server integration is Phase 6.

8. **`socketService.ts` also uses `process.env`:** Line 9 references `process.env.SOCKET_URL`. This has the same build-time issue but is not in Phase 4 scope. Noted for future fix.

---

## 10. Blockers

1. **Socket.io server relay:** The server at `modules/routing-eta/server/index.js` does not handle `location:update` events — it only sets up `/vox` namespace and REST routes. Phase 4 can test with mock data. Full integration is Phase 6. **Not a hard blocker for Phase 4.**

2. **Group membership list for late-joiner:** The store needs to know which rider IDs to fetch from Firestore for the late-joiner path (`fetchLastKnown(groupId, riderId)`). This requires a group membership list (from `appStore.groupId` + Firestore `groups/{groupId}/members`) which is not yet wired. **Deferred to Phase 6.**

---

## 11. Explicit Scope Exclusions

The following are **NOT** in Phase 4 scope:

- Phase 5 (mock producer improvements, `demo()` runnable)
- Phase 6 (app-shell integration, `TrackingService` lifecycle wiring, ride-data buffer for D, Socket.io room joining)
- Phase 7 (tightened EKF NIS tests, stale_marker_grey widget test, mock_producer_contract test)
- Phase 8 (CPU/battery profiling)
- EKF algorithm changes (Phase 1 domain)
- SensorStream redesign (Phase 2 domain)
- HLC implementation changes (Person B's domain) — Phase 4 uses `HLC.parse()` read-only
- Native Android/iOS configuration (background location, permissions — Phase 2)
- Changes to `contracts/verified_location.json`
- Changes to `verifiedLocationFromJson()` parser — guard logic wraps it, doesn't modify it
- Routing overlay (Person C), hazard overlay (Person B), VOX overlay (Person D)
- Firestore security rules
- Authentication flow (login screen → map screen navigation)
- Group creation/join flow (Person C owns)
- Background location service (Phase 2)
- `react-native-background-geolocation` integration (Phase 2)
- Rider display name resolution (Phase 6)
- Socket.io room subscription protocol (Phase 6)

---

## 12. Source Document Gaps

| Gap | Source | Impact | Resolution |
|---|---|---|---|
| No `ridersStore` defined anywhere | No spec doc defines the client-side store | Phase 4 creates this from scratch. Design inferred from spec §4.1 and standard Zustand patterns. | New file `app/src/store/ridersStore.ts` |
| Rider display name not in `verified_location` contract | `contracts/verified_location.json` has `rider_id` only | Info card spec says "rider name" but no data source is defined. | Phase 4 shows `rider_id.slice(0, 8)` as placeholder identifier. Phase 6 adds Firestore lookup. |
| `MapScreen` overlay architecture (MapView children vs siblings) | Not specified in spec | Must be decided in Phase 4. Current code has overlays as siblings. | Only `RiderMarkerOverlay`'s Mapbox layers move inside `MapView`. Other overlays remain as siblings. |
| Socket.io room/group subscription mechanism | Spec says "listener for the current `group_id`" but `socketService.ts` has no `joinRoom`/`leaveRoom` API | No room mechanism exists on either client or server. | Phase 4 filters by `group_id` client-side. Room integration deferred to Phase 6. |
| No `location:update` relay on the server | `modules/routing-eta/server/index.js` has no Socket.io relay for location events | Phase 4 development and testing uses mock data or direct emit. | Phase 6 adds server-side relay. |

---

## 13. Ambiguities Resolved

### 13.1 — Rider display name in info card

**Decision:** Phase 4 shows `rider_id.slice(0, 8)` as a placeholder identifier. The UI label will say "Rider" or "ID", not "Name" or "Rider Name." This is explicitly a placeholder — not a real display name. Actual rider-name resolution (Firestore `users/{rider_id}` lookup or contract extension) is deferred to Phase 6.

### 13.2 — Socket.io group room subscription

**Decision:** Phase 4 consumes the existing `getLocationSocket()` singleton and listens for `location:update` events. No new Socket.io room/join protocol is invented. The store filters by `group_id` client-side. This is acceptable for Phase 4's test scope — multiple mocked riders on one shared stream validates Task 4.3's multi-rider behavior. Full room integration (`socket.emit('join', { groupId })`) is Phase 6.

### 13.3 — Malformed payload handling

**Decision:** Parse using existing `verifiedLocationFromJson()`. Before calling the parser, validate with `isValidLocation()` guard. Malformed payloads (missing required fields, wrong types, `null`/`undefined`) are **rejected entirely** — discarded with a `console.warn` for diagnostics. They must never crash the store, MapScreen, or overlay. They must never mutate existing valid state. Partial updates are not accepted — no fallback coordinates, no invented values.

The `verifiedLocationFromJson()` function itself is NOT modified. The guard wraps it. Fields validated: `rider_id` (string, non-empty), `group_id` (string), `lat`/`lng` (finite numbers), `spoof_flag` (boolean), `timestamp_hlc` (string). If any of these checks fail, the entire payload is discarded.

### 13.4 — Map overlay architecture

**Decision:** Mapbox `ShapeSource`/`CircleLayer` must be children of `MapView`. The React Native info card (selected-rider card) remains outside `MapView` as a sibling View. Only `RiderMarkerOverlay`'s Mapbox layers are moved inside `MapView` in this phase. Other overlays are not modified. The current code's structure (`MapScreen.tsx`) mixes these concerns — this is noted as an observation in §3.2 but only the minimum required change is made (moving RiderMarkerOverlay inside MapView).

---

## 14. Final Phase 4 Definition of Done

- [ ] `ridersStore` (Zustand) subscribes to Socket `location:update` and maintains `Map<riderId, RiderEntry>` with `location`, `receivedAt`, `markerState`, and `connected` state. Single source of truth for rider location data.
- [ ] `getMarkerState` helper returns `"RED" | "GREY | "GREEN"` with deterministic precedence: RED (spoof) > GREY (stale/missing) > GREEN (fresh+verified). Null/undefined payload → GREY. Missing `spoof_flag` → GREY (never GREEN).
- [ ] `isValidLocation` guard rejects malformed payloads before they enter the store. Malformed payloads are discarded with `console.warn`, never crash the app, never mutate existing valid state.
- [ ] Stale determination uses `HLC.parse(payload.timestamp_hlc).physical` (Unix ms) compared against `Date.now()`. Malformed/missing HLC → stale → GREY. `Date.now()` is never used as a replacement for HLC physical time.
- [ ] `RiderMarkerOverlay` renders Mapbox `ShapeSource` + `CircleLayer` inside `MapView` with one collection/layer for all riders. Colors driven by `markerColor` property computed via `getMarkerState`.
- [ ] Stale sweep: `setInterval(1000)` calls `refreshStaleStates()` every second; markers go GREY within ~1s of the 10s boundary. Interval cleaned on unmount. No duplicate intervals. No fabricated GPS coordinates. No modification of `spoof_flag`.
- [ ] Tap info card: shows `rider_id.slice(0, 8)` (placeholder identifier, labeled "Rider" not "Name"), speed (km/h), heading (compass), accuracy (m). NIS visible only under `__DEV__`. Each field degrades to `"--"` independently if missing. Selected rider removed from store → card dismissed.
- [ ] `MapScreen`: RiderMarkerOverlay's Mapbox layers moved inside `MapView`. `MapboxGL.Camera` added. No other overlay behavior changed.
- [ ] Mapbox access token wired via `react-native-dotenv` (build-time). No `process.env` references for MAPBOX_TOKEN. `.env` gitignored. `.env.example` committed.
- [ ] All `ridersStore` and `getMarkerState` unit tests pass.
- [ ] `npm run lint && npm run typecheck && npm test` green in `app/`.
- [ ] Manual verification: 2+ riders visible on map, colors correct (GREEN/RED/GREY), stale transition works, spoof precedence works, info card works, NIS hidden in release build.

---

*This plan was revised after reviewing the actual repository state. All decisions in §13 are approved. No Phase 5+ features are included. No code modifications have been made.*