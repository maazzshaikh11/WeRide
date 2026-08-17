# WeRide — Person 3 Implementation Plan (Safe Route Recommendation + ETA)

**Primary source of truth:** `docs/Development/Person_C_Routing_ETA.md` (authoritative for scope, terminology, contracts, and the Week 1–7 plan). Supporting: `WeRide_Project_Spec.md`, `contracts/route_contract.json`, `contracts/hazard_cluster.json`, `contracts/verified_location.json`, `AGENTS.md`.

**Module:** `/modules/routing-eta` (client TS package + `server/` ESM Node package). **UI-lead:** Person C owns `app/src/theme/theme.ts`.

**One-line objective (from the MD):** given an origin, destination, and active `hazard_cluster`s, compute a route that minimizes a **safety-weighted cost** (not just distance/time); recalculate automatically when hazards appear near the route; update ETA live in the UI.

---

## 0. Current-State Assessment (what already exists in the repo)

| Area | State | Notes |
|---|---|---|
| `contracts/route_contract.json` | Done | Matches §6.4 exactly (single-file request+response). **Do not redesign.** |
| `app/src/theme/theme.ts` + `colors.ts` | Mostly done | Colors, hazard-type map, rider colors, safety thresholds present. **Missing: font + icon-set constants** (§4.4). |
| `server/index.js` | Scaffolded | Express + `POST /route` + `/fl/*` + `/vox`. Namespaced single Node process (matches MD §2). |
| `server/astar.js` | Scaffolded | `haversineMeters`, array-heap A*, `applyHazardPenalties`, `routeSafetyScore`, mock `handleRoute`. Heap is O(n log n) sort — needs a real heap (ponytail). |
| `server/road_graph.js` | Stub | Throws "decide Option A vs B". |
| `server/hazard_penalty.js` | **Missing** | §8 requires it; penalty logic currently lives inline in `astar.js`. |
| `server/eta_model.js` | Placeholder | distance/speed heuristic; Python-sidecar proxy sketched in comments. |
| `server/safety_score.js` | Scaffolded | `computeSafetyScore`. |
| `server/training/collect_directions.py`, `train_eta.py` | Scaffolded | Need to be run; `eta_model.txt` not generated. |
| `server/test/astar.test.js` | Partial | 5 tests; missing §7 required cases (`reroute_on_hazard`, `recalc_latency_under_1s`, `eta_model_sanity`, `route_response_contract`). |
| `src/client/routingClient.ts` | Done | Debounced `scheduleRecalculation` (500ms). |
| `src/client/RoutePanel.tsx` | Basic | Collapsed row only; no expanded state / turn list / real wiring. |
| `src/client/routeLine.ts` | Done | `routeToGeoJsonLine` ([lng,lat]). |
| `src/group/groupService.ts` | Scaffolded | Has a bug: `arrayUnion([uid])` should be `arrayUnion(uid)`. |
| `app/src/screens/GroupListScreen.tsx` | Stub | Create/join buttons exist; **no `onSnapshot` list**; `IconButton` imported from `react-native` is invalid (stub bug). |
| `app/src/screens/map/overlays/RouteOverlay.tsx` | Stub | Hardcoded 0/0/1; not wired to `RoutingClient`. |
| `app/src/models/routeResponse.ts` | Done | Request/response models + JSON converters. |

Plan below treats these as starting points — tasks either complete, fix, or wire the scaffolding; nothing is redesigned.

---

## 1. Phase Overview

| Phase | Objective | Tasks | Main Deliverable | Dependencies |
|---|---|---|---|---|
| **P1 — Decisions + Design System** (W1 D1) | Lock Day-1 decisions; ship the shared theme and contracts that unblock all 4 people | T-01, T-02, T-03 | `theme.ts` (font + icons added), ratified Decision Register, frozen `route_contract.json` | Infra: Firebase config + Node host (W1 D1–2) |
| **P2 — Unblocking Deliverables** (W1 D2) | Mandatory unblocking rule: mock `route_response` server, Group List stub, everyone builds against mocks | T-04, T-05 | Working `POST /route` mock + navigable Group List screen | T-01, T-03, Person B HLC mock, Person A `verified_location` mock |
| **P3 — Routing Engine** (W1 D3–W3) | Real route from origin to destination; hazard-aware rerouting; safety score; client-side dynamic recalculation | T-06, T-07, T-08, T-09 | Safety-weighted `POST /route` returning real path + `safety_score` + `recalculated_at_hlc`; <1s recalc | T-03, T-04, Mapbox/Google API key, Person B `hazard_cluster` mock (W1 D2) |
| **P4 — ETA Model** (W2–3) | Train LightGBM on Directions-API labels; serve inference; wire into `/route` | T-10, T-11, T-12 | `eta_model.txt` + server inference giving `eta_minutes` | T-06 (feature inputs: turn_count, distance), Python env |
| **P5 — Route/ETA UI** (W2–3) | Route/ETA bottom sheet, route line overlay, Google Maps deep link | T-13, T-14, T-15 | Live-updating panel + map route overlay + deep-link nav | T-02 (theme), T-04/T-07 (route_response), P1 `verified_location` (origin) |
| **P6 — Integration Swaps** (W4–5) | Real EKF replaces mock origin (W4); real `hazard_cluster` + HLC replace mocks, marquee reroute test (W5) | T-16, T-17 | Routes start at rider's real position; route visibly reroutes around a real hazard in <1s | Person A real EKF (W4), Person B real `hazard_cluster` + HLC (W5), T-07, T-09 |
| **P7 — Tests, Docs, Polish, Demo** (W2–7) | Complete §7 test suite, document algorithms, W6 system integration + perf, W7 freeze + rehearsal | T-18, T-19, T-20, T-21, T-22 | All §7 tests green, README documenting formulas, <1s recalc proven, polished UI, rehearsed demo | Everything above |

---

## 2. Detailed Tasks

Each task is self-contained enough to hand to OpenCode one at a time. IDs are stable; Phases are execution buckets. `[MVP]` = mandatory; `[STRETCH]` = do only if time permits (MD §3.1/Weeks 5–6/§11).

---

### T-01 — Lock Day-1 Technical Decisions  `[MVP] · P1 · W1 D1`

**Objective.** Ratify every open decision that gates this module so no implementation work is built on an assumption (MD §5.1 "decide Day 1", spec §9). No code — this is a coordination artifact.

**Subtasks.**
1. Walk the Decision Register (§5 of this plan) with all 4 in the Week-1 sync.
2. Ratify scaffold choices: Express (`server/package.json` already uses it), LightGBM (already recorded in `README.md`), server-side REST ETA inference, single Node process with namespaced routers (`/route`, `/fl`, `/vox`).
3. Make the **Option A vs Option B** routing call (§5 D-04). Recommended: **Option A for MVP** (Mapbox/Google Directions base route + hazard post-processing), upgrade to Option B (true A* on OSM) in Weeks 5–6. `# ponytail: start Option A, upgrade to B if time permits in Weeks 5-6`
4. Pick one **font** + one **icon set** (Material Icons or Lucide — not mixed). Record the choice in the register so T-02 can implement it.
5. Record agreed **severity-weight defaults** (accident > oil_spill > debris > pothole > other) and **R = 100m** as starting points to tune in T-07.
6. Update `WeRide_Project_Spec.md` §9 checkboxes for any decision changed in-sync (spec is source of truth; no solo changes).

**Files.** `docs/planning/person3_plan.md` (§5 register), `WeRide_Project_Spec.md` §9, `modules/routing-eta/README.md` (decision summary).

**Dependencies.** All 4 present at the weekly sync; Infra hosting + Mapbox/Google API key availability confirmed.

