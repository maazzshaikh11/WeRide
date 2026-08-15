# Person B — Hazard Detection + Offline SOS (DBSCAN, CRDT, HLC)

**Objective 2:** Crowdsourced hazard alerts with spatial clustering, and offline-resilient SOS that syncs on reconnect with zero data loss.

**Module folder:** `/modules/hazard-sos`
**UI screens owned:** Hazard Report screen (button + type picker), SOS button + confirmation, hazard markers on the Live Map.

---

## 1. Your Objective (End-to-End)

You own two related flows that share the same offline-resilience machinery (CRDT + HLC + local queue):

1. **Hazard detection:** Riders report hazards (pothole, oil spill, accident, debris, other) from their phone. Multiple nearby reports get clustered by DBSCAN into a single `hazard_cluster` that everyone in the group sees. Clusters can be resolved (marked inactive) when the hazard clears.
2. **Offline SOS:** A rider triggers SOS (emergency). It must work **fully offline** — the SOS event is queued locally and syncs to the group + triggers FCM push when connectivity returns. Zero data loss is the hard requirement.

**What "done" looks like (demo, Week 7):**
> Simulated multi-rider hazard reports form a cluster live on the map. Then a staged offline SOS: kill connectivity, trigger SOS, reconnect → the SOS syncs and all group members get the FCM push. CRDT merge is correct, nothing lost.

---

## 2. Data Contracts You Publish (Frozen — §6.2, §6.3)

You are the **sole producer** of `hazard_cluster` and `sos_event`. These shapes are frozen; changing them requires all 4 to agree in a weekly sync and a PR review on `/contracts/`.

### 2.1 `hazard_cluster` (§6.2)
```json
{
  "cluster_id": "string",
  "group_id": "string",
  "hazard_type": "enum[pothole,oil_spill,accident,debris,other]",
  "centroid_lat": "float",
  "centroid_lng": "float",
  "polygon_points": [["lat","lng"]],
  "report_count": "int",
  "hazard_score": "float",
  "created_at_hlc": "string",
  "status": "enum[active,resolved]"
}
```
Transport: Firestore `hazards/{cluster_id}`, real-time listener. **Not** Socket.io — hazards need persistence and offline merge, which Firestore gives you for free.

### 2.2 `sos_event` (§6.3)
```json
{
  "sos_id": "string",
  "rider_id": "string",
  "group_id": "string",
  "lat": "float",
  "lng": "float",
  "created_at_hlc": "string",
  "resolved": "boolean",
  "resolved_at_hlc": "string|null"
}
```
CRDT semantics: **OR-Set (Observed-Remove Set)** with tombstone on resolve. Local queue (MMKV) → Firestore batch write on reconnect. The OR-Set means: adding an SOS is idempotent (re-sending the same `sos_id` is safe), and resolving is a tombstone add (not a delete) so concurrent resolves and re-opens converge.

### 2.3 `hazard_report` (raw report — not in §6 but you need it internally)
This is the per-rider raw report that feeds DBSCAN. It's internal to your module but you should define it in `/contracts/hazard_report.json` so C (routing) and the UI know what a single report looks like if needed.
```json
{
  "report_id": "string",
  "rider_id": "string",
  "group_id": "string",
  "hazard_type": "enum[pothole,oil_spill,accident,debris,other]",
  "lat": "float",
  "lng": "float",
  "timestamp_hlc": "string",
  "reported_at_hlc": "string"
}
```

---

## 3. Algorithms

