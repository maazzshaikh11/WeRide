# Phase 5 — Cross-Module Integration — Verification Log

Date: 2026-09-26. Method: static seam analysis (no emulator/device/Firestore
emulator available in this environment — runtime traces deferred to Phase 6).

## Seam checks performed (all via direct reads/greps of the working tree)

### Contracts vs payloads — PASS
- `verified_location` (contracts/verified_location.json): publisher
  (`modules/tracking/src/locationPublisher.ts`) emits exactly the 10 contract
  fields in snake_case (`rider_id`, `group_id`, `timestamp_hlc`, `lat`, `lng`,
  `speed_mps`, `heading_deg`, `spoof_flag`, `nis_score`, `accuracy_m`).
  Server validator (`modules/routing-eta/server/index.js`) requires
  `rider_id`/`group_id`/`timestamp_hlc`(string)/`lat`/`lng` — matches.
- `route_contract` (contracts/route_contract.json): server builds the response
  with all 6 required fields (`route_id`, `path_points`, `distance_km`,
  `eta_minutes`, `safety_score`, `recalculated_at_hlc`) and self-validates via
  `validateRouteResponse()` before sending. No contract change needed; frozen
  contracts untouched.

### HLC — PASS
- Canonical colon format `physical:counter` (`HLC_SEPARATOR = ':'`).
- Tracking's `hlcStore` imports from `@hazard/hlc/hlc` — one shared MMKV clock
  (`id: 'hlc'`, key `hlc_state`) across tracking and hazard/SOS modules.
  Legacy dash form still parsed for old queued timestamps.

### State / subscriptions — PASS
- `ridersStore.subscribe()`: duplicate-subscribe guard (`subscribed && groupId`
  match → no-op); switching groups drops the old subscription first; reconnect
  re-emits `join-group` (server forgets rooms on disconnect); `unsubscribe()`
  removes all three handlers; client-side `group_id` filter as defence-in-depth
  alongside the server room.

### Identity — PASS
- No `demo-group`/`demo-rider` in production paths (only a comment noting the
  fallback was removed). Group/rider IDs flow from `appStore` throughout.

### Network / socket rooms — PASS
- Server: `join-group` → `socket.join('group:{groupId}')`; `location:update`
  validated then `socket.to(room).emit` (sender excluded — no echo).
- Client emits `join-group`/`leave-group` from ridersStore.
- `SOCKET_URL` from env; localhost only as dev default with a device-facing
  warning comment. No hardcoded localhost in device paths.

### Map layers — PASS
- All four overlays (`RiderMarkerOverlay`, `HazardOverlayMapLayer`,
  `SosOverlayMapLayer`, `RouteOverlay`) are children of `<MapboxGL.MapView>`
  (lines 243–258). Panels/FABs outside.

### Firebase rules vs code paths — PASS (static)
- Code collections: `groups`, `groups/{id}/locations`, `groups/{id}/reports`,
  `hazards`, `sos_events`, `users` — all covered in `infra/firebase/firestore.rules`
  with auth-gated group-membership checks. Contract transports agree
  (`sos_events/{sos_id}`, `hazards/{cluster_id}` top-level).

## Flow checklist (static trace)

- [x] A: Tracking → Server → Riders Store → Map UI — publisher → socket →
      server validation/broadcast → ridersStore upsert → RiderMarkerOverlay
- [x] B: Hazards → Firestore → Clustering → Map → Routing — hazardService
      `subscribeToHazardClusters` → HazardOverlayMapLayer + RouteOverlay recalc
      with `avoid_hazard_types` (100m movement gate against jitter storms)
- [x] B: SOS → Offline persistence → Sync → Firestore → Notification — OR-Set
      persisted to MMKV BEFORE network attempt; tombstone on resolve; queued
      sync via syncWorker
- [x] C: Destination → Routing → Hazards → Safety → ETA → Map/UI — POST /route
      with hazard penalty + safety score + ETA model; RoutePanel displays
- [x] UI: all modules → real data — no fake feeds (spec-directed HISTORY "—"
      and labeled placeholders documented in Phase 4 log)

## Findings

No new seam bugs found. All 5 flows trace end-to-end at the code level.
Runtime confirmation (socket reconnect storms, Firestore rule enforcement,
on-device Mapbox render) requires a device/emulator — deferred to Phase 6.

## Status: PHASE 5 — PASS (static verification only; runtime deferred)
