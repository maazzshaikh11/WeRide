# Person B — Hazard Detection + Offline SOS: Revised 8-Phase Implementation Plan

---

# Plan Revision Summary

## Why the 12-Phase Structure Was Reduced

The original 12-phase plan contained several areas of over-engineering and unnecessary separation:

1. **Infrastructure overhead separated into multiple phases** - Setup tasks were spread across Phases 1, 3, and portions of later phases
2. **Mock infrastructure given excessive attention** - Phase 3 was dedicated to mock producers when mocks should be lightweight early deliverables within the foundation phase
3. **Core algorithms unnecessarily separated** - DBSCAN (Phase 4), CRDT (Phase 5), and Offline Queue (Phase 6) were separate phases when they represent a cohesive "core algorithms" layer
4. **Services and integration over-divided** - Hazard Service (Phase 7) and SOS Service (Phase 8) could be combined as both are the same layer of real Firestore integration
5. **UI phases separated unnecessarily** - UI Components (Phase 9) and Map Overlays (Phase 10) are both UI layer and should be built together
6. **Excessive testing and documentation phases** - Integration Testing (Phase 11) and Documentation/Demo (Phase 12) had significant overlap and redundant tasks

## What Was Merged

### Phase Merges:
- **Old Phases 1 + 3** → **New Phase 1 (Foundation & Mocks)**: Infrastructure setup combined with mock producer delivery
- **Old Phases 4 + 5 + 6** → **New Phase 3 (Core Algorithms)**: DBSCAN, CRDT, and Offline Queue merged as they're the core offline-resilience machinery
- **Old Phases 7 + 8** → **New Phase 5 (Services & Integration)**: Hazard and SOS services combined as they share the same integration layer
- **Old Phases 9 + 10** → **New Phase 6 (UI & Overlays)**: UI components and map overlays built together
- **Old Phases 11 + 12** → **New Phase 8 (Testing & Documentation)**: Integration testing and final documentation combined

### Phase Preservation (with refinement):
- **Old Phase 2** → **New Phase 2 (HLC - Critical Dependency)**: Kept as separate phase due to critical cross-team dependency
- **New Phase 4 (Offline-Resilient Storage)**: Carved out from old Phases 5-6 to focus specifically on the MMKV queue and sync logic
- **New Phase 7 (Integration Testing)**: Focused integration testing before final documentation

## What Unnecessary/Over-Engineered Items Were Removed

1. **Incremental reclustering optimization** - Removed from Phase 4; while mentioned in spec §3.1 as `# ponytail`, it's an optimization not required for MVP
2. **Demo functions in every phase** - Removed repetitive demo functions from each phase; kept single demo in final phase
3. **Excessive coordination checkpoints** - Reduced redundant "coordinate with Person A/C" tasks; kept critical coordination points only
4. **Map clustering for dense hazards** - Removed from Phase 10; not required by spec, listed as optional P2
5. **Performance benchmarking infrastructure** - Simplified to basic documentation; removed elaborate profiling tasks
6. **Elaborate demo backup infrastructure** - Simplified demo prep; screen recording mentioned but not elaborate backup systems
7. **Periodic sync worker (30-second interval)** - Simplified to on-reconnect sync only; periodic sync is optimization not explicitly required
8. **Complex retry logic with exponential backoff** - Simplified to basic retry count; elaborate backoff not required
9. **Git tagging and release process** - Removed git workflow tasks that aren't implementation deliverables
10. **Multiple demo rehearsals** - Simplified to single demo preparation phase
11. **Hazard resolution by nearby riders** - Removed from Phase 10; spec doesn't require non-owners to resolve hazards
12. **Marker clustering for dense areas** - Removed; not required by spec
13. **Optimistic UI complexity** - Simplified to basic immediate local display; removed elaborate optimistic state management

## Confirmation: No Required Person B Functionality Was Removed

All required items from Person_B_Hazard_SOS.md remain in the plan:
- ✅ Hazard reporting (Phase 1, 5, 6)
- ✅ Required hazard data/contracts (Phase 1)
- ✅ DBSCAN hazard clustering (Phase 3)
- ✅ Hazard cluster generation and handling (Phase 3, 5)
- ✅ Required hazard scoring logic (Phase 3)
- ✅ Hazard integration with app/map (Phase 5, 6)
- ✅ HLC implementation and persistence (Phase 2)
- ✅ CRDT OR-Set implementation (Phase 3)
- ✅ SOS creation and resolution (Phase 3, 5)
- ✅ Accidental SOS prevention (Phase 6)
- ✅ Offline storage/queue (Phase 4)
- ✅ Reconnection and synchronization (Phase 4)
- ✅ Required Firestore integration (Phase 5)
- ✅ Required SOS notification flow (Phase 5)
- ✅ Required tests (Phase 7, 8)
- ✅ Required module documentation (Phase 1, 8)
- ✅ Required integration points (Phase 2, 5, 7)

---

# Required Scope Coverage Check

