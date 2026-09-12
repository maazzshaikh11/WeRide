# Hazard Detection + Offline SOS (Person B)

Standalone, local-first safety module for WeRide. It accepts hazard reports,
builds hazard clusters on-device, and sends SOS events that survive an offline
restart and converge after reconnect.

## Scope and status

Person B owns HLC, DBSCAN, SOS OR-Set, MMKV queues, Firestore persistence,
realtime listeners, and the hazard/SOS UI components and overlays. Frozen
schemas under `../../contracts/` are consumed unchanged.

Person A's verified-location and MapScreen shell, Person C's hazard-routing
consumer, and Person D's HLC consumer are **PENDING FUTURE INTEGRATION**.
Their absence does not prevent standalone validation of this module.

## Architecture and files

```text
HazardReportSheet -> submitHazardReport -> MMKV queue or Firestore reports
                                           -> DBSCAN -> hazards/{cluster_id}
SosButton (2 s hold) -> OR-Set + MMKV -> Firestore sos_events/{sos_id}
NetInfo reconnect -> queue drain -> OR-Set merge -> realtime overlays
Firestore SOS create -> Cloud Function -> FCM to other group members
```

| Area | Implementation |
| --- | --- |
| `src/hlc/hlc.ts` | Persistent Hybrid Logical Clock |
| `src/dbscan/dbscan.ts` | Haversine/DBSCAN clustering and scoring |
| `src/crdt/orSet.ts` | Tombstone-based SOS OR-Set persistence |
| `src/crdt/localQueue.ts` | Synchronous MMKV FIFO operation queues |
| `src/crdt/syncWorker.ts` | Reconnect drain and CRDT merge |
| `src/services/` | Firestore hazard and SOS services/listeners |
| `src/ui/` | Hazard picker/FAB and guarded SOS button |
| `app/src/screens/map/overlays/` | Person B map overlays, mounted by the map shell later |

## Hazard clustering

`clusterByType()` partitions reports by `hazard_type`, then calls DBSCAN on
each partition. Haversine distance is measured in meters. Development/demo
parameters are **eps = 30 m** and **minSamples = 2**, as specified in the
Person B plan; they have not been field-tuned.

DBSCAN preserves density-reachable boundary points. Reports remaining noise
are published as one-report hazards rather than discarded. The centroid is the
arithmetic mean of report coordinates. The MVP polygon is the frozen,
four-corner bounding box in `[lat, lng]` order:

```text
[minLat,minLng] [minLat,maxLng] [maxLat,maxLng] [maxLat,minLng]
```

```text
hazard_score = min(1, report_count / 5) * exp(-age_hours / 24)
```

For example, five new reports score 1.0; two reports aged 24 hours score about
`0.4 * e^-1 = 0.147`. The result is clamped to `[0, 1]`. Cluster documents
match `contracts/hazard_cluster.json` and are written to `hazards/{cluster_id}`.

## HLC

`HLC.fresh()` restores `{physical, counter}` from the MMKV `hlc` instance and
`hlc_state` key. `now()` advances physical time or increments the logical
counter. `receive(remote)` applies the maximum physical-time merge: when wall
time wins the counter resets; otherwise the logical counter of the winning
clock(s) is incremented. State is synchronously persisted after every change.

```ts
const clock = HLC.fresh();
const local = clock.now();
const afterRemote = clock.receive(remoteTimestamp);
const ordered = HLC.compare(local, afterRemote) < 0;
```

Timestamps serialize as `physical-counter`; `parse` also accepts the legacy
colon separator. If MMKV is unavailable, HLC safely runs in memory. SOS still
fails closed if its mandatory OR-Set durable write cannot complete, so UI must
not claim success before persistence.

## Offline SOS and CRDT

Each SOS addition has a stable unique tag. `orSetRemove` tombstones only tags
observed at resolve time. Merge unions adds and tombstones, making it
commutative, idempotent, and convergent: a concurrent remote add not observed
by a local resolve stays active. Full OR-Set state persists under
`sos_orset_{groupId}`.

SOS trigger order is fail-safe:

1. Create the HLC-stamped event and OR-Set tag.
2. Persist the OR-Set synchronously.
3. Write the stable tag to Firestore if online, or append it to the SOS queue.
4. Only then may UI success be displayed.

