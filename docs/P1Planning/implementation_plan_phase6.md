# Implementation Plan: WeRide Phase 6 — Person 1
## Version 2 — Post-Verification Update (2026-08-28)

---

## Source Document Availability

| Document | Status | Notes |
|---|---|---|
| `docs/P1Planning/phase6_tasks.md` | ✅ Found | Primary Phase 6 task source |
| `docs/P1Planning/person1_PhaseWisePlan.md` | ✅ Found | Phase map and dependency graph |
| `WeRide_Project_Spec.md` | ✅ Found | Frozen contracts, timeline |
| `docs/Development/Person_A_Tracking_AntiSpoofing.md` | ✅ Found | (Previously reported missing — confirmed found in `docs/Development/`) |
| `docs/Development/Person_D_FL_VOX.md` | ✅ Found | Used to resolve Task 6.3 ride-buffer dependency |

**Correction from v1:** `Person_A_Tracking_AntiSpoofing.md` was located at `docs/Development/Person_A_Tracking_AntiSpoofing.md` (not at the root). It was found during this verification pass.

---

## graphify Status

`graphify-out/graph.json` was **not present** (directory exists but graph was not built). All verification performed via direct file reads and grep searches. No graphify commands were run; the output directory was not modified.

---

## Initial Git State (confirmed unchanged throughout)

- **31 staged files** (Phase 0–5 changes, all FROZEN)
- **5 unstaged modified files** (`.gitignore`, `modules/tracking/README.md`, `modules/tracking/src/ekf.ts`, `modules/tracking/src/sensorStream.ts`, `modules/tracking/test/ekf.test.ts`) — FROZEN
- **Untracked**: `.opencode/`, `docs/P1Planning/`, `graphify-out/`, `modules/tracking/package-lock.json`

---

---

## AMBIGUITY 1 — HLC Instantiation

### ✅ VERIFIED — FULLY RESOLVED

**Question:** Does `HLC.fresh()` exist? Does the returned object satisfy `TrackingService`'s concrete `hlc: HLC` parameter?

**Finding from direct read of `modules/hazard-sos/src/hlc/hlc.ts`:**

```typescript
// Line 28-31 — confirmed static factory exists
static fresh(now?: NowFn): HLC {
  const n = now ?? (() => Date.now());
  return new HLC({ physical: n(), counter: 0 }, n);
}
```

`HLC.fresh()` is a **static factory method** on the `HLC` class that returns a `new HLC(...)` instance. It is **not** a namespace or namespace member — it is directly callable as `HLC.fresh()`.

The full public API of `HLC` (confirmed from file):

| Method/Property | Type | Notes |
|---|---|---|
| `static fresh(now?)` | `() => HLC` | Factory — creates new zero-counter HLC |
| `static fromState(state, now?)` | `(HlcState, NowFn?) => HLC` | Restores from persisted state |
| `static compare(a, b)` | `(string, string) => number` | Orders two HLC strings |
| `now()` | `() => string` | Advances clock, returns `"physical:counter"` string |
| `receive(remote)` | `(string) => string` | Merges remote HLC |
| `toState()` | `() => HlcState` | Returns `{physical, counter}` for MMKV persistence |
| `get physical` | `number` | Read-only |
| `get counter` | `number` | Read-only |

**`TrackingService` parameter check** (from `modules/tracking/src/trackingService.ts` L37):
```typescript
/** Must be a concrete HLC instance so TrackingService can persist state. */
hlc: HLC;
```
`HLC.fresh()` returns `HLC` → type is **exactly satisfied**. ✅

**`@hazard/*` alias resolution** (confirmed in both tsconfigs):

| Package | Alias | Resolves to |
|---|---|---|
| `modules/tracking/` | `@hazard/*` | `../hazard-sos/src/*` |
| `app/` | `@hazard/*` | `../modules/hazard-sos/src/*` |

So the import in `MapScreen.tsx` must be:
```typescript
import { HLC } from '@hazard/hlc/hlc';
```
This resolves to `modules/hazard-sos/src/hlc/hlc.ts`. ✅