| Required Person B Item | Source | Covered in New Phase |
|---|---|---|
| **Contracts** | Person_B_Hazard_SOS.md §2 | Phase 1 |
| `hazard_cluster` contract definition | §2.1 | Phase 1, Task 1 |
| `sos_event` contract definition | §2.2 | Phase 1, Task 1 |
| `hazard_report` internal contract | §2.3 | Phase 1, Task 1 |
| **Algorithms** | Person_B_Hazard_SOS.md §3 | Phase 2, 3 |
| HLC implementation (critical cross-team) | §3.2 | Phase 2 |
| HLC persistence across restarts | §3.2 | Phase 2 |
| HLC.now(), receive(), compare(), toString() | §3.2 | Phase 2 |
| DBSCAN clustering algorithm | §3.1 | Phase 3 |
| DBSCAN per-type clustering | §3.1 | Phase 3 |
| DBSCAN noise report handling | §3.1 | Phase 3 |
| hazard_score calculation | §3.1 | Phase 3 |
| polygon_points (bounding box) | §3.1 | Phase 3 |
| **CRDT** | Person_B_Hazard_SOS.md §3.3 | Phase 3 |
| OR-Set add operation | §3.3 | Phase 3 |
| OR-Set remove/resolve with tombstone | §3.3 | Phase 3 |
| OR-Set merge operation | §3.3 | Phase 3 |
| **Offline Resilience** | Person_B_Hazard_SOS.md §3.3 | Phase 4 |
| Local queue with MMKV | §3.3 | Phase 4 |
| Sync worker for reconnect | §3.3 | Phase 4 |
| Zero data loss guarantee | §3.3 | Phase 4 |
| **Services** | Person_B_Hazard_SOS.md §8 | Phase 5 |
| hazardService for report submission | §8 | Phase 5 |
| sosService for SOS trigger/resolve | §8 | Phase 5 |
| Firestore integration (hazards, sos_events) | §2.1, §2.2 | Phase 5 |
| Real-time Firestore listeners | §2.1 | Phase 5 |
| FCM push notification trigger | §3.3 | Phase 5 |
| **UI Screens** | Person_B_Hazard_SOS.md §4 | Phase 6 |
| Hazard Report Button + Type Picker | §4.1 | Phase 6 |
| SOS Button with accidental prevention | §4.2 | Phase 6 |
| Hazard Markers on Live Map | §4.3 | Phase 6 |
| **Mock Producers** | Person_B_Hazard_SOS.md §5.2 | Phase 1 |
| Mock HLC (Day 2 deadline) | §5.2 | Phase 1 |
| Mock hazard_cluster producer | §5.2 | Phase 1 |
| Mock sos_event producer | §5.2 | Phase 1 |
| **Tests** | Person_B_Hazard_SOS.md §7 | Phase 7, 8 |
| dbscan_cluster_boundary | §7 | Phase 7 |
| dbscan_noise_report | §7 | Phase 7 |
| dbscan_type_separation | §7 | Phase 7 |
| hlc_ordering | §7 | Phase 7 |
| hlc_persistence | §7 | Phase 7 |
| crdt_sos_merge_convergent | §7 | Phase 7 |
| crdt_resolve_tombstone | §7 | Phase 7 |
| offline_queue_durability | §7 | Phase 7 |
| sos_single_tap_guard | §7 | Phase 7 |
| mock_producer_contract | §7 | Phase 7 |
| **Documentation** | Person_B_Hazard_SOS.md §8 | Phase 1, 8 |
| README with DBSCAN params, HLC algo, CRDT merge, FCM | §8 | Phase 1, 8 |
| **Integration** | WeRide_Project_Spec.md | Phase 2, 5, 7 |
| Person A integration (verified_location) | §5.1 | Phase 5, 7 |
| Person C integration (hazard_cluster stream) | §5.1 | Phase 5, 7 |
| Person D integration (HLC usage) | §5.1 | Phase 2 |
| **Files** | Person_B_Hazard_SOS.md §8 | All Phases |
| modules/hazard-sos/src/hlc/hlc.ts | §8 | Phase 2 |
| modules/hazard-sos/src/dbscan/dbscan.ts | §8 | Phase 3 |
| modules/hazard-sos/src/crdt/orSet.ts | §8 | Phase 3 |
| modules/hazard-sos/src/crdt/localQueue.ts | §8 | Phase 4 |
| modules/hazard-sos/src/crdt/syncWorker.ts | §8 | Phase 4 |
| modules/hazard-sos/src/services/hazardService.ts | §8 | Phase 5 |
| modules/hazard-sos/src/services/sosService.ts | §8 | Phase 5 |
| modules/hazard-sos/src/ui/HazardReportSheet.tsx | §8 | Phase 6 |
| modules/hazard-sos/src/ui/SosButton.tsx | §8 | Phase 6 |
| modules/hazard-sos/src/ui/hazardMarker.ts | §8 | Phase 6 |
| modules/hazard-sos/src/index.ts | §8 | Phase 2, 5, 6 |
| modules/hazard-sos/README.md | §8 | Phase 1, 8 |
| modules/hazard-sos/test/hazardSos.test.ts | §8 | Phase 7 |
| contracts/hazard_cluster.json | §2.1 | Phase 1 |
| contracts/sos_event.json | §2.2 | Phase 1 |
| contracts/hazard_report.json | §2.3 | Phase 1 |
| app/src/screens/map/overlays/HazardOverlay.tsx | §8 | Phase 6 |
| app/src/screens/map/overlays/SosOverlay.tsx | §8 | Phase 6 |

---

# Revised 8-Phase Implementation Plan

## Phase 1 — Foundation, Contracts & Mock Producers

### Goal
Establish the frozen data contracts, development environment, and deliver mock producers by Week 1 Day 2 to unblock all other team members.

### Tasks

1. **Verify and freeze data contracts**
   - Confirm `contracts/hazard_cluster.json` matches spec §6.2 exactly
   - Confirm `contracts/sos_event.json` matches spec §6.3 exactly
   - Confirm `contracts/hazard_report.json` matches §2.3
   - All 4 team members review and approve (frozen contracts)

2. **Set up development environment**
   - Run `npm install` in `modules/hazard-sos/`
   - Verify `npm run lint && npm run typecheck && npm test` all pass
   - Fix any initial setup issues

3. **Document core parameters in README**
   - Add DBSCAN parameters: `eps=30m`, `min_samples=2`, cluster by type
   - Add hazard_score formula: `score = min(1, reportCount / 5) * recencyDecay`
   - Add polygon approach: "Bounding box (4 points) for MVP"
   - Note: Parameters will be tuned in Weeks 2-3