### 3.1 DBSCAN (hazard clustering)
**Why DBSCAN:** riders report the same pothole from slightly different GPS positions. You need to group nearby reports of the same type without knowing in advance how many clusters exist (k-means is wrong here — you don't know k). DBSCAN finds dense regions of arbitrary shape and labels outliers as noise.

**Parameters you must tune:**
- `eps` (neighborhood radius, in meters — ~20–50m is a reasonable start for road hazards).
- `min_samples` (minimum reports to form a cluster — 2 or 3; a single report can stand alone as a low-confidence hazard).

**Per-type clustering:** cluster reports of the same `hazard_type` separately — a pothole report and an oil spill report 10m apart are NOT the same hazard. Group by `hazard_type` then run DBSCAN within each group.

**Edge cases (from §11 testing):**
- Two reports near a grid/cluster boundary must cluster together, not split. This is a DBSCAN inherent property (density-reachable) — just make sure your implementation handles it and you have a test for it.
- A report that's noise (no neighbors within `eps`) → still published as a single-report hazard with `report_count=1`, `hazard_score` low. Don't drop it.

**Where DBSCAN runs:** on-device, per the spec §3 key principle. Each rider runs DBSCAN over the reports it has received (via Firestore listener) for its current group. When a new report arrives, re-run DBSCAN over the affected region only (don't re-cluster the whole group every tick — that's O(n²)). `# ponytail: incremental re-cluster on new report only; full re-cluster if report count > N`

**`hazard_score`:** a 0–1 confidence derived from `report_count` and recency. Simple formula to start: `score = min(1, report_count / 5) * recency_decay`. Document your formula.

**Polygon:** `polygon_points` is the convex hull (or just the bounding box) of the clustered report coords. A full convex-hull library may be overkill — a bounding box (4 points) is acceptable for the MVP. Document which you chose. `# ponytail: bounding box for polygon, convex hull if visual fidelity matters`

### 3.2 HLC (Hybrid Logical Clock)
You own the HLC implementation — **A, C, D all consume your HLC to timestamp their events.** This is a critical shared dependency.

**What HLC is:** a tuple `(counter, physical_time)` that gives you causally-ordered timestamps even when clocks drift or devices are offline. It combines a physical clock (wall time) with a logical counter that increments on each event and on any timestamp comparison with a remote event.

**Algorithm (standard HLC, from Kulkarni et al.):**
- **Local event / send:** `l'.counter = max(l.counter, physical_clock); l.counter = l'.counter + 1` (if physical clock unchanged) else `l.counter = 0`. Keep `physical` = max(local physical, remote physical).
- **Receive (with remote timestamp m):** `l.physical = max(l.physical, m.physical, physical_clock); l.counter = (l.counter if l.physical > m.physical else m.counter) + 1`.
- Persist `l` to local storage on every update — if the app restarts, HLC must not reset (that breaks causal ordering).

**API you expose to others:**
```dart
HLC.now();                      // get current HLC timestamp
HLC.receive(remoteHlc);         // merge on receiving a remote event
HLC.compare(a, b);              // ordering
String hlcString = hlc.toString(); // serializable form for timestamps
```
Ship this as a standalone utility in `modules/hazard-sos/hlc/` (or a shared `shared/hlc/` if the team agrees — but you author and own it). Everyone imports it.

### 3.3 CRDT (OR-Set for SOS)
**OR-Set (add-only set with tombstones):**
- **Add:** insert `(element, unique_tag)` where `unique_tag` is a unique ID (use HLC + rider_id).
- **Remove (resolve):** add a tombstone for the specific `(element, tag)` pairs observed at remove time.
- **Merge:** union of all adds minus union of all tombstones. Convergent and commutative — safe for offline.

**Local queue (MMKV, per §2 stack):**
- Every SOS trigger writes to the local CRDT queue **immediately** (before any network attempt).
- A background sync worker drains the queue to Firestore when online (batch write).
- On reconnect, fetch remote SOS events, merge into local CRDT, push local adds that aren't on the remote.
- **Zero data loss guarantee:** the local write happens before the UI confirms SOS. If the app crashes between confirm and sync, the queue survives (MMKV is durable — C++/JSI, synchronous write) and syncs on next launch.

---

## 4. UI Screens You Own

### 4.1 Hazard Report Button + Type Picker
- Floating "Report Hazard" button on the Live Map (coordinate with A who owns the map shell — you register this as an overlay/floating action).
- Tap → bottom sheet with type picker: pothole / oil spill / accident / debris / other.
- Confirm → writes `hazard_report` with current `verified_location` coords (from A's stream).
- **Local-first:** if offline, queue locally (MMKV), show "will sync when online" toast.
- **Optimistic UI:** the hazard pin appears immediately on the own-user map, before server sync. It syncs to the group once online.

### 4.2 SOS Button + Confirmation
- Big red floating button, **always visible** on the Live Map (top priority per spec §4.2).
- **Anti-accidental trigger (mandatory — spec §4.2):** requires a **2-second hold OR double-tap** to trigger. A single tap must NOT fire SOS. This is explicitly tested (§11 row 8).
- On trigger: writes `sos_event` to local CRDT queue immediately, then attempts network sync.
- If offline: show "SOS sent — will alert group when connected."
- **Cancel/resolve** button appears after trigger, **for the sender only**. Resolving adds a tombstone (CRDT remove). Other riders see the SOS as active until the resolve propagates.
- Resolved SOS visually changes (greyed / struck-through) on all group members' maps.

### 4.3 Hazard Markers on the Live Map
- Rendered from `hazard_cluster` (Firestore real-time listener on `hazards/` where `group_id` matches).
- Color by `hazard_type` (define a color map in the shared theme — coordinate with C who owns theme).
- Tap a hazard marker → info card: `hazard_type`, `report_count`, `hazard_score`, `status`.
- Resolved hazards (`status=resolved`) → greyed/faded marker or hidden (decide in sync; recommendation: fade, don't hide — riders want to know a hazard was there).

### 4.4 What you do NOT own
- The map base layer / rider markers (A).
- The route line (C).
- The VOX indicator (D).
- You register your hazard markers and floating buttons as overlays on A's `MapScreen` shell. Lock this overlay interface in Week 1 Day 2.

---

## 5. Dependencies

### 5.1 You depend on
| From | What | When you need it |
|---|---|---|
| Person A | `verified_location` stream (coords to attach to hazard/SOS reports) | Mock by Week 1 Day 2, real by Week 4 |
| Infra (shared) | Firebase project config, Firestore security rules for `hazards/` and `sos_events/`, FCM setup for SOS push | Week 1 Day 1–2 |
| Design system (C owns theme) | `theme.ts` — colors incl. hazard-type color map, font, icon set | Week 1 Day 1 |
| App shell | Navigation to Hazard Report sheet, SOS button placement on MapScreen | Week 1 Day 3–7 |
| Shared local storage | MMKV (`react-native-mmkv`) initialized in the app shell — boxes: `sos_queue`, `hazard_queue` | Week 1 Day 3 |

### 5.2 What waits on you
| Who | What they need from you | When |
|---|---|---|
| Person A | HLC timestamp utility (A timestamps `verified_location` with your HLC) | Mock/stub by Week 1 Day 2, real by Week 2–3 |
| Person C | `hazard_cluster` stream (C's routing uses hazards as avoidance weights) | Mock by Week 1 Day 2, real by Week 5 |
| Person D | HLC (D's FL rounds may use HLC for ordering; D's VOX does not need it) | Mock by Week 1 Day 2 |
| All | The HLC is your most critical unblock — ship it Day 2 |

**Unblocking rule (mandatory):** Ship by end of Day 2, Week 1:
1. A **mock HLC** utility (can be a simple wrapper around wall-clock + counter — the real merge logic comes Week 2).
2. A **mock `hazard_cluster`** producer (emits a fake cluster every ~10s at a random nearby position).
3. A **mock `sos_event`** producer (emits one fake SOS on demand).
Everyone builds against these mocks until integration swaps in Weeks 4–5.

---

## 6. Week-by-Week Plan

### Week 1
- **Day 1:** Be in the room for §9 decisions. You care about: RN stack (locked), realtime transport (Firestore for hazards/SOS — you need persistence, not Socket.io), local storage (MMKV — locked).
- **Day 1–2:** Author `/contracts/hazard_cluster.json`, `/contracts/sos_event.json`, `/contracts/hazard_report.json` with all 4 reviewing.
- **Day 2:** Ship mock HLC + mock `hazard_cluster` + mock `sos_event` producers. **Hardest deadline — do not slip.**
- **Day 3–7:** Start real HLC implementation (§3.2). Set up MMKV local queue. Build the Hazard Report UI sheet and SOS button (against your own mocks). Get the optimistic-UI pin working (tap report → pin appears locally).

### Week 2–3 (core algorithm)
- Implement DBSCAN (§3.1) — on-device, per-type, incremental re-cluster.
- Implement OR-Set CRDT (§3.3) for SOS — local queue + merge logic.
- Wire Firestore real-time listener for `hazards/` and `sos_events/`.
- FCM integration: on SOS sync, trigger a Cloud Function (or client-side FCM send) to push-alert all group members. Coordinate with infra — FCM server-side send typically needs a Cloud Function or the Node.js backend.
- Unit tests (§7): DBSCAN edge-boundary, CRDT merge convergence, HLC ordering, offline queue durability.
- Write `modules/hazard-sos/README.md` documenting DBSCAN params, HLC algorithm, CRDT merge semantics, FCM trigger path.

### Week 4 (integration swap 1)
- Real EKF (A) replaces mock → your hazard/SOS reports now carry real `verified_location` coords. Verify the coords are fresh and not flagged (if A's `spoof_flag=true`, you may want to warn the user "your location is flagged, hazard report may be inaccurate" — decide in sync).
- HLC is now real — verify A's `timestamp_hlc` uses your HLC and orders correctly.

### Week 5 (integration swap 2)
- Real `hazard_cluster` feeds C's routing weights. Verify C's route avoids your active hazards.
- Test the full hazard→reroute flow (§11 row 4).

### Week 6
- Full system integration testing. Your parts:
  - Network dead-zone test (§11 row 2): kill connectivity 5–10 min during SOS + hazard report → CRDT merges on reconnect, zero data loss.
  - Hazard edge cases (§11 row 3): two reports near cluster boundary → one cluster.
  - SOS accidental-trigger guard (§11 row 8): single tap does NOT trigger.
  - Offline app cold-start (§11 last row): kill app while offline mid-ride → local queue intact, syncs on reconnect.
- Battery/CPU profile (§11 row 7): DBSCAN recompute time should be small; document it.

### Week 7
- Final build frozen 2 days before submission. Demo rehearsal: your beat is the multi-rider hazard cluster + offline SOS (§12 item 2). Practice the offline→reconnect→FCM timing.

---

## 7. Tests You Must Write (minimum)

`modules/hazard-sos/test/`:

| Test | What it asserts |
|---|---|
| `dbscan_cluster_boundary` | Two reports near a cluster boundary → one cluster, not two. |
| `dbscan_noise_report` | Isolated report → `report_count=1`, still published. |
| `dbscan_type_separation` | Pothole + oil spill 10m apart → two separate clusters. |
| `hlc_ordering` | Events timestamped offline then synced are correctly ordered relative to online events. |
| `hlc_persistence` | App restart → HLC continues monotonically (no reset). |
| `crdt_sos_merge_convergent` | Two offline clients each trigger SOS, then sync → both converge to the same OR-Set state. |
| `crdt_resolve_tombstone` | Resolve then re-open → convergent across clients. |
| `offline_queue_durability` | Trigger SOS offline → kill app → relaunch → queue intact, syncs on reconnect. |
| `sos_single_tap_guard` | Single tap on SOS button → NOT triggered. Hold/double-tap → triggered. |
| `mock_producer_contract` | Mock `hazard_cluster` and `sos_event` emit exact §6 schemas. |

Self-check: a `demo()` that runs DBSCAN over a fixed set of points and prints the clusters, so you can eyeball without the app.

---

## 8. Files You Own

```
modules/hazard-sos/
  src/
    hlc/
      hlc.ts                 # the HLC implementation (shared util — everyone imports)
    dbscan/
      dbscan.ts              # pure clustering logic, testable without Firestore
    crdt/
      orSet.ts               # OR-Set for SOS
      localQueue.ts          # MMKV-backed queue
      syncWorker.ts          # drains queue to Firestore on reconnect
    services/
      hazardService.ts       # report submission + DBSCAN trigger + Firestore publish
      sosService.ts          # SOS trigger + CRDT queue + FCM trigger
    ui/
      HazardReportSheet.tsx  # type picker bottom sheet
      SosButton.tsx          # hold/double-tap button
      hazardMarker.ts        # map overlay marker helper
    index.ts                 # re-exports
  README.md                  # DBSCAN params, HLC algo, CRDT merge, FCM path
  test/
    hazardSos.test.ts        # DBSCAN, HLC, OR-Set merge
contracts/
  hazard_cluster.json
  sos_event.json
  hazard_report.json
```

In the app shell:
```
app/src/screens/map/overlays/
  HazardOverlay.tsx      # you register this with A's MapScreen
  SosOverlay.tsx
```

---

## 9. Risks Specific to You

| Risk | Mitigation |
|---|---|
| MMKV not initialized before first offline SOS | App shell must init storage at launch (before any screen — see `app/src/App.tsx`). Add a startup check; if storage not ready, block SOS with "initializing, try again in 2s" rather than silently dropping. |
| FCM push requires server-side send (Cloud Function) | You can't send FCM directly from the client to other clients. Coordinate with infra Week 2 — a Cloud Function triggered by `sos_events/` write is the cleanest path. |
| DBSCAN `eps`/`min_samples` wrong → over/under-clustering | Field-test in Week 2–3 with real riders; tune. Start with eps=30m, min_samples=2. |
| HLC clock drift across devices | HLC is designed to tolerate this — the logical counter handles it. But persist `l` on every change; a reset breaks ordering. |
| SOS accidental trigger | The 2s-hold/double-tap guard is mandatory and explicitly tested. Do not weaken it for "easier UX." |

---

## 10. Demo Script (Your Beat — §12 item 2)

1. Show the Live Map. Have 2–3 riders (teammates or simulators) ride past the same pothole and tap "Report Hazard" each.
2. Within seconds, the reports cluster into one `hazard_cluster` marker on everyone's map (color by type, report count visible on tap).
3. Now stage the offline SOS: kill connectivity (airplane mode or disable WiFi/cellular on one device).
4. Trigger SOS on the disconnected device → it shows "SOS sent — will alert group when connected."
5. Reconnect → within a few seconds, all group members get the FCM push + the SOS marker appears.
6. Say one line: "CRDT merged on reconnect, zero data loss."

---

## 11. What to Skip (YAGNI)

- A custom convex-hull library for `polygon_points`. Bounding box (4 points) is fine. `# ponytail: bbox polygon, convex hull if visual fidelity demanded`
- Full re-cluster on every report. Incremental re-cluster of affected region only.
- A separate "hazard confidence ML model." `hazard_score = f(report_count, recency)` is enough.
- Per-rider deduplication of reports (rider reports same hazard twice). DBSCAN handles this naturally (two reports at same spot = same cluster).
- A complex FCM payload. Title + body + `group_id` + `sos_id` deep link is enough.

---

*Questions about your contract or dependencies? Raise in the weekly sync, do not assume. This plan assumes the spec (WeRide_Project_Spec.md) is the source of truth.*