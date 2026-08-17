# Person C — Routing + ETA

Safety-Weighted A* routing + LightGBM ETA model. Node.js REST API.
Also UI-lead: owns the shared theme file (`app/src/theme/theme.ts`).

**Status:** Phase 1 Complete (W1 D1) — All Day-1 decisions locked; theme.ts finalized; contracts frozen.

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

## Architecture

**Module structure:**
- `server/` — ESM Node.js (Express), routes `/route`, `/fl/*`, `/vox`
- `src/` — TypeScript client (RN), route UI + Group List
- `test/` — unit tests (ts-jest for client, node --test for server)

## Road graph approach (decide Day 1) → Decided: Option A

- **Option A (MVP, chosen):** Google Maps Directions API for base route, post-process to reroute around hazards.
- **Option B (stretch, W5–6):** Load OSM road graph, build adjacency list with hazard-weighted edges, run true A*.
- Implement Option A in Phase 3 T-06; keep OSM loader stub for potential upgrade.

## A* heuristic
- Haversine straight-line distance to destination (admissible → optimal)
- Phase 3 T-08: implement binary heap (not O(n log n) sort); add caching + clipping

## Hazard penalty function (implement Phase 3 T-07)
```
penalty(edge, hazard) = severity(hazard_type) * hazard_score * (1 - distance/R)
  for distance <= R
severity weights: accident(5) > oil_spill(4) > debris(3) > pothole(2) > other(1)
R = 100m (tuned in W2–3)
```
Extract into `server/hazard_penalty.js`.

## Safety score (implement Phase 3 T-07)
```
safety_score = 1 - (sum_hazard_penalties / max_possible_penalty)
  range: [0, 1]
Green >= 0.7, Yellow 0.4-0.7, Red < 0.4 (see theme.ts)
```

## ETA model (implement Phase 4 T-10/T-11/T-12)
- LightGBM (chosen over XGBoost)
- Features: distance_km, turn_count, hour_of_day, day_of_week, hazard_count, avg_speed_limit
- Training data: Google Maps Directions API ETA as labels (bootstrap)
- Inference: Python sidecar (Flask/FastAPI) serving `/predict`, Node proxy; fallback: distance/speed heuristic

## Recalculation
- Client subscribes to `hazard_cluster` changes
- On new hazard within R of route → re-call `/route`
- Target: < 1s server-side recalc (Phase 5 T-17, marquee test)
- Debounce: 500ms window to batch hazard changes

## Design System (Phase 1 T-02 — locked W1 D1)
- **Palette:** locked in `app/src/theme/theme.ts` (colors, hazard map, rider colors, safety thresholds)
- **Font:** Roboto (system default, RN standard)
- **Icon set:** Material Icons (react-native-vector-icons)
- **UI lead:** Person C owns theme, reviews all UI PRs for consistency

## See also
- Plan: `Person_C_Routing_ETA.md`
- Contract: `contracts/route_contract.json`
- Phase 1: `docs/planning/Phase1_Decisions_DesignSystem.md`
- Phase 2: `docs/planning/Phase2_Unblocking_Deliverables.md`
- Phase 3: `docs/planning/Phase3_Routing_Engine.md`