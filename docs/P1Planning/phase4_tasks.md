# Phase 4 — Live Map rider markers (UI)

**Objective:** Implement `RiderMarkerOverlay` per §4.1: green/red/grey markers, Socket listener, stale handling, debug NIS info card.

---

## Task 4.1 — Socket `location:update` listener + store

- **Description:** Overlay needs to listen to `location:update` for the current `groupId` and keep a map of `riderId → VerifiedLocation`. No store slice exists.
- **Why it is required:** Spec §4.1: "Marker updates come from your own Socket.io `location:update` listener."
- **Files/components affected:** `app/src/screens/map/overlays/RiderMarkerOverlay.tsx`, new `app/src/store/ridersStore.ts` (Zustand slice) or module-local store in `modules/tracking/src/ridersStore.ts`.
- **Dependencies:** Phase 3 (publisher emits the event).
- **Expected deliverable:** `useRidersStore(groupId)` hook subscribes to socket, updates `Map<riderId, VerifiedLocation & {receivedAt: number}>`.
- **Definition of Done:** Two phones emit → both see each other's markers update in real time.

---

## Task 4.2 — Green/red/grey marker rendering

- **Description:** Implement Mapbox `ShapeSource` + `CircleLayer` with color logic: green (`spoof_flag=false` && `now - receivedAt < 10s`), red (`spoof_flag=true`), grey (`now - receivedAt >= 10s`).
- **Why it is required:** Spec §4.1 color spec; §7 `stale_marker_grey` test.
- **Files/components affected:** `app/src/screens/map/overlays/RiderMarkerOverlay.tsx`.
- **Dependencies:** Task 4.1.
- **Expected deliverable:** CircleLayer per rider with data-driven `circle-color` expression.
- **Definition of Done:** Stale rider (no update 10s) → grey; spoofed → red; normal → green.

---

## Task 4.3 — Stale tick (10s sweep)

- **Description:** Need a timer that re-evaluates staleness every second so a rider who stopped sending goes grey without a new event.
- **Why it is required:** Grey is "no recent update," which is the absence of events — can't be triggered by an event.
- **Files/components affected:** `app/src/screens/map/overlays/RiderMarkerOverlay.tsx`.
- **Dependencies:** Task 4.2.
- **Expected deliverable:** `setInterval` 1s → force re-render / bump a "now" counter in the store.
- **Definition of Done:** Rider stops emitting → marker goes grey within ~11s.

---

## Task 4.4 — Tap info card (debug NIS)

- **Description:** Marker tap → small card: rider name, speed, heading, NIS. NIS only in debug/profile mode (spec §4.1: "only show NIS in a debug/profile mode — not on the main screen").
- **Why it is required:** Demo requirement §10 step 3: "NIS spikes (visible in debug overlay)."
- **Files/components affected:** `app/src/screens/map/overlays/RiderMarkerOverlay.tsx`.
- **Dependencies:** Task 4.2.
- **Expected deliverable:** `onPress` handler → `Callout` with fields; NIS gated by `__DEV__` or a feature flag.
- **Definition of Done:** Tap rider → card shows; in prod build NIS hidden.

---

## Task 4.5 — Wire `MapboxGL.setAccessToken`

- **Description:** `process.env.MAPBOX_TOKEN` doesn't work in RN. Use `react-native-dotenv` or `react-native.config.js` build-time injection. TODO in `MapScreen.tsx` line 26.
- **Why it is required:** Map doesn't render without a token; env var is undefined at runtime.
- **Files/components affected:** `app/src/screens/map/MapScreen.tsx`, `app/babel.config.js` (dotenv plugin), `app/.env` (gitignored).
- **Dependencies:** None.
- **Expected deliverable:** Token loaded from a build-time-injected constant.
- **Definition of Done:** Map renders tiles, not blank.