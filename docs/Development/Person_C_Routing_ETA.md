# Person C — Safe Route Recommendation + ETA (Safety-Weighted A*, LightGBM/XGBoost)

**Objective 3:** Safety-aware routing with ETA, where the route actively avoids active hazards and recalculates when the hazard landscape changes.

**Module folder:** `/modules/routing-eta`
**UI screens owned:** Route/ETA Panel (bottom sheet on map), Group List / Join / Create Ride screen. You are also the **default UI-lead** — you own the shared theme file.

**Backend:** Node.js REST API (A* + LightGBM/XGBoost) — the only module with a server-side component beyond Firebase.

---

## 1. Your Objective (End-to-End)

You own the routing engine and ETA model: given an origin, destination, and the current set of active `hazard_cluster`s, compute a route that minimizes a **safety-weighted cost** (not just distance/time). The route recalculates automatically when new hazards appear near it, and the ETA updates live in the UI.

You also own the **Group List / Join / Create Ride** screen (the entry point for the whole app) and the **shared design system** (theme file) that all 4 people import.

**What "done" looks like (demo, Week 7):**
> A route is displayed on the map. A hazard appears near the route mid-ride → the route visibly reroutes around it within 1 second, the ETA panel updates automatically. The safety score bar (green/yellow/red) reflects the new route's safety. "Open in Google Maps" deep-links to turn-by-turn navigation.

---

## 2. Data Contract You Publish (Frozen — §6.4)

You are the **sole producer** of `route_response` and the sole consumer of `route_request`. Frozen shape:

### 2.1 `route_request` (POST /route request body)
```json
{
  "group_id": "string",
  "origin": {"lat": "float", "lng": "float"},
  "destination": {"lat": "float", "lng": "float"},
  "avoid_hazard_types": ["string"]
}
```

### 2.2 `route_response` (POST /route response body)
```json
{
  "route_id": "string",
  "path_points": [["lat", "lng"]],
  "distance_km": "float",
  "eta_minutes": "float",
  "safety_score": "float",
  "recalculated_at_hlc": "string"
}
```