**`hlcStore.ts` integration** (confirmed from `modules/tracking/src/hlcStore.ts` L44–57):

```typescript
export function loadHlc(): HLC {
  const raw = getMmkv().getString(HLC_MMKV_KEY);
  if (raw) {
    try {
      const state: HlcState = JSON.parse(raw);
      if (typeof state.physical === 'number' && typeof state.counter === 'number') {
        return HLC.fromState(state);   // restores persisted HLC
      }
    } catch { /* fall through */ }
  }
  return HLC.fresh();  // first launch / corrupted
}
```

**Conclusion for Task 6.1/6.2:** The correct pattern for wiring in `MapScreen.tsx` is:

```typescript
import { loadHlc } from '@tracking/hlcStore';   // loads persisted OR creates fresh HLC
// ...
const hlc = loadHlc();  // returns concrete HLC instance
const service = new TrackingService({ ekf, sensors, publisher, hlc });
```

This satisfies:
- `HLC.fresh()` called internally by `loadHlc()` on first launch — ✅
- `HLC.fromState()` called for restarts — ✅ (persistent across app restart as required)
- Concrete `HLC` type passed to `TrackingService` — ✅
- `@hazard/hlc/hlc` import path resolves in `app/` — ✅
- `@tracking/hlcStore` import path resolves in `app/` (alias confirmed in `app/tsconfig.json`) — ✅

**There is no ambiguity here.** The implementation path is deterministic.

---

## AMBIGUITY 2 — Ride-Data Buffer (Task 6.3)

### 🚫 BLOCKED — SCHEMA NOT DEFINED IN ANY CONTRACT FILE

**Question:** Is there a `contracts/ride_buffer.json` or any agreed schema for the ride-data buffer?

**Finding from direct file read of `contracts/`:**

```
contracts/
  README.md             ← "no solo contract changes"
  fl_model_update.json  ← Internal to D (no raw ride data)
  hazard_cluster.json
  hazard_report.json
  route_contract.json
  sos_event.json
  verified_location.json
  vox_signal.json
```

There is **no `ride_buffer.json`** in `contracts/`. No schema exists anywhere in the repository.

**Confirmation from source documents:**

- `docs/Development/Person_A_Tracking_AntiSpoofing.md` (L133):
  > "Coordinate the shape of this buffer with D — it's not in §6, so define it in a weekly sync and add to `/contracts`."

- `docs/P1Planning/phase6_tasks.md` (L38):
  > "**Undecided:** Buffer schema + sample cap. Must be agreed in weekly sync per `contracts/README.md`. Do not solo-edit contracts."

- `docs/Development/Person_D_FL_VOX.md` (L159):
  > Person D's own dependency table: Person A owes "(Optional) A local ride-data buffer shape if FL uses location data — coordinate the shape in a sync, add to `/contracts` — Define by Week 4"

- `contracts/fl_model_update.json` explicitly states:
  > "No raw ride data. The ONLY payload that leaves the device for FL."

**Critical observation from `Person_D_FL_VOX.md` §3.1.2 (L74-79):** What D's FL model actually trains on is **undecided** — three options are listed (ETA refinement, riding-behavior analytics, or a toy model on synthetic data). The ride-buffer shape is downstream of this decision. If D chooses Option C (toy synthetic data), **no ride buffer from A is needed at all**.

**Status: Task 6.3 is BLOCKED/DEFERRED.** The exact information required from Person D before any code or contract can be written:

1. **Which FL model option is chosen** (§3.1.2 Options A/B/C) — determines if a ride buffer is needed at all.
2. **If a buffer is needed:** exact field set, sample cap (N), and sampling frequency.
3. **All-4-member contract review** per `contracts/README.md` before `contracts/ride_buffer.json` is created.