4. **Coordinate shared infrastructure**
   - Confirm Firebase project config available
   - Confirm Firestore security rules for `hazards/` and `sos_events/`
   - Request hazard type color map from Person C's `theme.ts`

5. **Implement mock HLC (Day 2 deadline - CRITICAL)**
   - File: `modules/hazard-sos/src/hlc/hlc.ts`
   - Simple implementation: `now()` returns `{ physical: Date.now(), counter: 0 }`
   - Mock `receive()`, `compare()`, `toString()` with trivial logic
   - Export from `src/index.ts`: `export { HLC } from './hlc/hlc'`
   - Ship to Person A, C, D by end of Week 1 Day 2

6. **Implement mock hazard_cluster producer (Day 2 deadline)**
   - File: `modules/hazard-sos/src/services/mockHazardService.ts`
   - Function: `generateMockHazardCluster(groupId: string)`
   - Generate random cluster matching exact contract schema
   - Emit to Firestore `hazards/{cluster_id}` periodically (~10s) for testing
   - Export from `src/index.ts`

7. **Implement mock sos_event producer (Day 2 deadline)**
   - File: `modules/hazard-sos/src/services/mockSosService.ts`
   - Function: `generateMockSosEvent(riderId, groupId, lat, lng)`
   - Generate SOS event matching exact contract schema
   - Emit to Firestore `sos_events/{sos_id}` on demand
   - Export from `src/index.ts`

8. **Write mock contract compliance test**
   - File: `modules/hazard-sos/test/hazardSos.test.ts`
   - Test: `mock_producer_contract` — verify mocks emit exact §6 schemas
   - Verify all required fields, correct enums, valid HLC format

9. **Coordinate with team**
   - Announce mock availability in Week 1 Day 2 sync
   - Verify Person C can integrate mock hazards
   - Verify Person A, D can import and use mock HLC

### Deliverables
- ✅ All contract files frozen and reviewed by all 4 team members
- ✅ Development environment working (`lint`, `typecheck`, `test` pass)
- ✅ `modules/hazard-sos/README.md` with documented parameters
- ✅ `modules/hazard-sos/src/hlc/hlc.ts` — mock HLC shipped by Day 2
- ✅ `modules/hazard-sos/src/services/mockHazardService.ts` — mock hazard producer
- ✅ `modules/hazard-sos/src/services/mockSosService.ts` — mock SOS producer
- ✅ `modules/hazard-sos/test/hazardSos.test.ts` — mock contract test
- ✅ `modules/hazard-sos/src/index.ts` — exports for all mocks

### Dependencies
- None (first phase)

### Definition of Done
- [ ] All 4 team members approve contract files
- [ ] Mock HLC shipped by Week 1 Day 2, Person A/C/D confirm import works
- [ ] Mock hazard_cluster and sos_event producers shipped by Day 2
- [ ] Mock contract compliance test passes
- [ ] Person C confirms mock hazards work for routing integration
- [ ] `npm run lint && npm run typecheck && npm test` passes

---

## Phase 2 — HLC Real Implementation (Critical Cross-Team Dependency)

### Goal
Replace mock HLC with the real implementation featuring persistence and causal ordering. This is the most critical unblocking dependency for all team members.

### Tasks

1. **Implement HLC data structure**
   - File: `modules/hazard-sos/src/hlc/hlc.ts` (replace mock)
   - Define TypeScript interface:
     ```typescript
     interface HLCState {
       physical: number;  // wall-clock timestamp (ms)
       counter: number;   // logical counter
     }
     ```

2. **Implement HLC.now()**
   - Algorithm (Kulkarni et al.):
     - Read physical clock: `Date.now()`
     - If `physical > state.physical`: set `state.physical = physical`, `state.counter = 0`
     - If `physical == state.physical`: increment `state.counter`
     - Return `{ physical, counter }`
   - Persist state to MMKV after each call

3. **Implement HLC.receive(remoteHlc)**
   - Algorithm:
     - `state.physical = max(state.physical, remoteHlc.physical, Date.now())`
     - If `state.physical > remoteHlc.physical`: `state.counter++`
     - Else: `state.counter = remoteHlc.counter + 1`
   - Persist state to MMKV after merge
   - Return updated state

4. **Implement HLC.compare(a, b)**
   - Compare `physical` first, then `counter` as tiebreaker
   - Return -1 (a < b), 0 (a == b), or 1 (a > b)

5. **Implement HLC serialization**
   - `toString()`: format `"{physical}-{counter}"` (e.g., "1678901234567-42")
   - `parse(str)`: parse string back to HLCState

6. **Implement HLC persistence with MMKV**
   - Store current state in MMKV box `hlc_state`
   - Load on module initialization (app startup)
   - Must NOT reset on app restart (breaks causal ordering)
   - Synchronous write on every state change

7. **Write comprehensive unit tests**
   - File: `modules/hazard-sos/test/hazardSos.test.ts`
   - Test: `hlc_ordering` — events timestamped offline then synced are correctly ordered
   - Test: `hlc_persistence` — app restart → HLC continues monotonically (no reset)
   - Test: Concurrent events on different devices → HLC merge converges

8. **Update exports and documentation**
   - Update `src/index.ts` to export real HLC (replace mock export)
   - Update README with usage example:
     ```typescript
     import { HLC } from '@hazard/hlc';
     const timestamp = HLC.now();
     ```

### Deliverables
- ✅ `modules/hazard-sos/src/hlc/hlc.ts` — complete real HLC implementation
- ✅ HLC persistence using MMKV
- ✅ Unit tests for ordering, persistence, and merge convergence
- ✅ Updated README with usage examples
- ✅ Updated `src/index.ts` exports

### Dependencies
- MMKV initialized in app shell (Week 1 Day 3)
- Mock HLC from Phase 1

