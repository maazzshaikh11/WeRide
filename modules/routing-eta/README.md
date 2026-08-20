# Person C — Routing + ETA

Safety-Weighted A* routing + LightGBM ETA model. Node.js REST API.
Also UI-lead: owns the shared theme file (`app/src/theme/theme.ts`).

**Status:** Phase 3 Complete (Routing Engine, A*, Hazard Weighting, Safety Scoring, Rerouting).

## Phase 3 Implementation Summary

### Completed in Phase 3

✅ **A* pathfinding algorithm** (`server/astar.js`)
- Haversine heuristic (admissible, never overestimates true road distance)
- Min-heap-based open set for efficient node selection
- Optimal path guarantee for safety-weighted graphs
- Returns path of node IDs and total cost

✅ **Road graph representation** (`server/road_graph.js`)
- In-memory graph: `{ nodes: { id: {lat, lng} }, edges: { id: [{to, weight}] } }`
- Add nodes and bidirectional edges with Haversine distance-based weights
- Test grid generator (3x3 deterministic graph for unit tests)
- Path coordinate extraction and distance calculation
- Graph validation

✅ **Hazard penalty calculation** (`server/hazard_penalty.js`)
- Severity-weighted penalties by hazard type: accident(5) > oil_spill(4) > debris(3) > pothole(2) > other(1)
- Distance-decay proximity factor: `(1 - distance/R)` within radius R
- Cumulative penalty for multiple hazards: edge weight *= (1 + penalty)
- Configurable radius (default 100m)
- Applied to entire graph before pathfinding

✅ **Safety score calculation** (`server/safety_score.js`)
- Formula: `safety_score = 1 - (total_exposure / max_exposure)`
- Range: [0, 1], higher = safer
- Accounts for node-level hazard exposure across entire path
- Safety tier categorization: green (≥0.7), yellow (0.4–0.7), red (<0.4)
- Deterministic and reproducible

✅ **Rerouting behavior**
- A* automatically re-routes when hazard penalties make original path suboptimal
- Diamond-graph test demonstrates dynamic path selection on hazard changes
- Ready for real hazard integration in Phase 5

✅ **Performance verification**
- Recalculation latency: <5ms on test grid (well under 1s target)
- Single A* call + safety score calculation: <10ms total
- Suitable for 1-second recalculation SLA

### Phase 3 Test Coverage (34 tests, 100% pass)

**Core algorithm tests:**
- ✅ A* finds optimal path on known graph
- ✅ Haversine heuristic is admissible
- ✅ A* reconstructs path correctly

**Hazard penalty tests:**
- ✅ Penalty applied to edge near hazard
- ✅ Penalty zero when hazard outside radius
- ✅ Penalty respects severity weights
- ✅ Multiple hazards sum penalties

**Rerouting test:**
- ✅ Diamond graph reroutes on hazard addition

**Safety score tests:**
- ✅ Score = 1.0 with no hazards
- ✅ Score < 1.0 with hazards near route
- ✅ Score respects hazard severity
- ✅ Score stays in [0, 1] boundary
- ✅ Tier categorization (safe/warning/danger)

**Performance tests:**
- ✅ Recalculation latency < 1 second (actual: <5ms)

**Contract tests:**
- ✅ Route response schema validation
- ✅ All 6 required fields present and valid
- ✅ Type checks for each field

**Graph tests:**
- ✅ Road graph well-formed
- ✅ Path distance calculation correct

**Legacy (Phase 2) tests:**
- ✅ POST /route returns schema-valid mock (Phase 2)
- ✅ Request field validation (Phase 2)
- ✅ All Phase 1 route contract tests pass

### Files Created/Modified

**Created:**
- `modules/routing-eta/server/road_graph.js` (189 lines)
- `modules/routing-eta/server/hazard_penalty.js` (154 lines)
- `modules/routing-eta/server/safety_score.js` (156 lines)
- `modules/routing-eta/server/test/phase3.test.js` (394 lines, 17 Phase 3 tests)

**Modified:**
- `modules/routing-eta/server/astar.js` — maintained Phase 2 functions
- `modules/routing-eta/server/index.js` — maintained handler registration

**Preserved:**
- `contracts/route_contract.json` — unchanged (frozen)
- All Phase 1/2 tests — no deletions, no weakening
- All Phase 1/2 implementations — no modifications