**What CAN be implemented without D's decision:**
- The ring-buffer data structure itself (`rideBuffer.ts`) can be written with the sample shape already implied by the Phase 6 task description (`{lat, lng, speed_mps, heading_deg, timestamp_hlc}`) and a configurable cap — since the shape is a natural projection of `VerifiedLocationPayload` which is already frozen. However, `contracts/ride_buffer.json` must NOT be created solo, and D must confirm the shape before it is exported as a formal interface.

---

---

## Exact Phase 6 Tasks — Verified

### Task 6.1 — Construct `TrackingService` in app
*Source: `phase6_tasks.md` L7-14; `WeRide_Project_Spec.md` §8 Week 4*

**Status: ✅ READY FOR IMPLEMENTATION**

**Implementation steps (exact):**

1. In `app/src/screens/map/MapScreen.tsx`:
   - Add `useEffect` with `groupId` + `userId` guard.
   - Import `loadHlc` from `@tracking/hlcStore`.
   - Import `Ekf` from `@tracking/ekf`, `SensorStream` from `@tracking/sensorStream`, `LocationPublisher` from `@tracking/locationPublisher`, `TrackingService` from `@tracking/trackingService`.
   - Import `getLocationSocket` from `../../services/socketService`.
   - Import `useAppStore` from `../../store/appStore` (already imported).
   - Instantiate `Ekf`, `SensorStream`, `LocationPublisher` (with socket from `getLocationSocket()`), `HLC` via `loadHlc()`.
   - Construct `TrackingService({ ekf, sensors, publisher, hlc })`.
   - Call `service.start()` on mount, `service.stop()` on unmount cleanup.

**Frozen contracts respected:**
- `TrackingService` constructor signature not modified.
- `LocationPublisher` constructor signature not modified.
- `ridersStore.subscribe(groupId)` already called by `RiderMarkerOverlay` (Phase 4) — no duplicate subscription needed.

---

### Task 6.2 — Consume `@hazard/*` HLC
*Source: `phase6_tasks.md` L18-25*

**Status: ✅ READY FOR IMPLEMENTATION (merged into Task 6.1)**

The correct mechanism is `loadHlc()` from `@tracking/hlcStore`, which internally calls `HLC.fresh()` (first launch) or `HLC.fromState()` (restarts), both from `@hazard/hlc/hlc`. This satisfies the spec requirement ("Do not roll your own HLC") and the persistence requirement (HLC survives app restart via MMKV).

**The import `import { HLC } from '@hazard/hlc/hlc'` does NOT need to appear in `MapScreen.tsx` directly** — `loadHlc()` already encapsulates it. This is already implemented correctly in Phase 3's `hlcStore.ts`.

---

### Task 6.3 — Ride-data buffer for Person D (FL)
*Source: `phase6_tasks.md` L29-38; `Person_A_Tracking_AntiSpoofing.md` L133; `Person_D_FL_VOX.md` L159*

**Status: 🚫 BLOCKED — requires Person D decision**

**Blocked on:**
1. D's FL model option selection (Options A/B/C in `Person_D_FL_VOX.md` §3.1.2).
2. Exact field set and sample cap agreement.
3. All-4-member contract sign-off per `contracts/README.md`.

**What can proceed without unblocking:**
- `modules/tracking/src/rideBuffer.ts` structural implementation (ring buffer with configurable cap, using the natural `VerifiedLocationPayload` projection as sample shape), marked as draft/internal-only until contract is signed.
- Export from `modules/tracking/src/index.ts` can be added.
- `contracts/ride_buffer.json` must NOT be created until all 4 members agree.

---

### Task 6.4 — Provide route origin to Person C
*Source: `phase6_tasks.md` L42-49; `WeRide_Project_Spec.md` §5.2*

**Status: ✅ VERIFIED — no A code change required**

C reads `verified_location` from the `location:update` Socket event or from `ridersStore`. Both are already available via Phase 3 (`LocationPublisher`) and Phase 4 (`ridersStore`). No new API from Person A is needed. Deliverable = documented agreement in sync notes.

---