### Definition of Done
- [ ] Real HLC passes all unit tests (ordering, persistence, merge)
- [ ] HLC state persists across app restarts (verified by test)
- [ ] Person A, C, D confirm real HLC works with their modules
- [ ] `npm run lint && npm run typecheck && npm test` passes

---

## Phase 3 — Core Algorithms: DBSCAN & CRDT OR-Set

### Goal
Implement the core hazard clustering (DBSCAN) and offline-resilient SOS (CRDT OR-Set) algorithms that form the foundation of Person B's functionality.

### Tasks

#### DBSCAN Hazard Clustering

1. **Create DBSCAN data structures**
   - File: `modules/hazard-sos/src/dbscan/dbscan.ts`
   - Define interfaces:
     ```typescript
     interface HazardReport {
       report_id: string;
       rider_id: string;
       group_id: string;
       hazard_type: string;
       lat: number;
       lng: number;
       timestamp_hlc: string;
       reported_at_hlc: string;
     }
     
     interface DBCluster {
       reports: HazardReport[];
       cluster_id: string;
     }
     ```

2. **Implement geographic distance calculation**
   - Function: `haversineDistance(lat1, lng1, lat2, lng2): number`
   - Returns distance in meters
   - Core metric for DBSCAN `eps` parameter

3. **Implement DBSCAN core algorithm**
   - Function: `dbscan(reports, eps=30, minSamples=2): DBCluster[]`
   - For each unvisited report:
     - Find neighbors within `eps` distance
     - If neighbors >= `minSamples`, start new cluster
     - Expand cluster by adding density-reachable neighbors
   - Noise points (no cluster) → single-report clusters with `report_count=1`

4. **Implement per-type clustering**
   - Function: `clusterByType(reports, eps, minSamples): DBCluster[]`
   - Group reports by `hazard_type` first
   - Run DBSCAN separately on each type group
   - Ensures different hazard types don't cluster together

5. **Implement cluster calculation functions**
   - `calculateCentroid(reports)`: return average lat/lng
   - `calculateBoundingBox(reports)`: return 4-point bounding box [[lat,lng], ...]
   - `calculateHazardScore(reportCount, latestReportTime)`: 
     - Formula: `score = min(1.0, reportCount / 5) * recencyDecay`
     - `recencyDecay = exp(-age_hours / 24)`

6. **Write DBSCAN unit tests**
   - Test: `dbscan_cluster_boundary` — two reports near boundary → one cluster
   - Test: `dbscan_noise_report` — isolated report → published with `report_count=1`
   - Test: `dbscan_type_separation` — different types nearby → separate clusters
   - Test: `haversine_distance` — verify accuracy
   - Test: `centroid`, `bounding_box`, `hazard_score` — verify correctness

#### CRDT OR-Set for SOS

7. **Create OR-Set data structures**
   - File: `modules/hazard-sos/src/crdt/orSet.ts`
   - Define interfaces:
     ```typescript
     interface SOSElement {
       sos_id: string;
       rider_id: string;
       group_id: string;
       lat: number;
       lng: number;
       created_at_hlc: string;
     }
     
     interface ORSet {
       adds: Map<string, SOSElement & { tag: string }>;
       tombstones: Set<string>;
     }
     ```

8. **Implement OR-Set operations**
   - `orSetAdd(set, element)`: add with unique tag (HLC + rider_id), idempotent
   - `orSetRemove(set, sos_id)`: add tag to tombstones (tombstone pattern for convergence)
   - `orSetMerge(local, remote)`: union adds, union tombstones, apply tombstones
   - `orSetGetActive(set)`: return elements whose tags NOT in tombstones

9. **Implement OR-Set persistence**
   - `orSetSave(set, storageKey)`: serialize to JSON, store in MMKV (synchronous)
   - `orSetLoad(storageKey)`: load from MMKV, deserialize, return ORSet or empty set

10. **Write OR-Set unit tests**
    - Test: `crdt_sos_merge_convergent` — two offline clients trigger SOS → merge → converge
    - Test: `crdt_resolve_tombstone` — resolve then re-open → convergent
    - Test: `crdt_add_idempotent` — adding same element twice → no duplicates
    - Test: `crdt_merge_commutative` — merge(A,B) = merge(B,A)
    - Test: `crdt_persistence` — save and load → state intact

### Deliverables
- ✅ `modules/hazard-sos/src/dbscan/dbscan.ts` — complete DBSCAN implementation
- ✅ `modules/hazard-sos/src/crdt/orSet.ts` — complete OR-Set implementation
- ✅ All calculation functions (centroid, bounding box, hazard score)
- ✅ Comprehensive unit tests for DBSCAN and CRDT
- ✅ All tests pass

### Dependencies
- HLC from Phase 2 (for timestamps)
- Contract files from Phase 1

### Definition of Done
- [ ] All DBSCAN unit tests pass (boundary, noise, type separation, distance, calculations)
- [ ] All OR-Set unit tests pass (convergence, tombstones, idempotence, commutativity, persistence)
- [ ] OR-Set survives app restart (persistence test passes)
- [ ] `npm run lint && npm run typecheck && npm test` passes

---

## Phase 4 — Offline-Resilient Storage & Sync

### Goal
Implement the local offline queue using MMKV and the sync worker that ensures zero data loss by persisting operations offline and syncing them when connectivity returns.

### Tasks

1. **Create local queue data structure**
   - File: `modules/hazard-sos/src/crdt/localQueue.ts`
   - Define interface:
     ```typescript
     interface QueuedOperation {
       id: string;
       type: 'hazard_report' | 'sos_event' | 'sos_resolve';
       data: any;
       created_at_hlc: string;
       retry_count: number;
     }
     ```