**Expected output.** A filled Decision Register with one owner and one status per row; no open questions remaining that block T-02..T-12.

**Definition of Done.** Every row in §5 is status `Decided` or `Decision Required — recommendation accepted`; decisions recorded in the spec/README; the team verbally agrees.

**Tests.** None (coordination task). Verify by reading the register.

---

### T-02 — Finalize Shared Theme (`theme.ts`: font + icon set)  `[MVP] · P1 · W1 D1`

**Objective.** Complete the shared design system MD §4.4 requires: one palette + one font + one icon set, hazard-type color map, rider-marker colors, safety-bar thresholds. `theme.ts` already has colors; this task adds the missing font/icon constants and hardens the file so everyone (A, B, D) imports it and no one hardcodes colors. **Blocks everyone's UI — ship Day 1.**

**Subtasks.**
1. Add `fonts` (primary/headline from the chosen font) and `iconSet` name constant to `app/src/theme/theme.ts`.
2. Verify hazard-type color map (`hazardColor()`), rider colors, and safety thresholds are present and match MD §4.4. Fix any drift (e.g., `safetyScoreColor` thresholds ≥0.7 / 0.4–0.7 / <0.4).
3. Add spacing/radii tokens only if needed by C's own screens (keep minimal — no redesign).
4. Replace the invalid `IconButton` import in `GroupListScreen.tsx` with the chosen icon approach as part of T-05's cleanup (do not leave `react-native`'s nonexistent `IconButton`).
5. Add a small test asserting the theme exports the required keys and threshold boundaries.

**Files.** `app/src/theme/theme.ts` (modify), `app/src/theme/colors.ts` (re-export already exists). Tests: `app/__tests__/theme.test.ts` (new).

**Dependencies.** T-01 (font + icon-set decision). Person B is downstream (hazard colors); Person D is downstream (VOX indicator styling).

**Expected output.** One theme file that fully specifies the design system; all C-owned screens import from it.

**Definition of Done.** `npm run lint && npm run typecheck && npm test` pass in `app/`; `theme.test.ts` covers every color-key/threshold; no hardcoded color hex remains in C's owned screens/components.

**Tests.** `theme.test.ts`: exports required tokens; `safetyScoreColor(0.7)=green`, `(0.4)=yellow`, `(0.39)=red`; `hazardColor` returns each hazard-type color.

---

### T-03 — Verify/Freeze `route_request` / `route_response` Contracts  `[MVP] · P1 · W1 D1–2`

**Objective.** Confirm the frozen §6.4 shapes (single `contracts/route_contract.json`, per MD §8) are correct and machine-checked, with all 4 reviewing (contracts are PR-reviewed, no solo changes). Person C is sole producer of `route_response` and sole consumer of `route_request`.

**Subtasks.**
1. Review `contracts/route_contract.json` against MD §2.1/§2.2 — exact field names, types, `path_points` as `[[lat,lng]]`, `safety_score ∈ [0,1]`, `recalculated_at_hlc` string. No changes unless the full team agrees.
2. Add a CI/schema check that validates any `POST /route` response against this schema (server test `route_response_contract` — also required by T-18).
3. Ensure `app/src/models/routeResponse.ts` matches the contract (it does today) and is the single client-side mapping source.
4. Record the outcome in the register (D-13: keep single-file contract — matches repo convention + MD §8).

**Files.** `contracts/route_contract.json` (verify only), `modules/routing-eta/server/test/` (add schema-validation test), `app/src/models/routeResponse.ts` (verify only).

**Dependencies.** All 4 reviewers.

**Expected output.** A CI-enforced schema that `POST /route` responses must satisfy; no contract drift possible.

**Definition of Done.** Contract file unchanged (or changed only via 4-way PR approval); a validation test fails on a malformed response and passes on a valid one.

**Tests.** `route_response_contract`: serialize a sample `route_response` through `ajv`/schema check → valid; mutate a required field → invalid.

---

### T-04 — Mock `route_response` Server (`POST /route`)  `[MVP] · P2 · W1 D2`

**Objective.** Ship the mandatory unblocking deliverable: a running Node server where `POST /route` returns a hardcoded/fake route (fixed origin → destination, fake ETA + `safety_score`) that exactly matches the §6.4 schema (MD §5.2 "Mock by Week 1 Day 2").