### Task 6.5 — Provide coords to Person B (hazard/SOS)
*Source: `phase6_tasks.md` L53-60; `WeRide_Project_Spec.md` §5.2*

**Status: ✅ VERIFIED — no A code change required**

B reads `verified_location` from the same `location:update` Socket event and/or `ridersStore`. Both available. No new API from Person A. Deliverable = documented agreement.

---

---

## Proposed File Changes (Final)

| File | Action | Status |
|---|---|---|
| `app/src/screens/map/MapScreen.tsx` | MODIFY — add `useEffect` to start/stop `TrackingService` on mount | READY |
| `modules/tracking/src/rideBuffer.ts` | NEW — ring buffer, draft, internal-only until contract agreed | CAN DRAFT (not export as formal contract) |
| `modules/tracking/src/index.ts` | MODIFY — export `RideBuffer` | Deferred until 6.3 unblocked or draft decision made |
| `contracts/ride_buffer.json` | NEW — frozen schema for D | **BLOCKED** — do not create solo |

---

## Frozen Phase 0–5 Contracts — Must Not Change

| Item | Location | Confirmed by |
|---|---|---|
| `verified_location` schema (10 fields) | `contracts/verified_location.json` | Direct file read |
| `TrackingService` constructor signature (`ekf, sensors, publisher, hlc`) | `modules/tracking/src/trackingService.ts` L32-38 | Direct file read |
| `LocationPublisher` constructor and `publish()` API | `modules/tracking/src/locationPublisher.ts` | Direct file read |
| `ridersStore` Zustand API (`subscribe`, `unsubscribe`, `upsertRider`, `MarkerState`) | `app/src/store/ridersStore.ts` | Direct file read |
| `MockLocationProducer` Phase 5 behavior | `modules/tracking/src/mockLocationProducer.ts` | Staged (frozen) |
| `HlcSource` interface | `modules/tracking/src/trackingService.ts` L28-30 | Direct file read |
| `loadHlc()` / `persistHlc()` API | `modules/tracking/src/hlcStore.ts` | Direct file read |
| `HLC` class API | `modules/hazard-sos/src/hlc/hlc.ts` | Direct file read — must NOT be modified (Person B owns) |

---

## Dependency Matrix

| Dependency | What Phase 6 needs | Current status |
|---|---|---|
| Person B — `HLC` | `HLC.fresh()`, `HLC.fromState()`, `hlc.now()`, `hlc.toState()` | ✅ Fully implemented at `modules/hazard-sos/src/hlc/hlc.ts` |
| Person B — `HlcState` type | `{physical: number, counter: number}` | ✅ Exported from same file |
| `@hazard/hlc/hlc` alias | Resolves in `app/` and `modules/tracking/` | ✅ Confirmed in both `tsconfig.json` |
| `loadHlc()` / Phase 3 | Persistence-aware HLC factory | ✅ Implemented in `hlcStore.ts` (Phase 3) |
| Person D — ride buffer schema | Field set, cap, frequency | 🚫 Not decided — weekly sync required |
| `getLocationSocket()` | Shared Socket.io client | ✅ `app/src/services/socketService.ts` |
| `useAppStore` (`userId`, `groupId`) | App-level auth state | ✅ `app/src/store/appStore.ts` |

---

## Test Strategy — Phase 6

### AUTOMATED TESTABLE

| Test | File | Description |
|---|---|---|
| `trackingService_starts_on_mapscreen_mount` | `app/__tests__/mapScreen.test.tsx` (new) | Mock `TrackingService`, assert `.start()` called when `groupId` + `userId` are set |
| `trackingService_stops_on_unmount` | Same file | Assert `.stop()` called in `useEffect` cleanup |
| `trackingService_no_start_without_groupId` | Same file | Guard: if `groupId` is null, `start()` must not be called |
| `rideBuffer_addSample_and_getHistory` | `modules/tracking/test/rideBuffer.test.ts` (new) | Add N samples, assert all returned |
| `rideBuffer_ring_eviction` | Same file | Add cap+1 samples, assert oldest evicted, length stays at cap |
| `rideBuffer_empty_returns_empty_array` | Same file | `getHistory()` on fresh buffer returns `[]` |
| `loadHlc_returns_fresh_on_first_call` | Already covered by `hlcStore.test.ts` (Phase 3) | Pre-existing |
| `loadHlc_restores_from_mmkv` | Already covered by `hlcStore.test.ts` | Pre-existing |

