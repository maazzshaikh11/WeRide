# WeRide — Person 3 · Phase 3: Routing Engine (Week 1 Day 3 – Week 3)

**Module:** `/modules/routing-eta` · **Source of truth:** `docs/Development/Person_C_Routing_ETA.md` (MD §3.1), spec §11 row 4.
**Master roadmap:** `docs/planning/person3_plan.md`.

> **When:** Week 1 Day 3 through Week 3. **Marquee metric:** recalculation completes in <1 s (MD §3.1, §11 row 4).
> **Scope:** real route from origin to destination, hazard-aware rerouting, safety score, client-side dynamic recalculation. This is the core algorithm phase.

---

## Phase Objective

Build the safety-weighted routing engine: a road-following route from origin to destination (Option A default: Directions API + hazard post-processing; Option B stretch: true A* on an OSM graph), hazard-aware avoidance using Person B's `hazard_cluster`s, a documented `safety_score`, and a client that automatically re-requests the route when hazards change (500 ms debounce).

## Prerequisites

- **Phase 1 complete** (decisions, theme, contracts) and **Phase 2 complete** (mock server T-04 — the `/route` endpoint and schema are the base).
- Mapbox or Google Maps API key for the base route (T-06).
- Person B `hazard_cluster` **mock** stream (W1 D2) — real clusters arrive in Phase 6.
- Person B HLC mock for `recalculated_at_hlc`.

## Tasks in this phase

| Task | Name | Priority |
|---|---|---|
| T-06 | Road Graph Provider (`road_graph.js`) | MVP (Option A) / STRETCH (Option B) |
| T-07 | Hazard-Aware Routing + Safety Score | MVP |
| T-08 | Complete & Verify A* Core (`astar.js`) | MVP |
| T-09 | Dynamic Recalculation Client | MVP |

---

## T-06 — Road Graph Provider (`road_graph.js`)  [MVP: Option A]

**Objective.** Implement the road-graph source per the Phase-1 decision. **MVP default (Option A):** integrate a Directions API (Google Maps or Mapbox) to get the base route polyline + turn steps + distance — no custom graph needed. **Stretch (Option B, Weeks 5–6):** load an OSM road graph for the ride bbox + 5 km buffer, build `{ nodes, edges }` adjacency list, cache per group in memory. `road_graph.js` exposes one interface so T-07/T-08 don't change when the source does (MD §3.1).

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

## T-07 — Hazard-Aware Routing + Safety Score  [MVP]

**Objective.** Implement the safety weighting: an edge/segment near an active `hazard_cluster` costs more, routes actively avoid hazards, and the route carries a `safety_score ∈ [0,1]`. This is the core of the module (MD §3.1) and wires `hazard_cluster` (Person B) into routing.

**Subtasks.**
1. Create `server/hazard_penalty.js` (required by MD §8): `penalty(edge, hazard) = severity(hazard_type) * hazard_score * (1 - distance/R)` for `distance ≤ R` (R = 100 m default, tune), with severity defaults accident > oil_spill > debris > pothole > other (scaffold values 5/4/3/2/1). Extract this logic out of `astar.js` so the formula lives in one place.
2. **Option A post-processing:** given the base route from T-06 + active hazards (filtered by `group_id`, `status='active'`, and `avoid_hazard_types`), detect route segments within R of a hazard; if any, re-request the route with an avoidance waypoint (offset perpendicular to the hazard) or request `alternatives=true` and pick the candidate minimizing total penalty; if all candidates still intersect, return the best-effort route and let `safety_score` reflect it.
3. **Option B (stretch):** `applyHazardPenalties(graph, hazards, R, severityWeights)` sets `weight = base_cost * (1 + penalty)` per edge; A* (T-08) finds the optimal weighted path.
4. Wire `safety_score.js`: `computeSafetyScore(path, hazards, R)` per the documented formula; ensure `safety_score = 1` on a hazard-free route and degrades on 3 accidents.
5. Extend `handleRoute` orchestration: fetch/filter hazards (mock stream for now, real listener in T-17), run the chosen path, compute `distance_km`, `safety_score`, call ETA (Phase 4 T-12), assemble the §6.4 `route_response` with `recalculated_at_hlc`.
6. Document the final penalty + safety_score formulas in `modules/routing-eta/README.md` (also Phase 7 T-20; do it here so it stays fresh).