2. **Implement queue operations**
   - `queueEnqueue(queueName, operation)`: append operation, save to MMKV (synchronous)
   - `queueDequeue(queueName, operationId)`: remove operation, save to MMKV
   - `queuePeek(queueName)`: return all operations without modifying queue

3. **Implement connectivity detection**
   - File: `modules/hazard-sos/src/crdt/syncWorker.ts`
   - Use React Native `NetInfo` to detect online/offline state
   - Function: `isOnline(): Promise<boolean>`

4. **Implement sync worker for hazard reports**
   - Function: `syncHazardReports(groupId): Promise<void>`
   - Get pending hazard reports from queue
   - For each report:
     - Write to Firestore `groups/{group_id}/reports/{report_id}`
     - On success: dequeue
     - On failure: increment `retry_count`, keep in queue
     - If `retry_count > 3`: dequeue and log error

5. **Implement sync worker for SOS events**
   - Function: `syncSosEvents(groupId): Promise<void>`
   - Get pending SOS operations from queue
   - For each operation:
     - If `sos_event`: write to Firestore `sos_events/{sos_id}`
     - If `sos_resolve`: update Firestore with `resolved=true`, `resolved_at_hlc`
     - On success: dequeue
     - On failure: increment `retry_count`, keep in queue

6. **Implement CRDT merge-on-sync**
   - Function: `mergeSosOnSync(groupId): Promise<void>`
   - Load local OR-Set from MMKV
   - Fetch remote SOS events from Firestore `sos_events/` where `group_id` matches
   - Merge local and remote using `orSetMerge()`
   - Push local-only adds to Firestore (batch write)
   - Save merged OR-Set back to MMKV

7. **Implement automatic sync on reconnect**
   - Subscribe to `NetInfo` connectivity change events
   - When connectivity changes from offline → online:
     - Run `syncHazardReports()`
     - Run `syncSosEvents()`
     - Run `mergeSosOnSync()`

8. **Write offline queue tests**
   - Test: `queue_enqueue_dequeue` — verify FIFO behavior and persistence
   - Test: `offline_queue_durability` — trigger SOS offline → kill app → relaunch → queue intact, syncs
   - Test: `sync_retry` — failed sync → retry count increments

### Deliverables
- ✅ `modules/hazard-sos/src/crdt/localQueue.ts` — queue operations
- ✅ `modules/hazard-sos/src/crdt/syncWorker.ts` — sync logic
- ✅ Automatic sync on reconnect
- ✅ Unit tests for queue and sync
- ✅ Zero data loss verified by tests

### Dependencies
- OR-Set from Phase 3
- HLC from Phase 2
- MMKV initialized in app shell
- Firestore config

### Definition of Done
- [ ] Queue operations work correctly (enqueue, dequeue, peek, persistence)
- [ ] Sync worker syncs hazard reports and SOS events to Firestore
- [ ] Merge-on-sync correctly converges local and remote OR-Sets
- [ ] Automatic sync on reconnect works
- [ ] All unit tests pass (queue, sync, durability)
- [ ] `npm run lint && npm run typecheck && npm test` passes

---

## Phase 5 — Hazard & SOS Services with Firestore Integration

### Goal
Build the real hazard and SOS services that replace mocks, integrate with Firestore for real-time sync, and trigger FCM push notifications for SOS events.

### Tasks

#### Hazard Service

1. **Implement hazard report submission**
   - File: `modules/hazard-sos/src/services/hazardService.ts`
   - Function: `submitHazardReport(hazardType, lat, lng, riderId, groupId)`
   - Create `HazardReport` object:
     - Generate `report_id` (uuid)
     - Use `HLC.now().toString()` for timestamps
   - If online: write to Firestore `groups/{group_id}/reports/{report_id}`
   - If offline: enqueue to local queue
   - Return immediately (optimistic UI)

2. **Implement hazard clustering trigger**
   - Function: `triggerClustering(groupId)`
   - Get all reports for group from Firestore listener
   - Run `clusterByType()` with `eps=30m`, `minSamples=2`
   - For each cluster:
     - Calculate centroid, bounding box, hazard score
     - Check if cluster already exists (compare centroids)
     - Publish or update `hazard_cluster` to Firestore `hazards/{cluster_id}`

3. **Implement Firestore listener for hazard reports**
   - Function: `subscribeToHazardReports(groupId, callback)`
   - Listen to `groups/{group_id}/reports/` collection
   - On new report: add to local cache, trigger clustering

4. **Implement Firestore listener for hazard clusters**
   - Function: `subscribeToHazardClusters(groupId, callback)`
   - Listen to `hazards/` where `group_id` matches and `status="active"`
   - On change: invoke callback with updated clusters
   - Return unsubscribe function

5. **Implement hazard resolution**
   - Function: `resolveHazard(clusterId)`
   - Update Firestore `hazards/{cluster_id}` set `status="resolved"`

#### SOS Service

6. **Implement SOS trigger**
   - File: `modules/hazard-sos/src/services/sosService.ts`
   - Function: `triggerSos(riderId, groupId, lat, lng)`
   - Create `SOSElement`:
     - Generate `sos_id` (uuid)
     - Use `HLC.now().toString()` for `created_at_hlc`
     - Set `resolved=false`, `resolved_at_hlc=null`
   - Add to local OR-Set using `orSetAdd()`
   - Save OR-Set to MMKV (durable write BEFORE network)
   - If online: write to Firestore `sos_events/{sos_id}`
   - If offline: enqueue to local queue
   - **Zero data loss guarantee:** local write before UI confirmation

7. **Implement SOS resolution**
   - Function: `resolveSos(sosId)`
   - Update local OR-Set using `orSetRemove()` (tombstone)
   - Save OR-Set to MMKV
   - If online: update Firestore `sos_events/{sos_id}` set `resolved=true`
   - If offline: enqueue resolve operation

