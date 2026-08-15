# Person C — Routing + ETA

Safety-Weighted A* routing + LightGBM ETA model. Node.js REST API.
Also UI-lead: owns the shared theme file (`app/src/theme/theme.ts`).

## Road graph approach (decide Day 1)
- **Option A (recommended MVP):** Mapbox/Google Directions API for base route, post-process to reroute around hazards.
- **Option B (true A*):** Load OSM road graph, build adjacency list with hazard-weighted edges, run A*.
- Start Option A, upgrade to B if time permits in Weeks 5-6.

## A* heuristic
- Haversine straight-line distance to destination (admissible → optimal)

## Hazard penalty function (document final formula)
penalty(edge, hazard) = f(hazard_type_severity, hazard_score, distance_to_hazard)
- Severity weights: accident > oil_spill > debris > pothole > other (tune)
- Radius R = 100m (hazards within R of an edge affect it)

## Safety score (document final formula)
safety_score = 1 - (sum_hazard_penalties / max_possible_penalty)
- Green >= 0.7, Yellow 0.4-0.7, Red < 0.4 (see theme.ts)

## ETA model
- LightGBM (chosen over XGBoost Day 1)
- Features: distance_km, turn_count, hour_of_day, day_of_week, hazard_count, avg_speed_limit
- Training data: Google Maps Directions API ETA as labels (bootstrap)
- Inference: server REST call (per §9 recommendation)

## Recalculation
- Client subscribes to hazard_cluster changes
- On new hazard within R of route → re-call POST /route
- Target: < 1s recalculation (§11 row 4)
- Debounce: 500ms window to batch hazard changes

## ETA inference location
Server REST call (simpler for student project). Document latency tradeoff.

## See also
- Plan: `Person_C_Routing_ETA.md`
- Contract: `contracts/route_contract.json`