**Files.** `modules/routing-eta/server/hazard_penalty.js` (new), `server/astar.js` (refactor penalty out; orchestration), `server/safety_score.js`, `server/test/hazard_penalty.test.js` (new), `server/test/reroute.test.js` (new), `README.md`.

**Dependencies.** T-06 (base route), T-04 (server), Person B `hazard_cluster` mock (W1 D2), T-08 (Option B path), T-12 (ETA call — can stub `eta_minutes` until then).

**Expected output.** `POST /route` returns a hazard-aware path: route bends away from a staged hazard, `safety_score` drops when a hazard is near.

**Definition of Done.** `hazard_penalty_applied`, `safety_score_range`, and `reroute_on_hazard` tests pass; severity weights + R tunable via constants; formulas written in README.

**Tests.**
- `hazard_penalty_applied`: same edge with a hazard within R weighs more than without.
- `safety_score_range`: score ∈ [0,1]; hazard-free route > route through 3 accidents.
- `reroute_on_hazard`: stub Directions client returns a base route through a staged hazard → handler returns an avoiding route (assert path no longer within R of the hazard).

---

## T-08 — Complete & Verify A* Core (`astar.js`)  [MVP]

**Objective.** A* is chosen over Dijkstra for the <1 s recalc requirement (§11 row 4 / MD §3.1). Keep A* pure and testable; fix the known shortcuts; prove optimality and admissibility; prove the latency budget. This is what the report claims, so it must be verifiable even under the Option-A MVP (the algorithm is the safety-search engine and the Option-B upgrade path).

**Subtasks.**
1. Replace the O(n log n) sort-based `MinHeap` with a proper binary heap (ponytail in `astar.js`).
2. Verify the heuristic is Haversine straight-line to destination (admissible → never overestimates → optimal path guaranteed). Add the required admissibility test.
3. Add `clipGraphToBbox(graph, bbox, bufferKm)` and a per-`group_id` in-memory graph cache hook (mitigate the "graph too large → slow A*" risk, MD §9).
4. Keep the `astar(graph, start, goal) → { path, cost }` signature unchanged; ensure it works with weighted edges produced by T-07.
5. Add the `demo()` self-check entry (see Phase 7 T-19): A* on a tiny grid graph with one hazard prints the avoiding path — eyeballable without a server.

**Files.** `modules/routing-eta/server/astar.js`, `server/road_graph.js` (clip/cache hooks), `server/test/astar.test.js` (extend), `server/demo.js` (new, Phase 7 T-19).

**Dependencies.** T-06 (Option B graph for latency test — or a generated grid graph fixture), T-07 (weighted edges).

**Expected output.** A* that returns the minimum-weight path with an admissible heuristic, on a realistic-size graph, well under 1 s.

**Definition of Done.** `astar_optimal`, `astar_heuristic_admissible`, `recalc_latency_under_1s` all pass; heap is a real binary heap; graph clip/cache helpers exist.

**Tests.**
- `astar_optimal`: shortest-weight path on a known small graph (exists; keep).
- `astar_heuristic_admissible`: for random points, `h(node) ≤ true distance` to goal.
- `recalc_latency_under_1s`: generated grid graph (~10k nodes) + 1 hazard; time `astar` + penalties; assert < 1000 ms.

---

## T-09 — Dynamic Recalculation Client (hazard listener + debounce + route state)  [MVP]

