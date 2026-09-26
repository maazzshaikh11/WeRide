# PHASE 3 — Person C (Routing + ETA) — Implementation Log

**Date:** 2026-09-26 · **Status: PASS**

Verified against source at the user's commit `3570fde` (several plan findings were already
fixed there: C-P0-4 route line, C-P0-6 MOCK_DESTINATION, C-P1-10 env URL). All remaining
findings confirmed before fixing.

## What was wrong (confirmed)

| ID | Finding | Disposition |
|----|---------|-------------|
| C-P0-1 | `handleRoute` returned a straight-line mock with TODOs | **Fixed** — real pipeline (Option A) |
| C-P0-2 | No Directions API; token was imagined | **Fixed** — `MAPBOX_ACCESS_TOKEN` env, documented manual setup; no token invented |
| C-P0-3 | **Unit mismatch:** `addEdge` stored km, heuristic used meters → A* optimality void | **Fixed** — weights are meters everywhere |
| C-P0-5 | Client never sent `active_hazards`; server accepted and ignored them | **Fixed** — full loop wired |
| C-P1-7 | ETA sidecar had no deploy config | **Fixed** — env URL, Dockerfiles, compose |
| C-P1-8 | Penalty functions mutate the graph in place | **Documented** + `cloneGraph()` provided |
| C-P1-9 | `applyHazardPenalties`/`routeSafetyScore` duplicated in `astar.js`; `haversineMeters` ×3 | **Fixed** — canonicals + `geo.js` |
| C-P0-4/6, C-P1-10 | — | Already fixed in user's commit; re-verified |

## Changes

**Server (`modules/routing-eta/server/`)**
- `geo.js` (new): single `haversineMeters` + `densifySegment` (interpolates straight
  segments so hazard scoring sees the whole segment, not just endpoints).
- `road_graph.js`: `addEdge` weight now **meters** (was km/1000); `pathDistance` returns
  meters; new `cloneGraph()` (deep copy for clone-before-penalize).
- `astar.js`: removed duplicated penalty/safety implementations → re-exports canonicals
  from `hazard_penalty.js`/`safety_score.js`; `handleRoute` rewritten as the Option A
  pipeline: validate → filter `active_hazards` by `avoid_hazard_types` → Mapbox base route
  (`alternatives=true`) → hazard post-processing (pick candidate with fewest conflicts,
  tie → shortest) → safety from real exposure along geometry → ETA with real features
  (turn count from Mapbox steps, hazard count, hour/weekday, 40 km/h fallback) →
  contract-shaped response. No-token/Mapbox-down degraded mode: straight line + real
  hazard scoring + clear server-side warning (keeps the endpoint's straight-line test passing).
- `mapbox_directions.js` (new): Directions API client, 8s timeout, lng/lat→lat/lng
  conversion, turn counting from steps. Returns `null` when no token is set.
- `safety_score.js`: new `calculateSafetyScoreForPoints` + `countHazardsNearPoints`
  (coordinate-based scoring for Mapbox geometry).
- `eta_model.js`: sidecar URL via `ETA_SIDECAR_URL` env (default `http://127.0.0.1:5000`).
- `training/sidecar.py`: `PORT` + `MODEL_PATH` env-configurable; compiles clean.
- New: `training/requirements.txt`, `training/Dockerfile`, `server/Dockerfile`,
  `docker-compose.yml` (sidecar + Node, healthcheck, `MAPBOX_ACCESS_TOKEN` passthrough).
  Prod path: sidecar image → Cloud Run/container host, Node pointed at it via
  `ETA_SIDECAR_URL`; heuristic fallback keeps `/route` working if the sidecar is down.

**Client**
- `app/src/models/routeResponse.ts`: optional `active_hazards` on `RouteRequest`
  (omitted from payload when empty — contract unchanged when unused).
- `modules/routing-eta/src/client/routingClient.ts`: threaded through
  `requestRoute`/`scheduleRecalculation`/`scheduleOriginRecalcIfMoved`; bare default
  aligned to the app convention `http://10.0.2.2:3000`.
- `app/.../RouteOverlay.tsx`: all three route-request call sites now send the live
  active clusters (already `status == 'active'` filtered upstream).

## Tests

Deliberate test changes (documented, not weakened):
- `test/phase3.test.js`: `path distance` assertion rewritten in meters (`2000–5000 m`
  for the 2-step grid path; old `< 5` km encoded the bug); admissibility test rewritten
  with real units — meter-weight grid, Dijkstra as the **independent oracle** (comparing
  A* against its own cost would be circular), plus a new A* optimality assertion.
- `test/route_endpoint.test.js`: +3 tests — avoided hazard lowers safety, non-avoided
  hazard doesn't, malformed `active_hazards` entries tolerated.
- `test/routingClient.test.ts`: +2 tests — `active_hazards` sent when provided,
  omitted when not.

## Verification (2026-09-26)

| Suite | Result |
|-------|--------|
| Server (`node --test`, 6 files) | **56/56** |
| routing-eta module (jest) | **34/34** (was 32) |
| routing-eta lint / typecheck | 0 errors / clean |
| App jest | **136/136** |
| App lint / typecheck | 0 errors (55 warnings, pre-existing) / clean |
| `demo.js` smoke | still runs, contract validation 6/6 |
| `sidecar.py` | `py_compile` clean; compose YAML valid |

## Known limitations

- **Mapbox token is manual setup** (`docs/SETUP_CREDENTIALS.md` still to be written —
  carried over). Without it, routing is straight-line degraded (honest, scored, warned).
- **No road-graph data on the server** — the A*/penalty modules remain the unit-tested
  algorithmic core used for hazard-weighting logic; they don't serve live routes (Option B
  was the rejected alternative, per plan).
- `demo.js` prints its own hand-built graph's km convention — untouched, reference only.
- Endpoint degraded-mode warning is server-log only (contract frozen — no new fields).