**Subtasks.**
1. Keep `handleRoute` in `server/astar.js` returning the existing straight-line mock, but make the mock **schema-exact** (validate against `route_contract.json` before returning; `recalculated_at_hlc` uses B's HLC **mock** `"${Date.now()}:0"`).
2. Add request validation: reject a body missing `group_id`, `origin`, `destination`, `avoid_hazard_types` with a 400 (contract `required` fields).
3. Confirm the server boots and the endpoint is reachable (`npm run dev` in `server/`).
4. Verify the client round-trip: `routingClient.requestRoute()` parses the mock correctly via `routeResponseFromJson`.

**Files.** `modules/routing-eta/server/astar.js` (modify `handleRoute`), `modules/routing-eta/server/index.js` (verify), `modules/routing-eta/test/routingClient.test.ts` (extend for the round-trip).

**Dependencies.** T-01, T-03, Infra Node host (or local `npm run dev`), Person B HLC mock (timestamp string only).

**Expected output.** `curl -X POST localhost:3000/route -d '{...}'` returns a valid `route_response`.

**Definition of Done.** Mock response passes the schema check from T-03; malformed body → 400; the app's `RoutingClient` renders the mock.

**Tests.** Extend `routingClient.test.ts` with a round-trip parse test; add `route_response_contract` smoke on the mock payload.

---

### T-05 — Group List / Create / Join Ride Screen  `[MVP] · P2 · W1 D2 (stub) → W1 (complete)`

**Objective.** P0 entry-point screen (spec §4.2, MD §4.1): list the user's active/past groups from Firestore, create a group, join by code, tap → navigate to the Live Map for that `group_id`. The stub must be navigable by Day 2; Firestore wiring completes in Week 1.

**Subtasks.**
1. Fix `groupService.ts`: `arrayUnion(uid)` (not `arrayUnion([uid])`); add `joinGroup` error handling (invalid code); add a `myGroups()` snapshot subscription returning a usable list (currently returns a raw snapshot).
2. `GroupListScreen.tsx`: subscribe to `groups` where `member_ids` contains `uid` via `onSnapshot`; render active/past groups; keep Create/Join actions; navigate to `Map` with `{ groupId }`.
3. Replace the invalid `IconButton` import (react-native exports no `IconButton`) with a `Pressable`/text button or the icon system chosen in T-02.
4. Confirm navigation exists in `app/src/navigation/RootStack.tsx` (GroupList → Map).
5. Add Firestore rules note: `groups` must be readable by members (coordinated with infra; `infra/firebase/firestore.rules`).

**Files.** `app/src/screens/GroupListScreen.tsx`, `modules/routing-eta/src/group/groupService.ts`, `app/src/navigation/RootStack.tsx` (verify), `infra/firebase/firestore.rules` (review only).

**Dependencies.** T-02 (theme/icons), T-01 (state transport decision — Firestore for groups), Infra Firestore config + emulator.

**Expected output.** From login, a user can create a group, see it in the list, and tap into the Live Map.

**Definition of Done.** Create → appears in list; join by code → `member_ids` gains the rider; tap group → `Map` screen for that `group_id`. Works against Firestore emulator with mocked auth.

**Tests.** `group_list_create_join` (module test using the firebase mock from `test/__mocks__/`): create writes a doc with `member_ids=[uid]`; join adds the uid; list query filters `array-contains`.

---

### T-06 — Road Graph Provider (`road_graph.js`)  `[MVP: Option A] · P3 · W1 D3–7`

**Objective.** Implement the road-graph source per the T-01 decision. **MVP default (Option A):** integrate a Directions API (Google Maps or Mapbox) to get the base route polyline + turn steps + distance — no custom graph needed. **Stretch (Option B, Weeks 5–6):** load an OSM road graph for the ride bbox + 5 km buffer, build `{ nodes, edges }` adjacency list, cache per group in memory. `road_graph.js` exposes one interface so T-07/T-08 don't change when the source does (MD §3.1).

**Subtasks.**
1. `road_graph.js`: implement Option A — server-side call to the chosen Directions API with `origin`, `destination`, `avoid` hints; parse `path_points` (polyline → `[[lat,lng]]`), `distance_km`, `turn_count` (from steps), `avg_speed_limit` estimate (map road-type legs to a default limit, else 40 km/h).
2. Same file: define the Option B loader stub (`loadRoadGraph(bbox)` building `nodes`/`edges`, clipped to bbox + buffer, cached per `group_id`) behind the same interface — implemented only if the W5–6 upgrade is attempted.
3. Env config: `GOOGLE_MAPS_API_KEY` or `MAPBOX_ACCESS_TOKEN` via `process.env`; graceful fallback to the straight-line mock if the API is unreachable (so devs without keys stay unblocked).
4. Unit-test the parser against a canned Directions-API JSON fixture (no live network in tests).

**Files.** `modules/routing-eta/server/road_graph.js` (rewrite), `modules/routing-eta/server/test/road_graph.test.js` (new).

**Dependencies.** T-01 (D-04 Option A/B), T-04 (server shape), API key (Mapbox token already used by app; Google key for ETA labels), Node 18+ `fetch`/`undici`.

**Expected output.** Given origin/dest, the server produces a real road polyline with `distance_km`, `turn_count`, `avg_speed_limit`.

**Definition of Done.** `road_graph.js` returns parsed route data from a fixture without live network in tests; `POST /route` (with T-07) renders a road-following line on the map by end of Week 1.

**Tests.** `road_graph_parse`: canned JSON → correct `path_points`/`turn_count`; `road_graph_no_key_fallback`: no env key → throws a typed "no key" error the handler maps to the straight-line fallback.

---

### T-07 — Hazard-Aware Routing + Safety Score  `[MVP] · P3 · W2–3`

**Objective.** Implement the safety weighting: an edge/segment near an active `hazard_cluster` costs more, routes actively avoid hazards, and the route carries a `safety_score ∈ [0,1]`. This is the core of the module (MD §3.1) and wires `hazard_cluster` (Person B) into routing.

**Subtasks.**
1. Create `server/hazard_penalty.js` (required by MD §8): `penalty(edge, hazard) = severity(hazard_type) * hazard_score * (1 - distance/R)` for `distance ≤ R` (R = 100 m default, tune), with severity defaults accident > oil_spill > debris > pothole > other (scaffold values 5/4/3/2/1). Extract this logic out of `astar.js` so the formula lives in one place.
2. **Option A post-processing:** given the base route from T-06 + active hazards (filtered by `group_id`, `status='active'`, and `avoid_hazard_types`), detect route segments within R of a hazard; if any, re-request the route with an avoidance waypoint (offset perpendicular to the hazard) or request `alternatives=true` and pick the candidate minimizing total penalty; if all candidates still intersect, return the best-effort route and let `safety_score` reflect it.
3. **Option B (stretch):** `applyHazardPenalties(graph, hazards, R, severityWeights)` sets `weight = base_cost * (1 + penalty)` per edge; A* (T-08) finds the optimal weighted path.
4. Wire `safety_score.js`: `computeSafetyScore(path, hazards, R)` per the documented formula; ensure `safety_score = 1` on a hazard-free route and degrades on 3 accidents.
5. Extend `handleRoute` orchestration: fetch/filter hazards (mock stream for now, real listener in T-17), run the chosen path, compute `distance_km`, `safety_score`, call ETA (T-12), assemble the §6.4 `route_response` with `recalculated_at_hlc`.
6. Document the final penalty + safety_score formulas in `modules/routing-eta/README.md` (also T-20; do it here so it stays fresh).

**Files.** `modules/routing-eta/server/hazard_penalty.js` (new), `server/astar.js` (refactor penalty out; orchestration), `server/safety_score.js`, `server/test/hazard_penalty.test.js` (new), `server/test/reroute.test.js` (new), `README.md`.

**Dependencies.** T-06 (base route), T-04 (server), Person B `hazard_cluster` mock (W1 D2), T-08 (Option B path), T-12 (ETA call — can stub `eta_minutes` until then).

**Expected output.** `POST /route` returns a hazard-aware path: route bends away from a staged hazard, `safety_score` drops when a hazard is near.

**Definition of Done.** `hazard_penalty_applied`, `safety_score_range`, and `reroute_on_hazard` tests pass; severity weights + R tunable via constants; formulas written in README.

**Tests.**
- `hazard_penalty_applied`: same edge with a hazard within R weighs more than without.
- `safety_score_range`: score ∈ [0,1]; hazard-free route > route through 3 accidents.
- `reroute_on_hazard`: stub Directions client returns a base route through a staged hazard → handler returns an avoiding route (assert path no longer within R of the hazard).

---

### T-08 — Complete & Verify A* Core (`astar.js`)  `[MVP] · P3 · W2–3`

**Objective.** A* is chosen over Dijkstra for the <1 s recalc requirement (§11 row 4 / MD §3.1). Keep A* pure and testable; fix the known shortcuts; prove optimality and admissibility; prove the latency budget. This is what the report claims, so it must be verifiable even under the Option-A MVP (the algorithm is the safety-search engine and the Option-B upgrade path).

**Subtasks.**
1. Replace the O(n log n) sort-based `MinHeap` with a proper binary heap (ponytail in `astar.js`).
2. Verify the heuristic is Haversine straight-line to destination (admissible → never overestimates → optimal path guaranteed). Add the required admissibility test.
3. Add `clipGraphToBbox(graph, bbox, bufferKm)` and a per-`group_id` in-memory graph cache hook (mitigate the "graph too large → slow A*" risk, MD §9).
4. Keep the `astar(graph, start, goal) → { path, cost }` signature unchanged; ensure it works with weighted edges produced by T-07.
5. Add the `demo()` self-check entry (see T-19): A* on a tiny grid graph with one hazard prints the avoiding path — eyeballable without a server.

**Files.** `modules/routing-eta/server/astar.js`, `server/road_graph.js` (clip/cache hooks), `server/test/astar.test.js` (extend), `server/demo.js` (new, T-19).

**Dependencies.** T-06 (Option B graph for latency test — or a generated grid graph fixture), T-07 (weighted edges).

**Expected output.** A* that returns the minimum-weight path with an admissible heuristic, on a realistic-size graph, well under 1 s.

**Definition of Done.** `astar_optimal`, `astar_heuristic_admissible`, `recalc_latency_under_1s` all pass; heap is a real binary heap; graph clip/cache helpers exist.

**Tests.**
- `astar_optimal`: shortest-weight path on a known small graph (exists; keep).
- `astar_heuristic_admissible`: for random points, `h(node) ≤ true distance` to goal.
- `recalc_latency_under_1s`: generated grid graph (~10k nodes) + 1 hazard; time `astar` + penalties; assert < 1000 ms.

---

### T-09 — Dynamic Recalculation Client (hazard listener + debounce + route state)  `[MVP] · P3 · W2–3`

**Objective.** The mobile client subscribes to `hazard_cluster` changes (Firestore listener from B); when a new/updated cluster is within R of the current route, it calls `POST /route` again with updated `avoid_hazard_types`. Batch bursts with the 500 ms debounce (`# ponytail: 500ms debounce, tune if UX feels laggy`) to avoid a recalculation storm. Expose the latest `route_response` to UI via a module-local store (per AGENTS convention — per-module state lives in `modules/*/src`, not the root `appStore`).

**Subtasks.**
1. Add `modules/routing-eta/src/client/routeStore.ts` (Zustand): holds `route: RouteResponse | null`, `loading`, `avoidHazards`; actions `setRoute`, `setAvoidHazards`.
2. Add `modules/routing-eta/src/client/hazardListener.ts`: subscribes to `hazards/{cluster_id}` for the group, filters `status='active'` + `group_id`, checks proximity to the current route's `path_points` within R; on any relevant change calls `routingClient.scheduleRecalculation(...)`.
3. Wire `RoutingClient` to write responses into the store (and keep the debounce in `scheduleRecalculation`).
4. Re-export the new client pieces from `src/index.ts`.
5. On a fresh `route_response`, bump `recalculated_at_hlc`-driven re-render (consumed by T-13/T-14).

**Files.** `modules/routing-eta/src/client/routeStore.ts` (new), `src/client/hazardListener.ts` (new), `src/client/routingClient.ts` (modify), `src/index.ts` (modify), `modules/routing-eta/test/routingClient.test.ts` (extend).

**Dependencies.** T-07 (server reroute), T-04 (server reachable), Person B `hazard_cluster` mock stream, T-06 (R/proximity constants from hazard_penalty).

**Expected output.** When a mock hazard appears near the route, exactly one debounced `/route` call fires and the store's route updates.

**Definition of Done.** Multiple hazard events within 500 ms → 1 request (existing debounce test keeps passing); a hazard near the route triggers a scheduled recalculation (new test); store exposes the new route for the UI.

**Tests.** Extend `routingClient.test.ts`: `hazard_near_route_triggers_recalc` (mock Firestore hazard event → assert `scheduleRecalculation` called); `debounce` test unchanged.

---

### T-10 — ETA Training-Data Collection (`collect_directions.py`)  `[MVP] · P4 · W2–3`

**Objective.** Bootstrap real training data without real rides: use the Google Maps Directions API ETA as the label and C's features as inputs (MD §3.2). Also provide a synthetic-data fallback so the pipeline runs with no API key.

**Subtasks.**
1. Complete `collect_directions.py`: sample many (origin, destination, departure_time) tuples in the test region; record `distance_km`, `turn_count`, `eta_minutes` (label), `hour_of_day`, `day_of_week`, `hazard_count`, `avg_speed_limit`.
2. Add a `--synthetic` mode (or separate `generate_synthetic.py`) producing the same columns with plausible noise — unblocks T-11 when no `GOOGLE_MAPS_API_KEY`.
3. Run it, produce `routes_df.csv` (target ≥ 500 rows; commit or document regeneration).
4. Optionally, later: pull real `hazard_count_along_route` from B's clusters instead of random (note as a small enhancement).

**Files.** `modules/routing-eta/server/training/collect_directions.py` (modify), `server/training/generate_synthetic.py` (new), `server/training/routes_df.csv` (generated artifact).

**Dependencies.** Google Maps API key (or synthetic fallback), T-06 feature definitions (matching columns).

**Expected output.** `routes_df.csv` with the §3.2 feature columns and ETA labels.

**Definition of Done.** CSV regenerates; rows match the `FEATURES` list in `train_eta.py`; each row has a positive `eta_minutes`.

**Tests.** Manual/CI sanity: `train_eta.py` runs end-to-end on the CSV (see T-11); optionally a pytest asserting no null/malformed rows.

---

### T-11 — Train LightGBM ETA Model (`train_eta.py`)  `[MVP] · P4 · W2–3`

**Objective.** Train the gradient-boosted tree model (LightGBM, per MD §3.2 recommendation), export it, and record quality metrics so the README can cite them.

**Subtasks.**
1. Complete `train_eta.py` (scaffold exists): train/test split, `LGBMRegressor` on `FEATURES` → `eta_minutes`, print RMSE, save `eta_model.txt` via `booster_.save_model`.
2. Verify the model file is loadable (see T-12 inference path).
3. Record train/test RMSE + feature-importance output for the README's "why ML" narrative.
4. If the Node/Python sidecar path (D-05) is chosen, confirm `lightgbm` Python package works in the dev environment; otherwise the fallback heuristic (T-12) carries the demo.

**Files.** `modules/routing-eta/server/training/train_eta.py` (modify), `server/training/eta_model.txt` (generated artifact).

**Dependencies.** T-10 (CSV), Python env with `lightgbm pandas scikit-learn`.

**Expected output.** `eta_model.txt` + printed RMSE.

**Definition of Done.** Model trains and exports without error; RMSE recorded; a one-line inference smoke passes (predict on one feature vector).

**Tests.** `eta_model_sanity` (server-side, T-18): ETA positive, roughly proportional to `distance_km`, increases with `hazard_count`. When a real model file exists, run against it; otherwise against the fallback.

---

### T-12 — ETA Inference Server + Wire Into `POST /route`  `[MVP] · P4 · W2–3`

**Objective.** Load the trained model on the server and return `eta_minutes` in `route_response`. Per MD §3.2/§9 recommendation: **server REST call** (no on-device runtime). Because the `lightgbm` Node binding is immature, use a **Python sidecar** (`# ponytail: Python sidecar for LightGBM inference, Node-native binding if it stabilizes`), with the distance/speed heuristic as a documented fallback when the model/sidecar is unavailable.

**Subtasks.**
1. `eta_model.js`: implement `predictEta(features)` — try Python sidecar (`POST localhost:5000/predict`) first; fall back to the existing `distance/avg_speed + hazard delay` heuristic with a clear log line.
2. Implement the sidecar: `server/training/eta_sidecar.py` (Flask/FastAPI) loading `eta_model.txt`, serving `/predict` for the 6 features.
3. Compute features in `handleRoute` (T-07): `distance_km`, `turn_count` (T-06), `hour_of_day`, `day_of_week`, `hazard_count_along_route` (T-07), `avg_speed_limit` (T-06).
4. Ensure `eta_minutes` is positive and finite even if inference fails (fallback).
5. Document the inference location + latency tradeoff in README (MD §3.2 "Document this in your README").

**Files.** `modules/routing-eta/server/eta_model.js` (modify), `server/training/eta_sidecar.py` (new), `server/astar.js` (wire features into `handleRoute`), `server/package.json` (add sidecar run script), `README.md`.

**Dependencies.** T-11 (model), T-07 (route + hazard_count), T-06 (turn_count, distance), Python env.

**Expected output.** `POST /route` returns a sensible `eta_minutes` derived from the model (or a logged heuristic fallback).

**Definition of Done.** Sidecar runs and serves `/predict`; Node proxies correctly; heuristic fallback engaged when sidecar is down; `eta_model_sanity` passes.

**Tests.** `eta_model_sanity`: with a fixed feature vector, ETA > 0; increasing `distance_km` increases ETA; increasing `hazard_count` increases ETA.

---

### T-13 — Route/ETA Panel (collapsed + expanded, auto-update, avoid toggle)  `[MVP] · P5 · W2–3`

**Objective.** The bottom-sheet panel on the Live Map (MD §4.2, spec §4.2): collapsed shows ETA (min) + distance (km) + safety bar (green/yellow/red); expanded shows the turn list (when turn data exists) + "Open in Google Maps"; auto-updates when `route_response` changes (no manual refresh); includes the "Avoid hazards" toggle that swaps `avoid_hazard_types` between all-types and none. `RoutePanel.tsx` (module component) is the reusable UI; `RouteOverlay.tsx` (app overlay, already registered on `MapScreen`) hosts it.

**Subtasks.**
1. `RoutePanel.tsx`: implement collapsed/expanded states (expanded reveals turn list if present), render via `safetyScoreColor`, add the toggle + deep-link button callbacks.
2. `RouteOverlay.tsx`: subscribe to `routeStore` (T-09); re-render automatically when `route_response` changes; on toggle change, update store `avoidHazards` and trigger `requestRoute`; pass `onOpenInGoogleMaps` → T-15.
3. Add the route slice consumers; ensure re-render is driven by `recalculated_at_hlc` (bump) so the panel updates without user action.
4. Remove the hardcoded `0 / 0 / 1` placeholder values.

**Files.** `modules/routing-eta/src/client/RoutePanel.tsx` (modify), `app/src/screens/map/overlays/RouteOverlay.tsx` (modify), `modules/routing-eta/src/index.ts` (re-export), `app/src/store/appStore.ts` (no change — per-module store, per AGENTS).

**Dependencies.** T-09 (store), T-07 (route_response content), T-02 (theme), T-15 (deep-link handler).

**Expected output.** On the Live Map, the panel shows live ETA/distance/safety and updates when the route recomputes.

**Definition of Done.** Panel re-renders when the store's `route` changes (no manual refresh); toggle flips `avoid_hazard_types` and re-requests; safety bar uses theme thresholds.

**Tests.** `eta_panel_updates` (module test with RN preset / react-test-renderer, or `app/__tests__/`): render with route A, update store to route B → panel text reflects B without user action.

---

### T-14 — Route Line Map Overlay  `[MVP] · P5 · W2–3`

**Objective.** Draw the route on the map from `route_response.path_points` as a Mapbox `ShapeSource` + `LineLayer` (GeoJSON `LineString`), re-drawn when `recalculated_at_hlc` changes (MD §4.3; spec §4.2). Coordinate with Person A's overlay interface — `RouteOverlay` is already registered on A's `MapScreen` shell.

**Subtasks.**
1. Use `routeLine.ts`'s `routeToGeoJsonLine` (already converts to `[lng,lat]` and tags `recalculated_at_hlc`) as the source of the feature.
2. In `RouteOverlay.tsx` (or a small `RouteLineLayer` child), render `<MapboxGL.ShapeSource><MapboxGL.LineLayer/></MapboxGL.ShapeSource>` inside the map; rebuild the feature when the store route's `recalculated_at_hlc` changes (useMemo keyed on that field).
3. Add basic line styling via the theme (route color from `WeRideColors.primary`/`accent`), width/casing defaults — no custom map style (YAGNI).
4. Verify re-draw latency visually during the marquee reroute (T-17).

**Files.** `modules/routing-eta/src/client/routeLine.ts` (verify/extend), `app/src/screens/map/overlays/RouteOverlay.tsx` (add line layer), `modules/routing-eta/test/routeLine.test.ts` (new).

**Dependencies.** T-09 (store), T-02 (theme color), Person A's MapScreen shell (interface locked W1 D2).

**Expected output.** A visible route line on the map that changes shape when the route recomputes.

**Definition of Done.** Feature coordinates in `[lng,lat]` order; line re-renders on `recalculated_at_hlc` change; tests assert the GeoJSON shape + the feature key.

**Tests.** `route_line_geojson`: input `path_points [[lat,lng]...]` → LineString with swapped coords and `recalculated_at_hlc` property.

---

### T-15 — Google Maps Deep Link  `[MVP] · P5 · W2–3`

**Objective.** "Open in Google Maps" hands off turn-by-turn navigation via the Google Maps intent URL (spec §2 / MD §4.2) — the app does **not** do in-app turn-by-turn (YAGNI).

**Subtasks.**
1. Add `googleMapsDeepLink(origin, destination)` util (e.g., in `routeLine.ts` or a new `deepLink.ts`): `https://www.google.com/maps/dir/?api=1&origin=lat,lng&destination=lat,lng&travelmode=driving`.
2. Wire `RoutePanel`'s button → `Linking.openURL(url)`; guard with `Linking.canOpenURL`; surface an error toast/alert on failure.
3. Test the exact URL shape for the current origin (rider `verified_location`) and destination.

**Files.** `modules/routing-eta/src/client/deepLink.ts` (new) or `routeLine.ts`, `modules/routing-eta/src/client/RoutePanel.tsx` (button handler), `modules/routing-eta/test/deepLink.test.ts` (new).

**Dependencies.** T-13 (panel button), T-16 origin (can use destination-only for the test).

**Expected output.** Tapping the button opens Google Maps navigation for the route.

**Definition of Done.** URL matches the documented format; `canOpenURL` guard present; test asserts exact URL.

**Tests.** `google_maps_deeplink`: for given origin/dest, `googleMapsDeepLink` returns `dir/?api=1&origin=...&destination=...&travelmode=driving`.

---

### T-16 — Integration Swap 1: Real `verified_location` (Person A)  `[MVP] · P6 · Week 4`

**Objective.** Route origin becomes the rider's **real** EKF-verified position instead of the mock (MD §5.1 / Week 4). Routes must start from where the rider actually is.

**Subtasks.**
1. Subscribe to A's `verified_location` stream (Socket.io `location:update` via `app/src/services/socketService.ts`, or A's module store) for the current rider in the group.
2. In `routeStore`/`RoutingClient`, use the latest `verified_location` as `route_request.origin` (only when `spoof_flag=false` and `accuracy_m` is acceptable; otherwise keep last good origin).
3. Avoid origin-churn recalc storms: only trigger a new `/route` when the rider has moved >~100 m (or when hazards change via T-09).
4. Verify on the live map that the route line starts at the rider marker.