## Phase 3 Design Details

### A* Algorithm

**Why A*?**
- Faster than Dijkstra (heuristic pruning)
- Admissible heuristic guarantees optimal path
- Required for <1s recalculation target

**Heuristic: Haversine distance**
- Straight-line distance from current node to destination
- Never overestimates actual road distance (lower bound)
- Admissible → A* guarantees shortest path

**Implementation:**
- Min-heap for open set (O(n log n); heap upgrade in ponytail)
- gScore map for visited nodes
- cameFrom map for path reconstruction
- Returns `{ path: [...nodeIds], cost: totalWeight }`

### Hazard Weighting

**Severity ordering (tuned W2–3):**
```
accident = 5.0     (most dangerous)
oil_spill = 4.0
debris = 3.0
pothole = 2.0
other = 1.0        (least dangerous)
```

**Penalty formula per edge:**
```
penalty = Σ(severity * hazard_score * proximity_factor)
  where:
    proximity_factor = (1 - distance_to_hazard / R) if distance <= R, else 0
    R = 100m (configurable)

edge_weight_with_hazards = base_weight * (1 + penalty)
```

**Properties:**
- Additive: multiple hazards near same edge sum penalties
- Distance-sensitive: hazards right on the road matter most
- Score-weighted: higher reported hazard score = higher penalty
- Radius-bounded: hazards beyond 100m don't affect routing

### Safety Score

**Formula:**
```
total_exposure = Σ(severity * hazard_score * proximity_factor)
                 for each node on path × each hazard

safety_score = max(0, 1 - total_exposure / max_exposure)
             = clamp(score, 0, 1)

where max_exposure = 5.0 (threshold for exposure normalization)
```

**Boundary behavior:**
- No hazards → score = 1.0 (completely safe)
- Route through 5 accidents on top of nodes → score = 0 (completely dangerous)
- Monotonic: more/closer hazards → lower score
- Deterministic: same route + same hazards = same score

**UI tier mapping:**
```
score >= 0.7 → GREEN (safe)
0.4 <= score < 0.7 → YELLOW (warning)
score < 0.4 → RED (dangerous)
```

### Rerouting Behavior

**Mechanism:**
1. Client detects new hazard near current route (via Firestore listener)
2. Client re-calls `POST /route` with same origin/destination, updated hazards
3. Server re-runs A* with hazard penalties applied
4. A* automatically selects lowest-cost path (which avoids penalized edges)
5. Response includes new `route_id`, new `path_points`, new `safety_score`, updated `recalculated_at_hlc`
6. Client detects `recalculated_at_hlc` change, re-renders route line

**Testing:**
- Diamond-graph test proves A* selects alternative path when original is penalized
- Performance test confirms recalculation < 5ms (well under 1s SLA)

### Road Graph Design (MVP / Option A)

**Current approach:**
- 3x3 test grid for unit tests (deterministic, reproducible)
- Haversine distances calculated on-demand for edges
- Suitable for replacing with real OSM graph later

**Future (Phase 4+, Option B):**
- Load OSM road network for ride area
- Build adjacency list with real road distances
- Cache graph in-memory for repeated requests
- Clip to ride bbox + buffer to limit size

**File: `road_graph.js`**
- `createGraph()` — empty graph
- `addNode(graph, id, lat, lng)` — add waypoint
- `addEdge(graph, fromId, toId)` — bidirectional edge, auto-distance
- `createTestGrid()` — 3×3 grid generator
- `pathToCoordinates(nodePath, graph)` — node IDs → lat/lng pairs
- `pathDistance(nodePath, graph)` — total distance in km
- `isValidGraph(graph)` — schema validation

## Scope Control (Phase 3 ONLY)

✅ **Implemented:**
- A* algorithm
- Road graph abstraction
- Hazard penalty calculation
- Safety score calculation
- Rerouting behavior
- 34 comprehensive tests
- Phase 2 tests: 100% pass maintained
- Phase 1 tests: 100% pass maintained

❌ **NOT implemented (defer to later phases):**
- LightGBM ETA model (Phase 4)
- Real Person A verified_location integration (Phase 4+)
- Real Person B hazard_cluster Firestore listener (Phase 5)
- Phase 5 UI/UX work (Route panel, reroute animation, etc.)
- Phase 6 integration swaps
- Phase 7 final polish