### REQUIRES PHYSICAL DEVICE / MANUAL VALIDATION

| Test | Description |
|---|---|
| Real device publishes `verified_location` | On `MapScreen` mount with valid `groupId` + `userId`, confirm `location:update` socket event fired at 1 Hz |
| Marker appears on another device's map | Second device with same `groupId` shows first rider's marker going green |
| HLC survives app restart | Force-close and reopen; confirm `timestamp_hlc` values continue from last `physical` (not reset to 0) |

---

## Acceptance Criteria — Phase 6

| Task | Criterion | Verifiable |
|---|---|---|
| 6.1 | On `MapScreen` mount with valid `groupId` + `userId`, `TrackingService.start()` is called | Automated (mock) + manual |
| 6.1 | On `MapScreen` unmount, `TrackingService.stop()` is called | Automated |
| 6.1 | If `groupId` or `userId` is null, service does NOT start | Automated |
| 6.2 | `timestamp_hlc` in published payload is `HLC`-formatted (`"physical:counter"`) from `loadHlc()` | Existing `hlcStore.test.ts` covers persistence; integration confirmed by manual device test |
| 6.3 | BLOCKED — deferred until schema agreed | N/A |
| 6.4/6.5 | Documented in sync notes that B and C read from `location:update` / `ridersStore` | Coordination only |

---

## What is NOT Phase 6

- EKF math corrections (Phase 1).
- `SensorStream` downsampling / background location (Phase 2).
- Offline queue / reconnect flush in `LocationPublisher` (Phase 3).
- `RiderMarkerOverlay` UI, stale handling, NIS card (Phase 4).
- `MockLocationProducer` / `demo.ts` changes (Phase 5).
- Socket.io room-joining protocol (noted in Phase 4/6 plans as deferred — no room protocol currently exists; Phase 6 does NOT unilaterally add one).
- CPU/battery profiling (Phase 8).
- Spotify/music integration (P2, cut per spec §4.1).

---

## Diff vs. Version 1

| Section | Change |
|---|---|
| Source Document Gaps | **Removed** — `Person_A_Tracking_AntiSpoofing.md` now confirmed found at `docs/Development/` |
| Ambiguity 1 (HLC) | **Resolved** — `HLC.fresh()` verified, `loadHlc()` pattern documented, import path confirmed, both tsconfig aliases confirmed |
| Ambiguity 2 (RideBuffer) | **Clarified** — conclusively BLOCKED, reason documented (no contract exists, D's model option undecided, contracts/README.md prohibits solo edits) |
| Task 6.2 | **Updated** — clarified that `loadHlc()` is the correct integration point (not a raw `HLC.fresh()` call in MapScreen) |
| Proposed file changes | **Updated** — `contracts/ride_buffer.json` now explicitly marked BLOCKED, `rideBuffer.ts` can be drafted as internal-only |
| Dependencies table | **Added** — explicit status for every dependency |
| Frozen contracts table | **Expanded** — lists all Phase 0–5 frozen items with file locations |
| Test strategy | **Expanded** — split AUTOMATED vs. PHYSICAL DEVICE, with specific test names |
| Acceptance criteria | **Added** — per-task, explicit |

---

## Final Confirmation

- ✅ No source code was modified.
- ✅ `git status` is identical to the initial check — all Phase 0–5 staged changes remain staged.
- ✅ No `git add`, `commit`, `push`, `reset`, `restore`, or `checkout` commands were run.
- ✅ `graphify-out/` was not rebuilt or modified.
- ✅ Person B's `HLC` implementation was not touched.