**Files.** `modules/routing-eta/src/client/routeStore.ts`, `src/client/hazardListener.ts` or a new `originListener.ts`, `src/client/routingClient.ts`.

**Dependencies.** Person A real EKF + `verified_location` stream (Week 4 checkpoint), T-09.

**Expected output.** Requesting a route uses the live verified position; the line starts at the rider.

**Definition of Done.** Route origin equals the latest non-spoofed `verified_location`; moving the rider >100 m refreshes the route; no recalc storm on small jitter.

**Tests.** Mock a `verified_location` update into the store → assert the next request's `origin` matches; spoofed location → origin unchanged.

---

### T-17 — Integration Swap 2: Real `hazard_cluster` + HLC + Marquee Reroute (Person B)  `[MVP] · P6 · Week 5`

**Objective.** The critical integration week (MD Week 5): real B `hazard_cluster`s (Firestore listener) replace the mock stream; routing avoids real hazards; `recalculated_at_hlc` uses B's real HLC; the marquee test — new hazard mid-route → recalc <1 s → route + ETA update automatically (§11 row 4 / §12 item 3).

**Subtasks.**
1. Replace mock hazard feed in T-09's `hazardListener` with the real Firestore `hazards/{cluster_id}` listener (filter `group_id`, `status='active'`).
2. Server: fetch real active clusters for the group (Firestore admin SDK or pass-through from client) into `handleRoute`; filter by `avoid_hazard_types`; apply penalties/avoidance (T-07).
3. `recalculated_at_hlc`: use B's real HLC utility (import `@hazard/hlc` — `modules/hazard-sos/src/hlc/hlc.ts` exposes `HLC`) on the server or accept B's HLC string from the triggering event; replace the `Date.now():0` mock.
4. Marquee test: publish a new `hazard_cluster` near the route mid-ride → assert the route bends away and `recalculated_at_hlc` bumps; time the full loop (client trigger → server recalc → UI update) and verify the server portion <1 s.
5. Measure + document call frequency (debounce behavior, how many `/route` calls per minute) for the §11 row 7 battery/CPU story.

