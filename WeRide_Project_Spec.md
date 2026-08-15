# WeRide — Complete Project Specification (Source of Truth)

This document is the single reference for all 4 team members. If something isn't written here, it's undecided — raise it in the weekly sync before building around an assumption. Anything changed after Week 1 must be updated here, not just discussed verbally.

---

## 1. Project Overview

**What WeRide is:** a mobile app for group motorcycle/vehicle rides that gives live member tracking with anti-spoofing, crowdsourced hazard alerts, offline-resilient SOS, safety-aware routing with ETA, privacy-preserving analytics, and hands-free voice comms.

**Final objectives (as approved):**
1. Live tracking & anti-spoofing — EKF
2. Hazard detection + offline SOS — DBSCAN, CRDT, HLC
3. Safe route recommendation + ETA — Safety-Weighted A*, LightGBM/XGBoost
4. Privacy-preserving analytics + hands-free voice — FedProx+FedOpt, VOX

**Team:** 4 members, 1 objective owned end-to-end per person (backend logic + data + the screen(s) that expose it).

---

## 2. Full Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend framework | **React Native (TypeScript)** — LOCKED Week 1 Day 1 | Do not split. RN chosen over Flutter; IMU access via `react-native-sensors` is sufficient for the EKF. |
| State management | **Zustand** — LOCKED | Lightweight, hooks-based. (Redux Toolkit was the alternative; Zustand chosen for less boilerplate.) |
| Backend runtime | Node.js (Express or Fastify) | Hosts routing/ETA REST API, FL aggregation server, WebRTC signaling |
| Realtime DB | Firebase Firestore | Hazards, SOS, group metadata, resolved model versions |
| Realtime sync/live location | Firebase Realtime Database OR Socket.io (pick one — see §9) | Location updates, presence |
| Voice | WebRTC (peer connections) + Socket.io signaling namespace `/vox` | Mesh topology, groups capped at 8 riders |
| Maps | **`@rnmapbox/maps` only** — LOCKED | Single SDK for overview base layer + offline tiles + custom routing overlay. Turn-by-turn hand-off via Google Maps intent URL (no Google SDK needed). |
| Push notifications | Firebase Cloud Messaging | SOS + hazard alerts |
| Auth | Firebase Auth (email + Google OAuth2 minimum) | |
| Offline maps | Mapbox Offline Regions | Pre-download along planned route |
| Local on-device storage | **`react-native-mmkv`** — LOCKED | Fast synchronous C++/JSI key-value store (parity with Hive's performance). CRDT queue, offline hazard/SOS cache, FL data. |
| ML inference (ETA) | LightGBM or XGBoost, exported to ONNX or run server-side via REST | Decide in §9 |
| ML training (FL) | TensorFlow Lite (on-device) + Python aggregation server | |
| Music integration | Spotify Web API or Apple MusicKit | Lowest priority — build last, cut if time-constrained |
| CI/CD | GitHub Actions | Lint + unit tests on push, per module folder |
| Version control | Git, monorepo, trunk + feature branches | See §10 |

---

## 3. System Architecture (End-to-End)

```
┌─────────────────── MOBILE APP (React Native / TypeScript) ───────────────────┐
│                                                                                  │
│  [Map Screen]   [Group Screen]   [Hazard Report UI]   [SOS Button]   [VOX UI]   │
│       │                │                 │                  │            │      │
│       └────────┬───────┴────────┬────────┴──────────┬───────┴──────┬─────┘      │
│                │                │                    │              │           │
│         Location Service   Hazard/SOS Client    Routing Client   VOX Client      │
│         (EKF on-device)    (CRDT+HLC local)      (A*/ETA calls)  (WebRTC)        │
└────────┬───────────────┬──────────────────┬─────────────────┬───────────────────┘
         │                │                  │                 │
         ▼                ▼                  ▼                 ▼
  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  ┌─────────────────┐
  │  Firestore /  │  │  Firestore    │  │ Node.js Route  │  │ WebRTC Signaling │
  │  Realtime DB  │  │  (hazards,    │  │ /ETA API       │  │ Server (/vox)    │
  │  (locations)  │  │  sos_events)  │  │ (A* + LGBM)    │  │                  │
  └─────────────┘  └──────────────┘  └───────────────┘  └─────────────────┘
                                                                    │
                                                          ┌─────────────────┐
                                                          │ FL Aggregation   │
                                                          │ Server (FedOpt)  │
                                                          └─────────────────┘
```

**Key principle:** the EKF and DBSCAN run **on-device** (mobile), not server-side — this is required for the <1% CPU / low-latency claims in the report and for offline operation. Only routing/ETA and FL aggregation run server-side.

---

## 4. UI/UX Specification

### 4.1 Screen Inventory (minimum viable set — build in this order of priority)

| # | Screen | Priority | Owned data source |
|---|---|---|---|
| 1 | **Login / Signup** | P0 | Firebase Auth |
| 2 | **Group List / Join / Create Ride** | P0 | Firestore `groups/` |
| 3 | **Live Map (Ride-Overview)** | P0 | `verified_location` stream (A) + `hazard_cluster` (B) + `route_response` (C) |
| 4 | **Hazard Report Button + Type Picker** | P0 | writes to hazard report queue (B) |
| 5 | **SOS Button + Confirmation** | P0 | writes `sos_event` (B) |
| 6 | **Route/ETA Panel** (bottom sheet on map) | P0 | `route_response` (C) |
| 7 | **VOX Voice Indicator (who's talking)** | P1 | `vox_signal` (D) |
| 8 | **Rider Profile / Settings** | P1 | Firebase Auth + Firestore `users/` |
| 9 | **Ride Summary / History** | P2 | Firestore `rides/` |
| 10 | **Music Control Widget** | P2 (cut first if behind schedule) | Spotify/Apple MusicKit |
| 11 | **Privacy/FL status indicator** ("model updates are on-device") | P1 | local FL client state (D) — no server call needed for this UI |

### 4.2 Screen-by-Screen Detail

**Login/Signup**
- Fields: email, password, or "Continue with Google"
- On success → route to Group List
- Error states: invalid credentials, network failure (show retry)

**Group List / Join / Create Ride**
- List of active/past groups (Firestore query on `groups` where `member_ids` contains current user)
- "Create Group" → generates `group_id`, invite code/link
- "Join Group" → enter code, adds `rider_id` to `member_ids`
- Tap group → navigate to Live Map for that `group_id`

**Live Map (core screen)**
- Google Maps/Mapbox base layer
- Rider markers: color-coded by `spoof_flag` (green = verified, red/grey = flagged/lost signal), updated from `location:update` socket event
- Hazard markers: rendered from `hazard_cluster` polygon/centroid, color by `hazard_type`, tap to see report count + type
- Route line: drawn from `route_response.path_points`, re-drawn on `recalculated_at_hlc` change
- Bottom sheet: collapsed shows ETA + distance; expanded shows turn list + "Open in Google Maps" deep link button for real turn-by-turn
- Floating buttons: SOS (top priority, red, always visible), Report Hazard, VOX mic toggle

**Hazard Report**
- Tap "Report Hazard" → bottom sheet with type picker (pothole/oil spill/accident/debris/other) → confirm → writes report with current `verified_location` coords
- Local-first: if offline, queue locally (MMKV), show "will sync when online" toast
- Optimistic UI: pin appears immediately on own map, syncs to group once online

**SOS**
- Big red button, requires 2-second hold or double-tap to prevent accidental trigger (state this explicitly — accidental SOS is a real UX bug risk)
- On trigger: writes `sos_event`, works fully offline (CRDT queue), shows "SOS sent — will alert group when connected" if offline
- Cancel/resolve button appears after trigger for the sender only

**Route/ETA Panel**
- Shows: distance, ETA, safety score (visual: green/yellow/red bar), "Avoid hazards" toggle
- Auto-updates when `route_response` changes (no manual refresh needed)

**VOX Indicator**
- Small avatar ring highlight on whoever's `voice_active=true`
- Mic icon toggle: auto (VOX-controlled) vs. manual push-to-talk fallback (include manual PTT as a fallback mode — VOX-only is a UX risk in loud environments)

**Settings/Profile**
- Name, avatar, emergency contact (used for SOS escalation later if in scope), unit preference (km/mi)

**Privacy/FL Status**
- Simple line of text/icon: "Your ride data stays on your device — only anonymized model updates are shared." Builds user trust, directly demonstrates Objective 4 in the demo.

### 4.3 Design System (minimum, so 4 people's screens don't look inconsistent)
- Pick one color palette + one font (e.g., via Figma or even just a shared `theme.ts` file) in Week 1
- One person (recommend Person C or whoever is UI-lead per your next decision) owns the shared theme file — everyone imports it, no one hardcodes colors
- Consistent iconography set (e.g., Material Icons or Lucide) — pick one, do not mix

### 4.4 UX Flows to explicitly test
- New user: signup → create group → invite → see 2nd rider appear on map
- Hazard flow: report while offline → reconnect → confirm it appears for all group members
- SOS flow: trigger while offline → reconnect → confirm all members get FCM push
- Reroute flow: hazard appears near active route → confirm bottom sheet updates without user action

---

## 5. Module Ownership & Full Dependency Graph

| # | Objective | Owner | Backend | UI Screens Owned |
|---|---|---|---|---|
| 1 | Live Tracking & Anti-Spoofing | Person A | EKF, location publishing | Live Map base layer (rider markers) |
| 2 | Hazard + Offline SOS | Person B | DBSCAN, CRDT, HLC, offline queue | Hazard Report screen, SOS button, hazard markers |
| 3 | Routing + ETA | Person C | A*, LightGBM/XGBoost | Route/ETA panel, group list/create/join (default UI-lead) |
| 4 | FL + VOX | Person D | FedProx+FedOpt, WebRTC | VOX indicator, Privacy status, Music widget (P2) |

```
Person A (EKF) ──publishes verified_location──▶ Person B, C, D (all consume)
Person B (Hazard) ──publishes hazard_cluster──▶ Person C (routing weights)
Person B, C, D ──all independent of each other otherwise──
```

**Unblocking rule (mandatory):** Each owner ships a **mock version of their own output** matching the exact contract in §6, by end of Day 2, Week 1. Everyone else builds against mocks until real integration checkpoints (§8).

---

## 6. Data Contracts (frozen — changing these requires all 4 to agree in weekly sync)

### 6.1 `verified_location` — published by A
```json
{
  "rider_id": "string (uuid)",
  "group_id": "string (uuid)",
  "timestamp_hlc": "string",
  "lat": "float", "lng": "float",
  "speed_mps": "float", "heading_deg": "float",
  "spoof_flag": "boolean", "nis_score": "float", "accuracy_m": "float"
}
```
Transport: Socket.io event `location:update` (live) + Firestore `groups/{group_id}/locations/{rider_id}` (persisted, for late joiners).

### 6.2 `hazard_cluster` — published by B
```json
{
  "cluster_id": "string", "group_id": "string",
  "hazard_type": "enum[pothole,oil_spill,accident,debris,other]",
  "centroid_lat": "float", "centroid_lng": "float",
  "polygon_points": [["lat","lng"]],
  "report_count": "int", "hazard_score": "float",
  "created_at_hlc": "string", "status": "enum[active,resolved]"
}
```
Transport: Firestore `hazards/{cluster_id}`, real-time listener.

### 6.3 `sos_event` — published by B
```json
{
  "sos_id": "string", "rider_id": "string", "group_id": "string",
  "lat": "float", "lng": "float",
  "created_at_hlc": "string", "resolved": "boolean", "resolved_at_hlc": "string|null"
}
```
CRDT: OR-Set with tombstone on resolve. Local queue (MMKV) → Firestore batch write on reconnect.

### 6.4 `route_request` / `route_response` — Person C's API
```json
// POST /route request
{ "group_id": "string", "origin": {"lat":"float","lng":"float"},
  "destination": {"lat":"float","lng":"float"}, "avoid_hazard_types": ["string"] }
// response
{ "route_id": "string", "path_points": [["lat","lng"]],
  "distance_km": "float", "eta_minutes": "float",
  "safety_score": "float", "recalculated_at_hlc": "string" }
```

### 6.5 `fl_model_update` — internal to D
```json
{ "client_id": "string", "round_id": "int",
  "masked_weights_delta": "base64", "local_loss": "float", "sample_count": "int" }
```

### 6.6 `vox_signal` — internal to D
```json
{ "group_id": "string", "rider_id": "string", "sdp_offer": "string",
  "ice_candidates": ["string"], "voice_active": "boolean" }
```

---

## 7. Database Schema (Firestore)

```
users/{user_id}
  - name, email, avatar_url, unit_pref, created_at

groups/{group_id}
  - name, created_by, member_ids[], created_at, active_ride_id

groups/{group_id}/locations/{rider_id}
  - (verified_location fields, §6.1)

hazards/{cluster_id}
  - (hazard_cluster fields, §6.2), group_id

sos_events/{sos_id}
  - (sos_event fields, §6.3)

routes/{route_id}
  - (route_response fields, §6.4), group_id, requested_by

rides/{ride_id}
  - group_id, start_time, end_time, summary_stats

fl_rounds/{round_id}
  - global_weights_version, participant_count, completed_at
```

---

## 8. Timeline (7 Weeks)

| Week | Activity | Checkpoint |
|---|---|---|
| 1 (Day 1) | Lock tech stack decisions (§9), design system, DB schema, all contracts (§6) | Contracts signed off by all 4 |
| 1 (Day 2) | Each owner ships mock service/UI stub for their output | Mocks running, everyone unblocked |
| 1 (Day 3–7) | Real implementation begins in parallel; app shell + navigation built (whoever owns it) | Skeleton app runs, screens navigable with mock data |
| 2–3 | Core algorithms: EKF math, DBSCAN+CRDT, A*+LightGBM training, FedProx round-trip; UI screens built against own module's real data | Unit tests pass per module |
| 4 | Integration swap 1: real EKF replaces mock for B, C, D | Live location stream works end-to-end |
| 5 | Integration swap 2: real hazard clusters replace mock for C; D integrates real location | Hazard-weighted routing live; VOX/FL wired to real data |
| 6 | Full system integration + testing (§11); UI polish pass; offline/network-loss tests | End-to-end demo flow works once, start to finish |
| 7 | Bug fixes, performance profiling (battery/CPU per module), demo rehearsal, docs/report finalization | Final build frozen 2 days before submission |

**Weekly sync (mandatory, 30 min, all 4 present):** each person reports what shipped, any contract change needed, blockers. No solo contract changes.

---

## 9. Decisions To Lock on Day 1 (do not skip — these are exactly the things that cause rework)

- [x] **Flutter vs React Native — LOCKED: React Native (TypeScript).** IMU access via `react-native-sensors` is sufficient for the EKF; RN chosen over Flutter.
- [x] **State management — LOCKED: Zustand.** (Redux Toolkit was the alternative; Zustand chosen for less boilerplate in a 4-person student project.)
- [ ] Realtime location transport: Firestore Realtime listeners vs. raw Socket.io (recommendation: Socket.io for location — lower latency; Firestore for hazards/SOS — needs persistence/offline merge)
- [ ] LightGBM vs XGBoost (pick one, don't maintain both)
- [ ] Where ETA inference runs: on-device (ONNX) vs. server REST call (recommendation: server REST call for simplicity in a student project; document the latency tradeoff)
- [ ] Color palette, font, icon set (design system)
- [ ] Mesh vs SFU for WebRTC (recommendation: mesh, since typical group size ≤8)
- [ ] Whether Spotify/Apple Music integration is in-scope at all given time budget (recommend: cut unless Weeks 1–5 finish early)
- [x] **Maps SDK — LOCKED: `@rnmapbox/maps` only.** Single SDK for overview base layer + offline tiles + custom routing overlay. Turn-by-turn hand-off via Google Maps intent URL (no Google SDK needed).
- [x] **Local storage — LOCKED: `react-native-mmkv`.** Fast synchronous C++/JSI key-value store (parity with Hive's performance) for CRDT queue, offline hazard/SOS cache, FL data.

---

## 10. Repo Structure & Git Workflow

```
/weride
  /app                  → React Native (TypeScript) app shell, screens, navigation
  /modules
    /tracking            → Person A: EKF service + mobile sensor integration
    /hazard-sos          → Person B: DBSCAN + CRDT/HLC + offline queue
    /routing-eta          → Person C: A* + LightGBM/XGBoost + REST API
    /fl-voice             → Person D: FedProx/FedOpt + WebRTC VOX
  /contracts             → JSON schema files, source of truth for §6 (versioned, PR-reviewed by all 4 on change)
  /infra                 → Firebase config, CI workflows
  /docs                  → this spec, meeting notes, report drafts
```

**Branching:** `main` protected, feature branches per person (`feature/A-ekf`, `feature/B-hazard`, etc.), PR + at least 1 other member's review before merge into `main`. Contract file changes require review from all 4.

**CI:** GitHub Actions runs lint + unit tests per module folder on every push; broken CI blocks merge.

---

## 11. Testing Plan

| Scenario | What to verify |
|---|---|
| GPS spoofing | Inject fake GPS jump mid-ride → `spoof_flag` triggers, IMU dead-reckoning takes over, UI shows rider as flagged |
| Network dead-zone | Kill connectivity 5–10 min during SOS + hazard report → CRDT merges correctly on reconnect, zero data loss, UI reflects synced state |
| Hazard edge cases | Two reports near a grid boundary → DBSCAN clusters them together (no edge-split) |
| Dynamic rerouting | New hazard published mid-route → A* recalculates within 1s, UI route line + ETA update automatically |
| FL round | 3 simulated clients, non-IID data → FedProx bounds divergence, confirm no raw data leaves device (check logs/network traffic) |
| VOX | Simulated wind/engine noise → VAD doesn't false-trigger or false-mute; manual PTT fallback works |
| Battery/CPU | Profile each module standalone: EKF <1% CPU, DBSCAN/A* recompute time, FL round device impact |
| SOS accidental-trigger guard | Confirm single tap does NOT trigger SOS, only hold/double-tap does |
| Offline app cold-start | Kill app while offline mid-ride, reopen → local queue intact, syncs correctly on reconnect |

---

## 12. Demo Script (What Each Person Shows, Final Presentation)

1. **A:** live map with verified rider dots; staged GPS spoof injection showing real-time detection.
2. **B:** simulated multi-rider hazard reports forming a cluster live; staged offline SOS that syncs on reconnect with FCM alert firing.
3. **C:** route visibly rerouting when a hazard appears near it; ETA panel updating live.
4. **D:** live group voice call with VOX auto-triggering; a log/slide showing FL rounds completing with masked updates only (no raw data).
5. **Whole team:** end-to-end flow — create group → join → live tracking → hazard appears → reroute → SOS test → voice chat — in one continuous run.

---

## 13. Risks & Explicit Mitigations

| Risk | Mitigation |
|---|---|
| Contract drift (someone changes their JSON shape without telling others) | `/contracts` folder is PR-reviewed by all 4; CI can validate payloads against schema |
| One person's algorithm (EKF/FedProx) takes longer than planned | Mocks mean no one else is blocked; that person gets extra time in Weeks 2–3 if needed |
| UI inconsistency across 4 people's screens | Shared theme file locked Week 1, one person owns/reviews all UI PRs for consistency |
| Firebase free-tier limits during testing | Monitor usage, use Firebase emulator suite for local dev instead of live project where possible |
| Scope creep (music integration, extra screens) | P2 items explicitly cuttable — stated in §4.1, revisit only after P0/P1 done |

---

*This document supersedes all earlier verbal/partial specs. Any change must be edited here and announced in the weekly sync — not just discussed in chat.*