**Objective.** The mobile client subscribes to `hazard_cluster` changes (Firestore listener from B); when a new/updated cluster is within R of the current route, it calls `POST /route` again with updated `avoid_hazard_types`. Batch bursts with the 500 ms debounce (`# ponytail: 500ms debounce, tune if UX feels laggy`) to avoid a recalculation storm. Expose the latest `route_response` to UI via a module-local store (per AGENTS convention — per-module state lives in `modules/*/src`, not the root `appStore`).

**Subtasks.**
1. Add `modules/routing-eta/src/client/routeStore.ts` (Zustand): holds `route: RouteResponse | null`, `loading`, `avoidHazards`; actions `setRoute`, `setAvoidHazards`.
2. Add `modules/routing-eta/src/client/hazardListener.ts`: subscribes to `hazards/{cluster_id}` for the group, filters `status='active'` + `group_id`, checks proximity to the current route's `path_points` within R; on any relevant change calls `routingClient.scheduleRecalculation(...)`.
3. Wire `RoutingClient` to write responses into the store (and keep the debounce in `scheduleRecalculation`).
4. Re-export the new client pieces from `src/index.ts`.
5. On a fresh `route_response`, bump `recalculated_at_hlc`-driven re-render (consumed by Phase 5 T-13/T-14).

**Files.** `modules/routing-eta/src/client/routeStore.ts` (new), `src/client/hazardListener.ts` (new), `src/client/routingClient.ts` (modify), `src/index.ts` (modify), `modules/routing-eta/test/routingClient.test.ts` (extend).

**Dependencies.** T-07 (server reroute), T-04 (server reachable), Person B `hazard_cluster` mock stream, T-06 (R/proximity constants from hazard_penalty).

**Expected output.** When a mock hazard appears near the route, exactly one debounced `/route` call fires and the store's route updates.

**Definition of Done.** Multiple hazard events within 500 ms → 1 request (existing debounce test keeps passing); a hazard near the route triggers a scheduled recalculation (new test); store exposes the new route for the UI.

**Tests.** Extend `routingClient.test.ts`: `hazard_near_route_triggers_recalc` (mock Firestore hazard event → assert `scheduleRecalculation` called); `debounce` test unchanged.

---

## Phase Dependencies / Critical Path

```
Phase 1 (decisions/theme/contracts) + Phase 2 (T-04 mock server) ──► this phase
API key ──► T-06 ──► T-07 ──► T-09 ──► Phase 5 (panel/line)
                  └──► T-08 (A* core; Option B uses T-07 weighted edges)
Person B hazard_cluster mock (W1D2) ──► T-07, T-09
Phase 4 T-12 (ETA) ──► T-07 (eta_minutes in /route)  [can stub until then]
```

## Phase Definition of Done

1. `POST /route` returns a real, road-following, hazard-aware `route_response` (path, distance, safety_score, recalculated_at_hlc; eta via stub until Phase 4).
2. A staged `hazard_cluster` near the route causes the route to bend away (mock stream).
3. Client auto-triggers recalculation with 500 ms debounce; store exposes the latest route.
4. A* optimality/admissibility/latency tests pass; severity weights + R documented.

## Tests required (this phase)

- `road_graph_parse`, `road_graph_no_key_fallback`
- `hazard_penalty_applied`, `safety_score_range`, `reroute_on_hazard`
- `astar_optimal`, `astar_heuristic_admissible`, `recalc_latency_under_1s`
- `hazard_near_route_triggers_recalc`, existing `debounce`

## Hand-off note for the AI agent

Work in `C:\Users\piyus\WeRide`. Server is ESM + `node --test`; client is ts-jest. Per package: `npm install` then `npm run lint && npm run typecheck && npm test`. Preserve MD terminology and the frozen contract. Options: default to **Option A** (Directions API + post-process avoidance); keep the Option B loader behind the same interface. `# ponytail:` comments mark tunable/stretch items — don't gold-plate.