**Files.** `modules/routing-eta/src/client/hazardListener.ts` (real listener), `server/astar.js`/`server/hazard_penalty.js` (real hazard fetch), `server/test/reroute.test.js` (extend, timed), `app/src/screens/map/overlays/RouteOverlay.tsx` (verify update), `README.md` (call frequency).

**Dependencies.** Person B real `hazard_cluster` + HLC (Week 5 checkpoint), T-07, T-09, T-12 (ETA recalculates), T-14 (line redraw).

**Expected output.** The demo beat: hazard appears → route visibly bends away → ETA/safety panel updates automatically.

**Definition of Done.** `reroute_on_hazard` passes against real hazard fixtures; timed server recalc <1 s on the realistic graph; panel + line update without user action; HLC string reflects B's clock.

**Tests.** `reroute_on_hazard` (real cluster fixture, timed <1 s); `recalc_latency_under_1s` (kept green); app-side `eta_panel_updates` re-run with a real hazard event.

---

### T-18 — Complete Server-Side Test Suite (§7)  `[MVP] · P7 · W2–6 (parallel)`

**Objective.** Ensure every required §7 server test exists and passes in CI (`node --test` in `server/`). Many are written inline by earlier tasks; this is the close-out.

**Subtasks.**
1. Verify each of the 8 §7 server tests present + green: `astar_optimal`, `astar_heuristic_admissible`, `hazard_penalty_applied`, `reroute_on_hazard`, `recalc_latency_under_1s`, `eta_model_sanity`, `safety_score_range`, `route_response_contract`.
2. Add any missing test bodies (candidates: `route_response_contract` schema check, `recalc_latency_under_1s` timing).
3. Ensure `npm test` (server) is wired into CI (`infra/ci/ci.yml` routing-eta +server job) and blocks merge on failure (AGENTS.md).