Transport: **Node.js REST API** (`POST /route`). The mobile client calls this and renders the result. The `recalculated_at_hlc` field lets the UI know when a route was last recomputed (uses B's HLC).

**Server runs at:** Node.js (Express or Fastify — pick one Day 1). Hosted alongside the FL aggregation server and WebRTC signaling (shared Node process or separate — decide Day 1). For a student project, a single Node process with namespaced routers (`/route`, `/fl`, `/vox`) is simplest. `# ponytail: single Node process, separate services if load demands`

---

## 3. Algorithms

### 3.1 Safety-Weighted A* (routing)

**Why A* (not Dijkstra):** A* with an admissible heuristic (straight-line distance to destination) prunes the search space — faster, and you need speed for the <1s recalculation requirement (§11 row 4). Dijkstra explores uniformly = too slow on a real road graph.

**Graph construction:**
- **Road graph source:** Mapbox Directions API OR OpenStreetMap (OSM) data. Decision Day 1. Recommendation: use Mapbox's tile/routing data since the spec already picks Mapbox for offline tiles. If you want full control over the graph (to inject hazard weights), you need the raw graph — Mapbox's Routing API doesn't let you set custom edge weights. Options:
  - **Option A (simplest, recommended for MVP):** Use Mapbox/Google Directions API to get the base route, then **post-process**: check if the route passes near any active hazard; if yes, request an alternative route avoiding that area. This is "reroute around hazards" not true safety-weighted A*. It's pragmatic and ships fast.
  - **Option B (true A*, more work):** Load an OSM road graph for the ride region into memory (via `osmnx` or a GeoJSON extract), build an adjacency list with edge weights = distance × (1 + hazard_penalty near active hazards), run A*. This is the "correct" implementation per the spec's objective name.
  - **Decide Day 1** which you're doing. Option A is faster to ship; Option B is what the report likely wants to claim. `# ponytail: start Option A, upgrade to B if time permits in Weeks 5-6`

**Safety weighting (for Option B, or for hazard_penalty in Option A):**
- Each active `hazard_cluster` (from B) within a radius `R` (e.g., 100m) of an edge adds a penalty to that edge's cost: `weight = base_cost * (1 + penalty)`, where `penalty = f(hazard_type, hazard_score, distance_to_hazard)`.
- Example: an accident with `hazard_score=0.9` 20m from the road edge → large penalty. A pothole with `hazard_score=0.3` 80m away → small penalty.
- `hazard_type` severity weights (tune in Week 2–3): accident > oil_spill > debris > pothole > other.
- Document your penalty function in `modules/routing-eta/README.md`.

**A* heuristic:** straight-line (Haversine) distance to destination. Admissible (never overestimates actual road distance) → optimal path guaranteed.

**Recalculation trigger:**
- The mobile client subscribes to `hazard_cluster` changes (Firestore listener, from B).
- When a new/updated `hazard_cluster` is within `R` of the current route's path, the client calls `POST /route` again with the updated `avoid_hazard_types`.
- Target: recalculation completes in < 1s (§11 row 4). This is tight if you're running real A* on a large road graph — keep the graph small (clip to the ride bbox + buffer) and consider caching the graph in memory on the server across requests for the same group.

**`safety_score`:** a 0–1 score for the whole route. Simple formula: `safety_score = 1 - (sum of hazard penalties along route / max_possible_penalty)`. Or `1 - (number of hazards within R of route / threshold)`. Document your formula. The UI renders this as a green/yellow/red bar (§4.2).

### 3.2 ETA Model (LightGBM or XGBoost — pick one Day 1)

**Why ML for ETA (not just distance / speed):** real ETA depends on traffic, road type, turns, time of day, weather — a simple `distance / avg_speed` is inaccurate. A gradient-boosted tree model learns these nonlinear relationships from historical ride data.

**Decision Day 1 (§9):** LightGBM vs XGBoost. Pick one. Recommendation: **LightGBM** — faster training, lower memory, good enough accuracy for this use case. Don't maintain both.

**Features (input to the model):**
- `distance_km`
- `road_type_distribution` (if you have road graph metadata; otherwise skip)
- `turn_count` (number of turns in the route)
- `hour_of_day`, `day_of_week` (captures traffic patterns)
- `hazard_count_along_route`
- `avg_speed_limit` (if available from the road graph)
- `weather` (optional — skip for MVP unless data is easy to get)

**Training data:** you won't have real ride data at the start. Options:
- **Synthetic data (Week 2–3):** generate plausible ride logs (distance, speed, time-of-day → duration) with some noise. Train the model on synthetic data. This lets you ship a working ETA.
- **Google Maps Directions API ETA as ground truth:** call the Directions API for many (origin, destination, time) tuples, use its ETA as the label, your features as inputs. This bootstraps real data without needing real rides. Recommended.
- **Real ride data (later):** as the app is used, log actual ride durations to `rides/` and retrain. This is where FedProx (D) could eventually help — coordinate with D if FL on ETA data becomes a Week 5+ stretch goal.

**Inference location (§9 decision):** on-device (ONNX) vs. server REST call.
- Recommendation (per spec §9): **server REST call** for a student project — simpler, no on-device runtime to manage. The latency tradeoff (one extra round trip) is acceptable. Document this in your README.
- If you choose on-device: export the LightGBM model to ONNX, bundle it in the app, run inference with `onnxruntime`. More setup, lower latency per call.

**Where the model runs:** the Node.js backend loads the trained LightGBM model (via `lightgbm` Node binding or a Python sidecar — the `lightgbm` Python lib is more mature; you may run a small Python service or shell out). `# ponytail: Python sidecar for LightGBM inference, Node-native binding if it stabilizes`

---

## 4. UI Screens You Own

### 4.1 Group List / Join / Create Ride (P0 — the app entry point)
- List of active/past groups: Firestore query on `groups` where `member_ids` contains current user.
- "Create Group" → generates `group_id`, invite code/link. Write to `groups/{group_id}` with `created_by`, `member_ids=[user]`, `created_at`.
- "Join Group" → enter code, adds `rider_id` to `member_ids`.
- Tap group → navigate to Live Map for that `group_id`.
- This screen is the first thing users see after login. It must work early — it's how everyone tests end-to-end.

### 4.2 Route/ETA Panel (bottom sheet on the Live Map)
- Collapsed state: ETA (minutes), distance (km), safety score bar (green/yellow/red).
- Expanded state: turn list (if you have turn-by-turn data), "Open in Google Maps" deep-link button (hand-off to Google Maps for actual turn-by-turn navigation — per spec §2, Google Maps Directions API/intent URL for real nav).
- Auto-updates when `route_response` changes — no manual refresh.
- "Avoid hazards" toggle: when on, `avoid_hazard_types` includes all types; when off, routing ignores hazards (just shortest/safest by base cost).
- Registered as an overlay on A's `MapScreen` shell. Lock the interface Week 1 Day 2.

### 4.3 Route line on the map
- Drawn from `route_response.path_points`.
- Re-drawn on `recalculated_at_hlc` change.
- Coordinate with A (who owns the map base layer) on how overlays draw.

### 4.4 Shared Design System (you are UI-lead)
- **You own `theme.ts`** — the single source of colors, fonts, icon set.
- Pick one color palette + one font + one icon set (Material Icons or Lucide — not mixed) in Week 1 Day 1.
- Everyone imports the theme. No one hardcodes colors. You review all UI PRs for theme consistency.
- Define the **hazard-type color map** (coordinate with B): pothole=orange, oil_spill=black/brown, accident=red, debris=yellow, other=grey. Lock it in the theme.
- Define **rider marker colors** (coordinate with A): green=verified, red=flagged, grey=stale.
- Define **safety score bar colors**: green ≥0.7, yellow 0.4–0.7, red <0.4 (or whatever thresholds you choose — document them).

### 4.5 What you do NOT own
- Login/Signup screen (P0 but not explicitly assigned — coordinate in sync; likely shared/infra or whoever finishes first).
- Rider markers (A), hazard markers (B), VOX indicator (D).

---

## 5. Dependencies

### 5.1 You depend on
| From | What | When you need it |
|---|---|---|
| Person A | `verified_location` (origin for route requests — current rider position) | Mock by Week 1 Day 2, real by Week 4 |
| Person B | `hazard_cluster` stream (for routing weights / avoidance) | Mock by Week 1 Day 2, real by Week 5 |
| Person B | HLC (for `recalculated_at_hlc` timestamp) | Mock by Week 1 Day 2 |
| Infra | Firebase project config, Node.js server hosting | Week 1 Day 1–2 |
| Mapbox API key (or OSM data source) | For base road graph / tiles | Week 1 Day 1 (decide approach) |

### 5.2 What waits on you
| Who | What they need from you | When |
|---|---|---|
| Person A | Route line overlay interface on MapScreen (A owns base, you register route overlay) | Week 1 Day 2 (lock interface) |
| Person B | Theme file (hazard colors) | Week 1 Day 1 |
| Person D | Theme file (VOX indicator styling) | Week 1 Day 1 |
| All | `route_response` contract | Mock by Week 1 Day 2 |
| All | Theme file | Week 1 Day 1 |

**Unblocking rule (mandatory):** Ship by end of Day 2, Week 1:
1. **Mock `route_response`** server (a hardcoded route from a fixed origin to destination, with a fake ETA and safety_score). Running on the Node.js server.
2. **`theme.ts`** with the locked palette, font, icon set, hazard-type color map, rider-marker color map, safety-bar thresholds.
3. **Group List screen** stub (navigable, uses mock Firestore data or a local list).

---

## 6. Week-by-Week Plan

### Week 1
- **Day 1:** Be in the room for §9 decisions. You care about: RN stack (locked), LightGBM vs XGBoost (pick LightGBM), ETA inference location (server REST recommended), Mapbox vs OSM for road graph (decide Option A vs B from §3.1), design system palette/font/icons.
- **Day 1:** Author `theme.ts` with locked design system. **This blocks everyone's UI — ship it Day 1.**
- **Day 1–2:** Author `/contracts/route_request.json`, `/contracts/route_response.json` with all 4 reviewing.
- **Day 2:** Ship mock `route_response` server + mock route_response in the app. Ship Group List stub.
- **Day 3–7:** Start real routing: set up Node.js server (`POST /route` endpoint). If Option A, integrate Mapbox/Google Directions API. If Option B, load OSM graph, build adjacency list. Get a real route from origin to destination rendering on the map by end of week (even without hazard weights yet).

### Week 2–3 (core algorithm)
- **Routing (Option B path):** implement A* on the road graph. Add hazard_penalty to edge weights based on `hazard_cluster` proximity (consume B's mock hazard stream). Implement recalculation trigger (client listens to hazard changes, re-calls `POST /route`).
- **Routing (Option A path):** implement the post-processing reroute-around-hazards logic.
- **ETA model:** collect training data (Google Maps Directions API ETA as labels, your features as inputs — §3.2). Train LightGBM. Export the model. Load it on the server. Wire `POST /route` to call the model for ETA after A* gives the path.
- **UI:** Build the Route/ETA Panel bottom sheet (collapsed + expanded). Wire it to `route_response`. Add the "Open in Google Maps" deep link.
- Unit tests (§7): A* optimality, hazard penalty, recalculation latency, ETA model sanity, safety_score formula.
- Write `modules/routing-eta/README.md` documenting: road graph source, A* heuristic, hazard penalty function, safety_score formula, ETA model features, inference location.

### Week 4 (integration swap 1)
- Real EKF (A) replaces mock → route origin is now the real rider position. Verify routes start from where the rider actually is.

### Week 5 (integration swap 2)
- Real `hazard_cluster` (B) replaces mock → your routing now avoids real hazards. This is the critical integration week for you.
- Test dynamic rerouting (§11 row 4): new hazard published mid-route → A* recalculates within 1s, UI route line + ETA update automatically. **This is your marquee test — make sure it passes cleanly.**

### Week 6
- Full system integration testing. Your parts:
  - Dynamic rerouting (§11 row 4) — <1s recalculation.
  - Safety score correctness (bar color matches actual hazard exposure).
  - ETA accuracy (compare to real ride time on a test ride).
  - Battery/CPU profile (§11 row 7): your module is mostly server-side, so client impact is just the HTTP calls — document call frequency.
- UI polish pass: ensure the Route/ETA panel, Group List, and all your overlays match the theme you own. Review B's and D's overlays for theme consistency too (you're UI-lead).

### Week 7
- Final build frozen 2 days before submission. Demo rehearsal: your beat is the visible reroute on hazard appearance (§12 item 3). Practice the timing — the hazard must appear, then the route visibly bends away, then the ETA panel updates. All within ~3s for the demo to land.

---

## 7. Tests You Must Write (minimum)

`modules/routing-eta/test/` (server-side tests):

| Test | What it asserts |
|---|---|
| `astar_optimal` | A* returns the shortest-weight path on a known small graph. |
| `astar_heuristic_admissible` | Heuristic never overestimates true distance (optimality guarantee). |
| `hazard_penalty_applied` | An edge near an active hazard has higher weight than the same edge with no hazard. |
| `reroute_on_hazard` | Route passing near a new hazard is recomputed to avoid it. |
| `recalc_latency_under_1s` | Recalculation completes in < 1s on a realistic-size graph (time the test). |
| `eta_model_sanity` | ETA is positive, roughly proportional to distance, increases with hazard count. |
| `safety_score_range` | `safety_score` is in [0,1]; a route with no hazards scores higher than one through 3 accidents. |
| `route_response_contract` | `POST /route` returns the exact §6.4 schema. |

App-side tests:
| Test | What it asserts |
|---|---|
| `eta_panel_updates` | When `route_response` changes, the panel re-renders without manual refresh. |
| `google_maps_deeplink` | "Open in Google Maps" button launches the correct intent URL. |
| `group_list_create_join` | Create group → appears in list; join group → member added. |

Self-check: a `demo()` that runs A* on a tiny grid graph with one hazard and prints the path avoiding it, so you can eyeball without the server.

---

## 8. Files You Own

```
modules/routing-eta/
  server/
    index.js (or .ts)         # Express/Fastify app, POST /route endpoint
    astar.js                   # A* implementation (pure logic, testable)
    road_graph.js              # loads OSM/Mapbox graph, builds adjacency list
    hazard_penalty.js          # penalty function from hazard_cluster
    eta_model.js               # loads LightGBM model, runs inference
    safety_score.js            # route safety score formula
    training/
      collect_directions.py    # script to collect Google Maps ETA as training labels
      train_eta.py             # train LightGBM, export model
      eta_model.txt            # exported LightGBM model
  src/                          # client-side TS (RN)
    client/
      routingClient.ts          # calls POST /route, parses route_response, debounce
      RoutePanel.tsx            # bottom sheet UI (collapsed + expanded)
      routeLine.ts              # map overlay drawing the route (GeoJSON LineString)
    group/
      groupService.ts           # Firestore groups/ CRUD
    index.ts                    # re-exports
  README.md                     # road graph source, A* heuristic, penalty fn, safety_score, ETA model, inference location
  test/
    routingClient.test.ts       # debounce logic
contracts/
  route_contract.json           # request + response (single file)
```

Shared (you own as UI-lead):
```
app/src/theme/
  theme.ts                      # colors, fonts, icons, hazard-type color map, rider colors, safety thresholds
  colors.ts                     # re-exports
```

---

## 9. Risks Specific to You

| Risk | Mitigation |
|---|---|
| Road graph too large → A* slow (>1s) | Clip graph to ride bbox + 5km buffer. Cache graph in server memory per group. If still slow, consider contraction hierarchies (overkill for MVP — avoid unless Week 6 profiling demands). |
| No real ETA training data | Use Google Maps Directions API ETA as labels (§3.2). This bootstraps a real model without waiting for real rides. |
| LightGBM Node binding immature | Run a Python sidecar (Flask/FastAPI) for inference; Node proxies to it. Simpler and more stable than fighting a native binding. |
| Mapbox API costs/limits during testing | Use Firebase emulator for Firestore; for Mapbox, use the free tier and cache aggressively. If you hit limits, fall back to OSM (free, but you build the graph yourself). |
| UI inconsistency across 4 people | You own the theme and review UI PRs. Enforce "no hardcoded colors" in review. |
| Recalculation storm (many hazards appear at once → many /route calls) | Debounce on the client: batch hazard changes within a 500ms window into one recalculation request. `# ponytail: 500ms debounce, tune if UX feels laggy` |

---

## 10. Demo Script (Your Beat — §12 item 3)

1. Show the Live Map with a route displayed (origin = rider position, destination = a pin).
2. The ETA panel shows a time + safety score (green bar).
3. A teammate triggers a hazard report on or near the route (or you stage one via the mock producer).
4. Within ~1s: the route line visibly bends to avoid the hazard. The ETA panel updates (time may increase, safety bar may shift toward yellow/red).
5. Say one line: "Safety-weighted A* rerouted around the hazard in under a second; ETA and safety score updated live."

---

## 11. What to Skip (YAGNI)

- Contraction hierarchies / CH-based routing. A* on a clipped graph is fast enough. `# ponytail: plain A*, add CH if profiling shows >1s on real graphs`
- Real-time traffic integration (Google Maps Traffic). Out of scope for MVP; the ETA model captures time-of-day patterns implicitly.
- Turn-by-turn navigation in-app. Hand off to Google Maps via deep link (per spec §2).
- Multiple alternative routes display. Show one route (the safety-weighted best). Alternatives are nice-to-have, cut for MVP.
- On-device ETA inference (ONNX). Server REST call is simpler (per §9 recommendation). Only switch to on-device if latency profiling demands.
- A custom map style. Use Mapbox/Google default styles. Custom styling is polish, not MVP.

---

*Questions about your contract or dependencies? Raise in the weekly sync, do not assume. This plan assumes the spec (WeRide_Project_Spec.md) is the source of truth.*