8. **Implement Firestore listener for SOS events**
   - Function: `subscribeToSosEvents(groupId, callback)`
   - Listen to `sos_events/` where `group_id` matches
   - On change: merge into local OR-Set, invoke callback with active events

9. **Implement FCM push notification trigger**
   - Coordinate with Person C's Node.js backend or Cloud Functions
   - Option: Create Cloud Function triggered by `sos_events/` write
   - Function sends FCM push to all group members
   - Payload: `{ title: "SOS Alert", body: "{rider} triggered SOS", group_id, sos_id }`

10. **Replace mock producers**
    - Update `src/index.ts` to export real services instead of mocks
    - Update README to note mocks replaced with real implementation

### Deliverables
- ✅ `modules/hazard-sos/src/services/hazardService.ts` — complete hazard service
- ✅ `modules/hazard-sos/src/services/sosService.ts` — complete SOS service
- ✅ Real-time Firestore listeners for reports, clusters, and SOS events
- ✅ Hazard resolution support
- ✅ FCM push notification trigger (Cloud Function or REST endpoint)
- ✅ `src/index.ts` updated with real service exports

### Dependencies
- DBSCAN from Phase 3
- OR-Set from Phase 3
- Local queue and sync from Phase 4
- HLC from Phase 2
- Firestore config
- Person C's Node.js backend (for FCM)

### Definition of Done
- [ ] Hazard report submission works (online and offline)
- [ ] DBSCAN clustering runs correctly on new reports
- [ ] Hazard clusters published to Firestore match contract schema
- [ ] SOS trigger works (online and offline) with zero data loss
- [ ] SOS events synced to Firestore
- [ ] FCM push notifications sent to group members on SOS trigger
- [ ] Person C confirms real `hazard_cluster` integrates with routing
- [ ] `npm run lint && npm run typecheck && npm test` passes

---

## Phase 6 — UI Components & Map Overlays

### Goal
Build the React Native UI components for hazard reporting and SOS triggering, plus the map overlays that display hazard markers and SOS indicators on the Live Map.

### Tasks

#### Hazard Report UI

1. **Create Hazard Report Sheet**
   - File: `modules/hazard-sos/src/ui/HazardReportSheet.tsx`
   - Bottom sheet modal with:
     - Title: "Report Hazard"
     - Type picker: 5 options (pothole, oil spill, accident, debris, other)
     - Each with icon and label
     - Confirm button: "Submit Report"
     - Cancel button: "Cancel"
   - Use shared theme from Person C's `theme.ts`
   - Color-code each hazard type

2. **Implement Hazard Report Sheet logic**
   - On mount: get current `verified_location` from Person A's stream
   - On confirm:
     - Call `submitHazardReport()` from hazard service
     - Show toast: "Hazard reported" or "Hazard queued — will sync when online"
     - Close sheet
   - On cancel: close sheet

3. **Create floating "Report Hazard" button**
   - File: `modules/hazard-sos/src/ui/HazardReportButton.tsx`
   - Floating Action Button (FAB) with hazard icon
   - Position: Bottom-right corner of map
   - On tap: open `HazardReportSheet`

#### SOS Button UI

4. **Create SOS Button**
   - File: `modules/hazard-sos/src/ui/SosButton.tsx`
   - Large red circular button with "SOS" text
   - Always visible (top priority)
   - Position: Top-right corner of map

5. **Implement SOS Button anti-accidental trigger**
   - **CRITICAL:** Must require 2-second hold OR double-tap
   - Single tap MUST NOT trigger SOS
   - Implementation: Use `onPressIn`/`onPressOut` to track hold duration
   - Show progress ring during hold
   - Trigger only if held ≥2 seconds
   - Show confirmation modal after trigger

6. **Implement SOS Button logic**
   - On trigger:
     - Get current `verified_location` from Person A's stream
     - Call `triggerSos()` from SOS service
     - Show confirmation: "SOS Sent"
   - Show "Cancel SOS" button for sender only
   - On cancel: call `resolveSos()`

#### Map Overlays

7. **Create Hazard Marker component**
   - File: `app/src/screens/map/overlays/HazardOverlay.tsx`
   - Subscribe to `hazard_cluster` using `subscribeToHazardClusters()`
   - For each cluster:
     - Render marker at `centroid_lat`, `centroid_lng`
     - Color by `hazard_type` (use theme)
     - Size by `hazard_score`
     - Show icon based on type
   - Render `polygon_points` as semi-transparent polygon

8. **Implement Hazard Marker tap interaction**
   - On tap: show info card (bottom sheet or callout)
   - Content: hazard type, report count, hazard score, status
   - "Resolve" button (if owner or nearby — coordinate decision with team)
   - "Dismiss" button

9. **Implement resolved hazard visualization**
   - Resolved hazards (`status="resolved"`): greyed out / faded opacity
   - Keep visible (riders want to know hazard was there)

10. **Create SOS Marker component**
    - File: `app/src/screens/map/overlays/SosOverlay.tsx`
    - Subscribe to SOS events using `subscribeToSosEvents()`
    - For each active SOS:
      - Render large red pulsing marker
      - Show rider name/ID
      - Animate pulse (scale 1.0 → 1.2 → 1.0)
      - Highest visual priority

11. **Implement SOS Marker tap interaction**
    - On tap: show info card
    - Content: "Emergency Alert", rider name, time since trigger
    - "Navigate to Location" button (opens Google Maps intent URL)
    - If sender: "Cancel SOS" button

12. **Implement resolved SOS visualization**
    - Resolved SOS: greyed marker with strikethrough
    - Stop pulse animation
    - Show "Resolved" label
    - Keep visible for 5 minutes, then remove