**Files.** `modules/routing-eta/server/test/*.test.js`, `infra/ci/ci.yml` (verify).

**Dependencies.** T-07, T-08, T-12 (their behaviors under test), CI infra.

**Expected output.** Server test suite runs clean in CI.

**Definition of Done.** All 8 §7 server tests pass; CI job green; a broken test blocks the PR.

**Tests.** The suite itself (see subtask 1).

---

### T-19 — App-Side Tests + `demo()` Self-Check  `[MVP] · P7 · W2–6`

**Objective.** §7 app-side tests (`eta_panel_updates`, `google_maps_deeplink`, `group_list_create_join`) and the self-check `demo()` that runs A* on a tiny grid with one hazard and prints the avoiding path (eyeballable without the server).

**Subtasks.**
1. Land `eta_panel_updates` (T-13), `google_maps_deeplink` (T-15), `group_list_create_join` (T-05) as module or `app/__tests__/` tests per AGENTS placement rules.
2. Add `modules/routing-eta/server/demo.js`: builds a small grid graph, inserts one hazard, runs A* + penalties, prints the path that avoids it.
3. Confirm `npm test` (module) + `npm test` (app) run in CI.

**Files.** `modules/routing-eta/test/*` (UI/logic tests), `app/__tests__/*` (RN-component tests), `server/demo.js` (new).

**Dependencies.** T-05, T-13, T-15, T-08.

**Expected output.** All app-side tests pass; `node server/demo.js` prints a hazard-avoiding path.

**Definition of Done.** Three §7 app tests green; `demo.js` runs standalone and prints a sensible avoiding path.

**Tests.** `eta_panel_updates`, `google_maps_deeplink`, `group_list_create_join`.

---

### T-20 — Module README + Algorithm Documentation  `[MVP] · P7 · W2–6`

**Objective.** `modules/routing-eta/README.md` documents exactly what MD §2–3 require: road graph source + chosen approach, A* heuristic, hazard penalty function, safety_score formula, ETA model features + training source, inference location, and the recalculation/debounce/call-frequency notes.

**Subtasks.**
1. Write/finalize the README sections (scaffold exists; keep it current after T-06/T-07/T-12).
2. Record the ETA model's RMSE + feature list (from T-11).
3. Document the server-inference latency tradeoff (MD §3.2).
4. Record the safety-bar thresholds + severity weights + R and how to tune them.

**Files.** `modules/routing-eta/README.md`, optionally `server/README.md`.

**Dependencies.** T-06, T-07, T-12, T-11 metrics.

**Expected output.** A README that a reviewer can read to understand every formula and integration point.

**Definition of Done.** All §3 items documented; formulas match code; RMSE recorded.

**Tests.** None (documentation). Review gate: code formulas match README formulas.

---

### T-21 — Week 6 System Integration + Performance Validation  `[MVP] · P7 · Week 6`

**Objective.** Full-system validation of C's parts (MD Week 6): dynamic rerouting <1 s, safety-score correctness vs actual hazard exposure, ETA accuracy vs a real test ride, and battery/CPU story (module is mostly server-side — client impact is HTTP calls; document call frequency).

**Subtasks.**
1. Run the marquee reroute in the integrated app; time client→server→UI loop; confirm <1 s server portion (and acceptable end-to-end).
2. Validate safety bar color matches actual hazard exposure on a staged ride.
3. Compare predicted `eta_minutes` to a real test-ride duration; record the delta.
4. Profile HTTP call frequency (debounce + hazard-triggered + origin-move thresholds) and record in README (§11 row 7).

**Files.** `README.md` (perf notes), test fixtures; code changes only if a defect is found.

**Dependencies.** T-16 (real origin), T-17 (real hazards), T-12 (ETA), all of P5 (UI), full app integration.

**Expected output.** Measured numbers for the report: recalc time, ETA error, call frequency.

**Definition of Done.** <1 s recalc verified; safety bar matches exposure; ETA error documented; call-frequency profile in README.

**Tests.** Re-run `recalc_latency_under_1s` + `reroute_on_hazard` in the integrated environment; manual ride validation.

---

### T-22 — Week 6–7 UI Polish, Theme Review, Freeze + Demo Rehearsal  `[MVP] · P7 · Week 6–7`

**Objective.** As UI-lead: polish C's screens/overlays against the theme, review B's and D's overlays for theme consistency (no hardcoded colors), and land the Week 7 freeze + demo rehearsal of the reroute beat (§12 item 3) — hazard appears → route bends → panel updates, all within ~3 s.

**Subtasks.**
1. UI polish pass on Route/ETA panel, Group List, route line (spacing, theme tokens, safe-area bottom sheet).
2. Theme-consistency review of B's (hazard markers) and D's (VOX indicator) overlays; open review comments for any hardcoded colors.
3. Freeze the final build 2 days before submission (MD Week 7); branch freeze + tag.
4. Rehearse the demo script (MD §10): stage the hazard via the mock producer, practice the timing so the reroute lands within ~3 s; refine the one-line explanation.

**Files.** C's UI files from T-13/T-14 (polish), review comments for B/D, demo notes in `docs/meeting_notes/` or `report_drafts/`.

**Dependencies.** T-21 (validated integration), all P5 UI, B/D overlay review requests.

**Expected output.** A polished, consistent UI and a rehearsed, reliable demo.

**Definition of Done.** No hardcoded colors in C's UI; B/D overlays use theme tokens; build frozen; demo beat rehearsed to ~3 s.

**Tests.** Manual demo rehearsal; regression: `npm run lint && npm run typecheck && npm test` green for app + module + server before freeze.

