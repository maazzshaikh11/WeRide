# Phase 3 — Publish pipeline & offline resilience

**Objective:** Complete `LocationPublisher` (late-joiner read, offline queue) and wire `HLC` with persistence.

---

## Task 3.1 — Wire real HLC with persistence

- **Description:** `TrackingService` takes `HlcSource` but nothing constructs `HLC.fresh()` or persists state. HLC must survive app restart (spec §B README: "app restart must not reset HLC").
- **Why it is required:** If HLC resets, causal ordering breaks; B's CRDT merges break; C's `recalculated_at_hlc` breaks.
- **Files/components affected:** `modules/tracking/src/trackingService.ts` (construct `HLC.fresh()`), `modules/tracking/src/hlcStore.ts` (new — MMKV-backed `toState`/`fromState`), `app/src/services/localStorage.ts` (MMKV instance).
- **Dependencies:** None (HLC exists in `@hazard/*`).
- **Expected deliverable:** On `TrackingService.start`, load `HLC.fromState(mmkv.get('hlc'))` or `HLC.fresh()`; on each tick, `mmkv.set('hlc', hlc.toState())`.
- **Definition of Done:** Kill app mid-ride, relaunch → next `timestamp_hlc` is causally after the last.

---

## Task 3.2 — Late-joiner Firestore read path

- **Description:** No code reads `groups/{gid}/locations/{riderId}`. Spec §6 Week 4: "open the app fresh mid-ride → reads Firestore → shows last-known position immediately, then live updates flow over Socket.io."
- **Why it is required:** Late joiners see a blank map for seconds until next Socket emit.
- **Files/components affected:** `modules/tracking/src/locationPublisher.ts` (add `fetchLastKnown`), `app/src/screens/map/overlays/RiderMarkerOverlay.tsx` (call on mount).
- **Dependencies:** Phase 4 (marker overlay) — or stub the read in publisher first.
- **Expected deliverable:** `LocationPublisher.fetchLastKnown(groupId, riderId): Promise<VerifiedLocationPayload | null>`.
- **Definition of Done:** Cold open with no socket → last-known marker appears from Firestore.

---

## Task 3.3 — Offline queue for Socket emits

- **Description:** `publish` emits to Socket unconditionally; if offline, the emit is lost. Spec §5 + §11 last row (offline cold-start): "does your EKF resume correctly and re-publish on reconnect?"
- **Why it is required:** Socket.io client may buffer, but `location:update` events while disconnected are dropped by default unless `reconnect` + ack.
- **Files/components affected:** `modules/tracking/src/locationPublisher.ts`.
- **Dependencies:** None.
- **Expected deliverable:** On socket disconnect, buffer payloads; on reconnect, flush latest N (don't replay all — just the most recent per rider).
- **Definition of Done:** Simulate disconnect mid-ride, reconnect → latest position appears, not stale.

---

## Task 3.4 — Firestore write error handling

- **Description:** `.set(payload)` is fire-and-forget. Firestore writes can fail (permissions, offline). Should `.catch` and optionally requeue.
- **Why it is required:** Silent write failure → late-joiner path serves stale data.
- **Files/components affected:** `modules/tracking/src/locationPublisher.ts`.
- **Dependencies:** Task 3.3 (queue infra).
- **Expected deliverable:** `.set().catch(...)` logs via `console.warn` (allowed per ESLint `no-console: warn`) and requeues next tick.
- **Definition of Done:** Denied Firestore permission → warning, app continues, Socket still works.