Hazard reports and SOS/resolve operations are MMKV FIFO queues. Failed writes
increment a persisted retry count but are **never dropped**; the next reconnect
retries the idempotent document write. Queued resolves include a group ID (and
keep a legacy fallback) so one group's sync cannot consume another group's
operation. This preserves events through restart and a crash during sync.

`startSyncWorker(groupId)` listens for NetInfo offline-to-online transitions,
drains queues, and merges local/remote SOS state. Starting it for the active
group in the app shell is **PENDING FUTURE INTEGRATION**.

## Firestore, listeners, and FCM

| Data | Path | Behavior |
| --- | --- | --- |
| Raw report | `groups/{group_id}/reports/{report_id}` | Local-first write/queue |
| Hazard cluster | `hazards/{cluster_id}` | Group/status filtered listener |
| SOS event | `sos_events/{sos_id}` | OR-Set-aware listener and tombstone resolution |

`infra/firebase/functions/index.js` implements `onSosCreate` for
`sos_events/{sosId}`. It reads group members, reads other riders' FCM tokens,
deduplicates them, then sends `SOS Alert` with `group_id` and `sos_id`.
Retries use the same SOS document ID, so they do not create a second create
trigger notification.

The FCM path is source-verified only. Deployment credentials, a Firebase
project, and physical devices were unavailable, so foreground/background/killed
app delivery is **BLOCKED** pending `firebase deploy --only functions` and a
real multi-device test.

## UI and map overlays

`HazardReportSheet` presents the five frozen types: pothole, oil spill,
accident, debris, and other. The caller supplies current verified coordinates
and timestamp. `HazardReportButton` opens the sheet.

`SosButton` has no single-tap action. `onPressIn` starts a 2,000 ms timer,
`onPressOut` cancels it, and unmount cleanup cancels it too. A completed hold
fires once. Sender-only cancellation is rendered only when the parent provides
an active SOS ID and `showResolve`.

`HazardOverlayMapLayer` renders an active cluster centroid, type color, count,
score, and bounding polygon. `SosOverlayMapLayer` renders only active OR-Set
members; resolved tombstones are intentionally excluded. Component/overlay
tests use Mapbox and service mocks. Full MapScreen mounting awaits Person A.

## Verification and performance

Run from this directory after `npm install`:

```bash
npm run lint
npm run typecheck
npm test -- --runInBand
```

Tests cover HLC ordering/persistence/remote merge, DBSCAN boundary/noise/type
separation/centroid/bounding box/score, OR-Set convergence/tombstones, queue
durability/retry/reconnect, listeners, SOS hold guard, and overlays. The
deterministic performance test uses 100 clustered reports, 10,000 HLC
timestamps, and a 100-element OR-Set merge. It enforces the Phase 8 local
targets: DBSCAN under 500 ms, HLC under 1 ms/timestamp, and OR-Set merge under
100 ms. These are development-machine checks, not mobile-device profiling.
The Phase 8 run measured **29.969 ms** for DBSCAN-100, **0.002150 ms** per
HLC timestamp, and **0.507 ms** for the 100-element OR-Set merge.

## Deterministic demo checklist

Use non-production data: group `demo-group-b`, riders `demo-rider-1` through
`demo-rider-4`, and coordinates around `12.971600, 77.594600`.

1. Submit `pothole` reports at `(12.971600,77.594600)`,
   `(12.971680,77.594620)`, and `(12.971640,77.594680)`.
2. Show one pothole cluster. Add an `oil_spill` at the same location to show
   type separation.
3. Put `demo-rider-4` offline, hold SOS for two seconds, and show: `SOS sent
   — will alert group when connected.`
4. Restart while still offline and show the queue still contains the SOS.
5. Reconnect and show queue drain plus the SOS marker on other maps.
6. With deployed Firebase and devices, capture the FCM alert and say: “CRDT
   merged on reconnect; the locally persisted event was not lost.”

Capture reports before cluster, cluster formed, offline confirmation,
post-restart queue, reconnect/sync, FCM alert, and SOS marker. Never seed a
production Firestore project. No physical screenshots/video are included here
because devices were unavailable.

## Known limitations

- FCM deployment and device delivery remain unverified.
- Native MMKV, Firestore, and Mapbox behavior is mock-tested; validate a real
  Android/iOS build before demonstration.
- App-shell overlay and sync-worker registration is a future integration task.
- DBSCAN values have no field-derived tuning or production telemetry in this MVP.