13. **Write UI component tests**
    - Test: Hazard Report Sheet opens, allows type selection, submits report
    - Test: SOS button requires 2-second hold (single tap does NOT trigger)
    - Test: Hazard markers render at correct coordinates
    - Test: SOS markers pulse animation works

### Deliverables
- ✅ `modules/hazard-sos/src/ui/HazardReportSheet.tsx` — hazard type picker
- ✅ `modules/hazard-sos/src/ui/HazardReportButton.tsx` — floating button
- ✅ `modules/hazard-sos/src/ui/SosButton.tsx` — SOS button with anti-accidental trigger
- ✅ `app/src/screens/map/overlays/HazardOverlay.tsx` — hazard markers
- ✅ `app/src/screens/map/overlays/SosOverlay.tsx` — SOS markers
- ✅ Component tests for UI elements

### Dependencies
- Hazard service from Phase 5
- SOS service from Phase 5
- Person A's MapScreen and `verified_location` stream
- Person C's `theme.ts`

### Definition of Done
- [ ] Hazard Report Sheet opens, allows type selection, submits report
- [ ] Floating "Report Hazard" button visible on map
- [ ] SOS button requires 2-second hold (single tap does NOT trigger)
- [ ] SOS cancel button only visible for sender
- [ ] Hazard markers visible on map, color-coded by type
- [ ] SOS markers visible on map, pulsing animation works
- [ ] Tap interactions work (info cards open)
- [ ] Component tests pass
- [ ] Person A confirms overlay integration works

---

## Phase 7 — Integration Testing with Team

### Goal
Perform end-to-end integration testing with Person A, Person C, and Person D to ensure all cross-module dependencies work correctly, especially offline resilience and data loss prevention.

### Tasks

1. **Integration with Person A (verified_location)**
   - Replace mock `verified_location` with real EKF output
   - Verify hazard reports use correct GPS coordinates
   - Verify SOS events use correct GPS coordinates
   - Test with `spoof_flag=true`: warn user before report submission

2. **Integration with Person C (routing)**
   - Verify routing consumes `hazard_cluster` correctly
   - Test dynamic rerouting: create hazard near route → route recalculates
   - Verify hazard avoidance weights work

3. **Network dead-zone test (CRITICAL)**
   - Kill connectivity for 5-10 minutes
   - Trigger SOS while offline → verify queued
   - Submit hazard report while offline → verify queued
   - Reconnect → verify CRDT merges correctly
   - Verify zero data loss: all operations synced
   - Verify UI reflects synced state

4. **DBSCAN edge case testing**
   - Two reports near cluster boundary → one cluster
   - Isolated report → published with `report_count=1`
   - Different types nearby → separate clusters

5. **SOS accidental-trigger guard test (CRITICAL)**
   - Single tap → SOS NOT triggered
   - 2-second hold → SOS triggered
   - This is explicitly tested per spec §11

6. **Offline app cold-start test**
   - Trigger SOS while offline
   - Kill app (force quit)
   - Relaunch while offline → queue intact
   - Reconnect → SOS syncs correctly

7. **CRDT merge convergence test**
   - Simulate two clients triggering SOS offline
   - Client A resolves their SOS offline
   - Reconnect both → verify merged state consistent
   - Verify no duplicates, tombstones applied

8. **HLC ordering test**
   - Create events offline with HLC timestamps
   - Create events online with HLC timestamps
   - Merge → verify causal ordering preserved

9. **FCM notification test**
   - Trigger SOS on device A
   - Verify device B receives FCM push
   - Tap notification → navigates to map with SOS focused
   - Test with app in background, foreground, killed

10. **Edge case handling**
    - Firestore write fails → operation stays in queue, retries
    - Network flaky → retry logic works
    - Concurrent resolves → CRDT tombstone converges
    - App crash mid-sync → queue survives

### Deliverables
- ✅ All integration tests documented (pass/fail)
- ✅ Network dead-zone test passes (zero data loss)
- ✅ SOS accidental-trigger guard test passes
- ✅ Offline cold-start test passes
- ✅ CRDT merge convergence verified
- ✅ FCM notifications work
- ✅ All edge cases handled

### Dependencies
- All previous phases complete
- Person A's real EKF (Week 4)
- Person C's real routing (Week 5)
- Firebase emulator or real project for testing
- Multiple test devices

### Definition of Done
- [ ] All integration tests pass
- [ ] Person A confirms integration works
- [ ] Person C confirms hazard integration works
- [ ] Zero data loss verified in all offline scenarios
- [ ] SOS accidental-trigger prevention verified
- [ ] FCM notifications work across all app states
- [ ] All edge cases handled and documented

---

## Phase 8 — Final Testing, Documentation & Demo Preparation

### Goal
Complete final testing, update all documentation, prepare the demo for Week 7 presentation, and ensure the Person B module is production-ready.

### Tasks

1. **Final comprehensive test run**
   - Run all unit tests in `modules/hazard-sos/test/`
   - Run all integration tests
   - Run demo flow multiple times
   - Fix any last-minute bugs

2. **Update README.md with final documentation**
   - Document final DBSCAN parameters (after field testing)
   - Document hazard_score formula with examples
   - Document HLC algorithm with references
   - Document CRDT OR-Set semantics
   - Document FCM trigger path (Cloud Function or REST)
   - Add architecture diagram showing data flow
   - Add usage examples for other team members

3. **Write inline code comments**
   - Add JSDoc comments to all public functions
   - Explain complex algorithms (DBSCAN, HLC, CRDT)
   - Document edge cases and decisions
   - Add references to spec sections

4. **Prepare demo script for Person B's part**
   - Per spec §12 item 2:
     1. Show Live Map with 2-3 riders
     2. Riders report same hazard from different positions
     3. Show cluster forming in real-time
     4. Stage offline SOS:
        - Airplane mode
        - Trigger SOS (hold 2 seconds)
        - Show "SOS sent — will alert group when connected"
     5. Reconnect
     6. Show SOS syncing
     7. Show FCM push on other devices
     8. Show SOS marker appearing on all maps
     9. Say: "CRDT merged on reconnect, zero data loss"