---

## 3. Decision Register

Preserves the MD's "Decide Day 1" items. Nothing is silently decided — each row is `Decided` (locked in MD/spec/scaffold), `Decision Required` (team must pick), or `Stretch` (optional). T-01 ratifies this register.

| ID | Decision | MD reference | Status / Recommendation | Owner |
|---|---|---|---|---|
| D-01 | Express vs Fastify | MD §2 ("pick one Day 1") | **Decision Required → Express** (already scaffolded in `server/package.json`; single Node process) | C |
| D-02 | LightGBM vs XGBoost | MD §3.2 ("Recommendation: LightGBM") | **Decided — LightGBM** (recorded in README; don't maintain both) | C |
| D-03 | ETA inference: server REST vs on-device ONNX | MD §3.2/§9 ("recommendation: server REST call") | **Decided — server REST call** (on-device is YAGNI per §11) | C |
| D-04 | Road graph: Option A (Directions + post-process) vs Option B (true A* on OSM) | MD §3.1 ("start Option A, upgrade to B if time permits in Weeks 5-6") | **Decision Required — recommendation: Option A MVP; Option B upgrade in W5–6** (T-06/T-07; T-08 keeps A* ready) | C |
| D-05 | LightGBM in Node vs Python sidecar | MD §3.2 "`# ponytail: Python sidecar...`" | **Decision Required → Python sidecar** (Flask/FastAPI, Node proxy), with distance/speed heuristic fallback so the demo never blocks on model infra | C |
| D-06 | Single Node process vs separate services | MD §2 ("single Node process... simplest") | **Decided — single Node process**, namespaced routers `/route`, `/fl`, `/vox` (matches scaffold + AGENTS) | C/D |
| D-07 | Font + icon set (Material Icons or Lucide — not mixed) | MD §4.4 ("pick one... Week 1 Day 1") | **Decision Required → Material Icons** (RN-standard); one font (system default or one Google font). Implemented in T-02 | C |
| D-08 | Safety-bar thresholds | MD §4.4 ("green ≥0.7, yellow 0.4–0.7, red <0.4... document") | **Decided — already locked in `theme.ts`** (`safetyScoreColor`) | C |
| D-09 | Hazard severity weights | MD §3.1 ("tune in Week 2–3: accident > oil_spill > debris > pothole > other") | **Decision Required — start scaffold defaults 5/4/3/2/1**, tune in T-07, record in README | C |
| D-10 | Hazard influence radius R | MD §3.1 ("e.g., 100m") | **Decision Required — default 100 m**, tunable constant | C |
| D-11 | Recalculation debounce window | MD §9 ("500ms window... `# ponytail`") | **Decided — 500 ms**, tune if UX feels laggy | C |
| D-12 | Realtime transport (location vs hazards) | Spec §9 (unchecked) | **External** — Socket.io for location (A), Firestore listeners for hazards (B). C only consumes; raise in sync if unresolved | A/B |
| D-13 | Contract file layout: single `route_contract.json` vs split request/response | MD §6 (mentions two) vs §8 (single file) | **Decided — keep single file** (matches §8 + existing repo convention; §6 wording treated as loose) | C |
| D-14 | Turn-list data source | MD §4.2 (turn list "if you have turn-by-turn data") | **Follows D-04** — Option A (Directions steps) provides turns; Option B has none → panel shows turn list only when present | C |
| D-15 | Persist `route_response` to Firestore `routes/{route_id}` | Spec §7 schema exists; MD §8 files omit it | **Stretch** — not required for MVP/demo; only if time permits | C |
| D-16 | Directions provider for base route (Google vs Mapbox) | MD §3.1 Option A | **Decision Required → Google Maps Directions** (already used for ETA labels in T-10; one provider; Mapbox stays the tiles SDK) | C |

---

## 4. Dependency / Critical Path

```
Infra (Node host + Firebase emulator/config) ──────┐
T-01 (decisions) ──► T-02 (theme) ──► T-13/14/15 UI │
        └──────────► T-03 (contracts) ──► T-04 (mock server) ──► T-06 (road graph)
Person A verified_location mock (W1D2) ─────────────┘  │
Mapbox/Google API key ───────────────────────────► T-06 ──► T-07 (hazard-aware routing)
Person B hazard_cluster mock (W1D2) ──────────────► T-07 ──► T-09 (recalc client) ──► T-13/14 (UI)
Person B HLC mock (W1D2) ─────────────────────────► T-04 ──► T-17 (real HLC, W5)
                                                          T-08 (A*) ◄── T-07 (weighted edges)
T-06 ──► T-10 (data) ──► T-11 (train) ──► T-12 (infer) ──► T-07 (eta in /route) ──► T-13 (panel)
Person A real EKF (W4) ───────────────────────────► T-16 ──► T-17 ──► T-21 (W6 integration)
Person B real hazard_cluster + HLC (W5) ───────────► T-17 ──► T-21 ──► T-22 (W7 freeze/demo)
T-18 / T-19 (tests) — continuous; gate CI/merge
```

**External (Person 1) blockers:** `verified_location` mock by W1 D2 (T-04/T-16), real EKF by W4 (T-16).
**External (Person 2) blockers:** `hazard_cluster` mock + HLC by W1 D2 (T-04/T-07), real clusters + HLC by W5 (T-17). **This is the marquee dependency.**
**Infra blockers:** Firebase project + emulator, Node hosting, Firestore `groups` rules (T-05), CI wiring (T-18).
**Person 3 internal critical path:** T-03 → T-04 → T-06 → T-07 → T-09 → T-17. ETA path runs parallel: T-06 → T-10 → T-11 → T-12 → T-07.

---

## 5. File → Task Mapping

| File | Task(s) | Phase |
|---|---|---|
| `contracts/route_contract.json` | T-03 (verify/freeze), T-04 (schema-exact mock) | P1/P2 |
| `app/src/theme/theme.ts` | T-02 (fonts/icons/thresholds) | P1 |
| `app/src/theme/colors.ts` | T-02 (re-export) | P1 |
| `modules/routing-eta/server/index.js` | T-04 (verify boot), T-07 (orchestration) | P2/P3 |
| `modules/routing-eta/server/astar.js` | T-04 (mock), T-07 (penalty refactor/orchestration), T-08 (heap/clip/cache) | P2/P3 |
| `modules/routing-eta/server/road_graph.js` | T-06 (Option A provider + Option B loader stub) | P3 |
| `modules/routing-eta/server/hazard_penalty.js` | T-07 (new) | P3 |
| `modules/routing-eta/server/safety_score.js` | T-07 (wire real formula) | P3 |
| `modules/routing-eta/server/eta_model.js` | T-12 (sidecar proxy + fallback) | P4 |
| `modules/routing-eta/server/training/collect_directions.py` | T-10 | P4 |
| `modules/routing-eta/server/training/generate_synthetic.py` | T-10 (new fallback) | P4 |
| `modules/routing-eta/server/training/train_eta.py` | T-11 | P4 |
| `modules/routing-eta/server/training/eta_sidecar.py` | T-12 (new) | P4 |
| `modules/routing-eta/server/training/eta_model.txt` | T-11 (generated) | P4 |
| `modules/routing-eta/server/test/astar.test.js` | T-08 (extend), T-18 | P3/P7 |
| `modules/routing-eta/server/test/hazard_penalty.test.js` | T-07 (new) | P3 |
| `modules/routing-eta/server/test/reroute.test.js` | T-07, T-17 (timed) | P3/P6 |
| `modules/routing-eta/server/test/road_graph.test.js` | T-06 (new) | P3 |
| `modules/routing-eta/server/demo.js` | T-19 (new self-check) | P7 |
| `modules/routing-eta/src/client/routingClient.ts` | T-04 (round-trip), T-09 (store wiring), T-16 (origin) | P2/P3/P6 |
| `modules/routing-eta/src/client/routeStore.ts` | T-09 (new), T-13, T-16 | P3/P5/P6 |
| `modules/routing-eta/src/client/hazardListener.ts` | T-09 (new), T-17 (real listener) | P3/P6 |
| `modules/routing-eta/src/client/RoutePanel.tsx` | T-13 (full panel), T-15 (deep-link button) | P5 |
| `modules/routing-eta/src/client/routeLine.ts` | T-14 (verify), T-15 (deep-link util) | P5 |
| `modules/routing-eta/src/group/groupService.ts` | T-05 (fix arrayUnion + list) | P2 |
| `modules/routing-eta/src/index.ts` | T-09, T-13 (re-exports) | P3/P5 |
| `modules/routing-eta/README.md` | T-20 (final), T-01/T-07/T-12/T-17 (living docs) | P7 |
| `modules/routing-eta/test/routingClient.test.ts` | T-04 (extend), T-09 (extend) | P2/P3 |
| `modules/routing-eta/test/routeLine.test.ts`, `deepLink.test.ts` | T-14, T-15 (new) | P5 |
| `app/src/models/routeResponse.ts` | T-03 (verify) | P1 |
| `app/src/screens/GroupListScreen.tsx` | T-05 (real list + fix imports) | P2 |
| `app/src/screens/map/overlays/RouteOverlay.tsx` | T-13 (store subscription), T-14 (line layer), T-17 (verify) | P5/P6 |
| `app/src/screens/map/MapScreen.tsx` | T-14 (verify overlay registration) | P5 |
| `app/src/store/appStore.ts` | No change (per-module state; AGENTS.md) | — |
| `infra/firebase/firestore.rules` | T-05 (groups readable by members), T-17 (hazards) | P2/P6 |
| `infra/ci/ci.yml` | T-18 (server test job green) | P7 |
| `docs/planning/person3_plan.md` | T-01 (decision register) | P1 |

---

## 6. 7-Week Timeline (aligned with MD Week-by-Week)

| Week | MD plan | Person 3 tasks | Checkpoint |
|---|---|---|---|
| **1 (D1)** | Lock decisions (§9), design system, contracts | **T-01** (decisions), **T-02** (theme.ts), **T-03** (contracts) | Contract + theme signed off; register filled |
| **1 (D2)** | Unblocking rule: mocks + stubs | **T-04** (mock `/route`), **T-05** (Group List stub navigable) | Mocks running; everyone unblocked |
| **1 (D3–7)** | Real implementation begins | **T-06** (road graph), start **T-08** (A*), start **T-10** (data collection) | Real route renders on map by end of week |
| **2–3** | Core algorithms + UI | **T-07** (hazard-aware routing + safety score), **T-08** (A* core), **T-09** (recalc client), **T-10/11/12** (ETA), **T-13/14/15** (panel, line, deep link), **T-18/19** (tests), **T-20** (README) | §7 unit tests pass per module |
| **4** | Integration swap 1: real EKF | **T-16** (real `verified_location` origin) | Routes start at rider position |
| **5** | Integration swap 2: real hazard clusters | **T-17** (real `hazard_cluster` + HLC; **marquee reroute <1 s**); optional **Option B** upgrade | Hazard-weighted routing live |
| **6** | System integration + testing + polish | **T-21** (recalc/safety/ETA validation + call-frequency), **T-22** (UI polish + theme review) | End-to-end demo works once |
| **7** | Bug fixes, freeze, rehearsal | **T-22** (freeze 2 days before; demo rehearsal of reroute beat ~3 s) | Final build frozen; demo ready |

---

## 7. MVP vs Stretch (explicit)

**Mandatory MVP (must ship for demo):**
- T-01..T-05, T-06 (Option A), T-07 (Option A post-processing + `hazard_penalty.js` + `safety_score`), T-08 (A* core + tests), T-09 (recalc client + debounce), T-10/11/12 (ETA with heuristic fallback), T-13/14/15 (panel, line, deep link), T-16 (real origin), T-17 (real hazards + HLC + marquee reroute), T-18/19/20 (tests + demo() + README), T-21/22 (W6 validation, W7 freeze + rehearsal).

**Stretch / YAGNI (MD §11 + register):**
- Option B true A* on a real OSM graph (upgrade in W5–6) — T-06/T-07/T-08 keep the interface ready.
- Python sidecar LightGBM inference replacing the heuristic fallback (D-05).
- Persist `route_response` to Firestore `routes/{route_id}` (D-15).
- Multiple alternative routes display (YAGNI — show one safety-weighted best).
- On-device ONNX inference (YAGNI — server REST is the decision).
- Contraction hierarchies (YAGNI unless profiling shows >1 s).
- Real-time traffic integration (YAGNI; time-of-day patterns captured by the ETA model).
- In-app turn-by-turn nav (YAGNI — hand off to Google Maps via deep link).
- Custom map styling (YAGNI — default styles).
- Real-ride retraining / FedProx coordination with D (W5+ only if agreed).

---

## 8. Final Definition of Done

Person 3's module is **fully implemented and demo-ready** when all of the following hold:

1. **Contracts:** `route_request` / `route_response` match the frozen `contracts/route_contract.json` (§6.4) exactly; `POST /route` responses are schema-validated in CI.
2. **Routing:** given `group_id`, `origin` (= live `verified_location` when available), `destination`, and `avoid_hazard_types`, the server returns a real road-following `route_response` with `path_points`, `distance_km`, `safety_score ∈ [0,1]`, `eta_minutes`, and `recalculated_at_hlc` (real HLC by Week 5).
3. **Hazard-aware (marquee):** a real `hazard_cluster` appearing near the route triggers an automatic recalculation that completes server-side in **<1 s**; the route line visibly bends around the hazard and the Route/ETA panel updates with no user action.
4. **Safety score:** computed by the documented formula; the green/yellow/red bar reflects actual hazard exposure.
5. **ETA:** produced by the LightGBM model (Python sidecar) or a documented heuristic fallback; positive and proportional to distance; updates live.
6. **UI:** Group List / Create / Join Ride works end-to-end; Route/ETA bottom sheet has collapsed + expanded states, auto-update, and the "Avoid hazards" toggle; route line re-draws on `recalculated_at_hlc`; "Open in Google Maps" launches turn-by-turn nav via intent URL.
7. **Design system:** `theme.ts` fully specifies palette/font/icon-set/hazard colors/rider colors/safety thresholds; C's own UI uses only theme tokens; C reviewed B/D overlays for consistency.
8. **Tests:** all §7 tests pass in CI — `astar_optimal`, `astar_heuristic_admissible`, `hazard_penalty_applied`, `reroute_on_hazard`, `recalc_latency_under_1s`, `eta_model_sanity`, `safety_score_range`, `route_response_contract`, `eta_panel_updates`, `google_maps_deeplink`, `group_list_create_join`; `demo()` self-check runs standalone.
9. **Docs:** `modules/routing-eta/README.md` documents road graph source, A* heuristic, penalty function, safety-score formula, ETA features/training source/inference location, recalculation trigger + debounce + call frequency.
10. **Week 7:** final build frozen 2 days before submission; the demo beat (hazard appears → route bends → ETA updates, ~3 s) rehearsed and reliable.

**Sequencing rule for OpenCode hand-off:** implement tasks in ID order within a phase; never start T-06/T-07/T-12 without their dependencies; keep T-18/19/20 running alongside W2–3 core work rather than leaving tests to the end.