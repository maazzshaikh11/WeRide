# Phase 6 — Integration & cross-module wiring

**Objective:** Wire tracking into the app shell, consume B's HLC, provide ride-data buffer to D, integrate with C's route origin.

---

## Task 6.1 — Construct `TrackingService` in app

- **Description:** Nothing instantiates `TrackingService` in `app/`. Need a service initializer on group join (after login → group select → map screen mount).
- **Why it is required:** Module exists but isn't started.
- **Files/components affected:** `app/src/screens/map/MapScreen.tsx` (useEffect start), `app/src/services/localStorage.ts` (MMKV for HLC persist), `app/src/services/socketService.ts` (pass socket).
- **Dependencies:** Phases 2, 3, 4.
- **Expected deliverable:** On `MapScreen` mount with valid `groupId` + `userId`, `TrackingService.start()`.
- **Definition of Done:** Real phone publishes its own `verified_location`.

---

## Task 6.2 — Consume `@hazard/*` HLC

- **Description:** `TrackingService` takes `HlcSource`; wire it to `HLC.fresh()` imported from `@hazard/*` (alias already configured).
- **Why it is required:** Spec §2: "Do not roll your own HLC." Aliases exist, just import.
- **Files/components affected:** `modules/tracking/src/trackingService.ts` or the app initializer in 6.1.
- **Dependencies:** Task 3.1.
- **Expected deliverable:** `import { HLC } from '@hazard/hlc/hlc'` (or via `@hazard/*` re-export) used as `HlcSource`.
- **Definition of Done:** `timestamp_hlc` in published payload is HLC-formatted `physical:counter`.

---

## Task 6.3 — Ride-data buffer for Person D (FL)

- **Description:** Spec §6 Week 5: "expose a local ride-data buffer (lat/lng/speed/time history) for D's FL client." Shape **undecided** — spec says "coordinate the shape with D, add to `/contracts`."
- **Why it is required:** D's FedProx trains on local ride traces.
- **Files/components affected:** `modules/tracking/src/rideBuffer.ts` (new), `/contracts/` (new schema, all-4 review).
- **Dependencies:** Coordination with Person D (non-blocking — D doesn't need until Week 5).
- **Expected deliverable:** Ring buffer of `{lat, lng, speed_mps, heading_deg, timestamp_hlc}` capped at N samples; export via `index.ts`.
- **Definition of Done:** D can `import { RideBuffer } from '@tracking/rideBuffer'`.

**Undecided:** Buffer schema + sample cap. Must be agreed in weekly sync per `contracts/README.md`. Do not solo-edit contracts.

---

## Task 6.4 — Provide route origin to Person C

- **Description:** C's routing client needs the rider's current `verified_location` as route origin. No explicit API; C currently consumes via Socket like everyone else.
- **Why it is required:** Spec §5.2: C needs `verified_location` for route requests.
- **Files/components affected:** None new — C consumes the Socket event. Confirm with C that Socket is sufficient vs. a synchronous getter.
- **Dependencies:** Non-blocking, coordination only.
- **Expected deliverable:** Documented agreement (in weekly sync notes) that C reads from `location:update` or from the ridersStore slice.
- **Definition of Done:** C's `routingClient` gets origin without a new Person-A API.

---

## Task 6.5 — Provide coords to Person B (hazard/SOS)

- **Description:** B's hazard/SOS reports need to attach current rider coords. Same as C — B consumes `verified_location` stream.
- **Why it is required:** Spec §5.2: B needs `verified_location` for attaching coords to reports.
- **Files/components affected:** None new — B consumes Socket event + ridersStore.
- **Dependencies:** Non-blocking.
- **Expected deliverable:** B can read "my own" current location from the store for attaching to a hazard report.
- **Definition of Done:** B's `hazardService` gets lat/lng without a new Person-A API.