5. **Prepare demo test data**
   - Create test group with 3-4 riders
   - Seed initial hazard reports
   - Prepare test devices
   - Practice demo flow 3+ times

6. **Code cleanup**
   - Remove debug console.log statements
   - Remove commented-out code
   - Remove unused imports
   - Run prettier/eslint for consistent formatting

7. **Final performance check**
   - Profile DBSCAN recompute time (should be <500ms for typical group)
   - Verify HLC overhead negligible (<1ms per timestamp)
   - Verify CRDT merge time acceptable (<100ms for typical queue)
   - Document performance in README

8. **Prepare backup demo materials**
   - Screen recording of successful demo flow
   - Screenshots of key moments (cluster forming, SOS syncing, FCM push)

9. **Final coordination with team**
   - Confirm Person C has integrated hazard_cluster for routing
   - Confirm Person A has integrated HLC for timestamps
   - Confirm Person D has integrated HLC if needed
   - Verify no contract changes needed

10. **Final validation**
    - Run `npm run lint && npm run typecheck && npm test` one last time
    - Verify all tests pass
    - Verify demo flow works reliably
    - Ensure all documentation complete

### Deliverables
- ✅ All tests passing (unit, integration, demo)
- ✅ Complete README with all documentation
- ✅ Inline code comments and JSDoc
- ✅ Demo script with step-by-step instructions
- ✅ Demo tested successfully 3+ times
- ✅ Backup demo materials ready (recording, screenshots)
- ✅ Code cleaned up and formatted
- ✅ Performance metrics documented

### Dependencies
- All previous phases complete
- Team coordination for demo rehearsal
- Test devices ready

### Definition of Done
- [ ] README complete with all sections
- [ ] Demo script written and tested 3+ times
- [ ] Backup demo materials ready
- [ ] All tests passing
- [ ] Code cleaned up
- [ ] Performance documented
- [ ] Team confirms integration complete and demo-ready

---

# Final Summary Table

| Phase | Main Goal | Key Tasks | Deliverables |
|-------|-----------|-----------|--------------|
| **Phase 1** | Foundation, Contracts & Mock Producers | Verify contracts, setup environment, document params, create mock HLC/hazard/SOS by Day 2 | Contract files frozen, mocks shipped, README documented, tests pass |
| **Phase 2** | HLC Real Implementation | Implement HLC with persistence, now/receive/compare/toString, unit tests | Real HLC in `hlc.ts`, persistence with MMKV, tests pass |
| **Phase 3** | Core Algorithms: DBSCAN & CRDT | Implement DBSCAN clustering, OR-Set operations, calculation functions, comprehensive tests | `dbscan.ts`, `orSet.ts`, all unit tests pass |
| **Phase 4** | Offline Storage & Sync | Implement local queue, sync worker, merge-on-sync, automatic reconnect sync | `localQueue.ts`, `syncWorker.ts`, zero data loss verified |
| **Phase 5** | Hazard & SOS Services | Implement hazard/SOS services, Firestore integration, FCM trigger, replace mocks | `hazardService.ts`, `sosService.ts`, real Firestore integration |
| **Phase 6** | UI Components & Overlays | Build Hazard Report Sheet, SOS Button, map overlays for hazards and SOS | UI components, map overlays, component tests pass |
| **Phase 7** | Integration Testing | Test with Person A/C, network dead-zone, offline cold-start, CRDT convergence, FCM | All integration tests pass, zero data loss verified |
| **Phase 8** | Final Testing & Demo | Final test run, documentation, demo preparation, code cleanup, performance check | Complete README, demo ready, all tests pass, code cleaned |

---

# Final Validation Checklist

Before considering this plan final, verify:

- [x] **Exactly 8 phases exist**
- [x] **Every required Person B responsibility from `Person_B_Hazard_SOS.md` is covered**
  - Contracts: Phase 1
  - HLC: Phase 2
  - DBSCAN: Phase 3
  - CRDT: Phase 3
  - Offline queue: Phase 4
  - Services: Phase 5
  - UI: Phase 6
  - Tests: Phase 7, 8
  - Documentation: Phase 1, 8
  - Mocks: Phase 1
- [x] **Every relevant integration requirement from `WeRide_Project_Spec.md` is covered**
  - Person A integration: Phase 7
  - Person C integration: Phase 5, 7
  - Person D integration: Phase 2
- [x] **The plan matches the actual monorepo structure**
  - Files in `modules/hazard-sos/src/` as specified
  - Files in `app/src/screens/map/overlays/` as specified
  - Contracts in `contracts/` as specified
- [x] **No required implementation was removed during compression**
  - All required algorithms present
  - All required services present
  - All required UI present
  - All required tests present
- [x] **Optional or over-engineered work has been removed**
  - Incremental reclustering optimization removed
  - Periodic sync removed
  - Complex retry logic simplified
  - Demo infrastructure simplified
  - Git processes removed
  - Map clustering removed
  - Performance benchmarking simplified
- [x] **Each phase has a clear deliverable and definition of done**
  - Deliverables listed for each phase
  - Definition of done criteria clear and testable
- [x] **The implementation order respects dependencies**
  - Foundation before algorithms
  - Algorithms before services
  - Services before UI
  - UI before integration testing
  - Testing before final demo
- [x] **The final plan is practical for a student team to implement and demonstrate**
  - Phases are achievable in 7-week timeline
  - Each phase builds on previous
  - Critical deadlines (Day 2 mocks) clearly marked
  - Demo preparation included

**This revised 8-phase plan is ready for implementation.**



































