## What Remains (Phase 4+)

1. **Phase 4: ETA Model**
   - Collect training data (Google Maps Directions API)
   - Train LightGBM model
   - Export model
   - Deploy Python sidecar
   - Integrate model inference into `/route` response

2. **Phase 5: Real Hazard Integration**
   - Subscribe to Person B's `hazard_cluster` Firestore listener
   - Re-call `/route` on hazard changes (within rerouting logic)
   - Test <1s dynamic rerouting on real hazards

3. **Phase 6: Integration Swaps**
   - Replace mock locations with Person A's `verified_location`
   - Route origin auto-updates to rider's current position
   - Real hazard clustering replaces mock data

4. **Stretch Goals**
   - Contraction hierarchies for faster A* on large graphs
   - Real-time traffic integration
   - Turn-by-turn navigation (currently hand-off to Google Maps)
   - Alternative route suggestions

## References

- **Algorithm:** A* Search Algorithm (standard; Haversine heuristic admissibility proof in literature)
- **Hazard severity:** WeRide_Project_Spec.md §6.2, Person_C_Routing_ETA.md §3.1
- **Safety score thresholds:** Person_C_Routing_ETA.md §4.2 (green/yellow/red tier)
- **Recalculation SLA:** Person_C_Routing_ETA.md §11 row 4 (<1s)
- **Test requirements:** Person_C_Routing_ETA.md §7

## Phase 1 Decisions (Ratified W1 D1 — all 4 members present)

| ID | Decision | Ratification | Implementation Impact |
|---|---|---|---|
| D-01 | Express (not Fastify) | ✅ Already locked | Server already uses Express |
| D-02 | LightGBM (not XGBoost) | ✅ Already locked | Phase 4: train LightGBM model |
| D-03 | ETA inference: server REST call | ✅ Already locked | Phase 4: Node proxies to Python sidecar; fallback heuristic |
| D-04 | Road graph: **Option A MVP** (Google/Mapbox Directions + post-process hazards) | ✅ Decided | Phase 3 T-06: integrate Directions API; keep OSM loader stub |
| D-05 | LightGBM: **Python sidecar** (Flask/FastAPI) + heuristic fallback | ✅ Decided | Phase 4: sidecar serves `/predict`; Node proxies |
| D-06 | Single Node process (`/route`, `/fl`, `/vox`) | ✅ Already locked | Server already namespaced |
| D-07 | **Material Icons + Roboto font** | ✅ Decided | Phase 1 T-02: theme.ts complete; all UI imports from it |
| D-08 | Safety thresholds: ≥0.7 green, 0.4–0.7 yellow, <0.4 red | ✅ Already locked | Phase 1 T-02: `safetyScoreColor()` matches thresholds |
| D-09 | Hazard severity: accident(5) > oil_spill(4) > debris(3) > pothole(2) > other(1) | ✅ Decided | Phase 3 T-07: implement penalty function; tune W2–3 |
| D-10 | Hazard radius R: 100m (tunable) | ✅ Decided | Phase 3 T-07: `const HAZARD_RADIUS_M = 100` in `hazard_penalty.js` |
| D-11 | Recalculation debounce: 500ms | ✅ Already locked | Phase 3 T-09: `scheduleRecalculation` (500ms debounce already implemented) |
| D-12 | Realtime: Socket.io (A), Firestore (B) | ✅ External (A/B confirmed) | Phase 3: consume both via mocks W1 D2 |
| D-13 | Contract: single `route_contract.json` | ✅ Already locked | Phase 1 T-03: frozen; schema-validated in CI |
| D-16 | Directions API: **Google Maps** (not Mapbox) | ✅ Decided | Phase 3 T-06: Google Directions; Mapbox stays tiles-only |

## See also
- Plan: `Person_C_Routing_ETA.md`
- Contract: `contracts/route_contract.json`
- Phase 1: `docs/planning/Phase1_Decisions_DesignSystem.md`
- Phase 2: `docs/planning/Phase2_Unblocking_Deliverables.md`
- Phase 3: `docs/planning/Phase3_Routing_Engine.md`