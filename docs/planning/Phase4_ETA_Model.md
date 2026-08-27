# WeRide — Person 3 · Phase 4: ETA Model (Weeks 2–3)

**Module:** `/modules/routing-eta` · **Source of truth:** `docs/Development/Person_C_Routing_ETA.md` (MD §3.2), spec §9.
**Master roadmap:** `docs/planning/person3_plan.md`.

> **When:** Weeks 2–3 (parallel with Phase 3 core algorithm work). **Decision:** LightGBM (D-02), server REST inference (D-03), Python sidecar (D-05).
> **Scope:** collect training data, train the model, export it, and serve inference that `POST /route` calls for `eta_minutes`.

---

## Phase Objective

Ship a working ETA that learns real ETA dynamics (traffic, road type, turns, time of day) instead of `distance / speed`. Bootstrap training data without real rides: use Google Maps Directions API ETA as labels (recommended) or a synthetic generator. Run inference on the server (REST) with a documented heuristic fallback so the demo never blocks on model infrastructure.

## Prerequisites

- **Phase 3 T-06** feature definitions (`distance_km`, `turn_count`, `avg_speed_limit`) and **T-07** (`hazard_count_along_route`) — these are the model inputs.
- Python environment with `lightgbm pandas scikit-learn` (training) and `flask`/`fastapi` (sidecar inference).
- `GOOGLE_MAPS_API_KEY` for the Directions-API labels (or use the synthetic fallback).

## Tasks in this phase

| Task | Name | Priority |
|---|---|---|
| T-10 | ETA Training-Data Collection (`collect_directions.py`) | MVP |
| T-11 | Train LightGBM ETA Model (`train_eta.py`) | MVP |
| T-12 | ETA Inference Server + Wire Into `POST /route` | MVP |

---

## T-10 — ETA Training-Data Collection (`collect_directions.py`)  [MVP]

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

## T-11 — Train LightGBM ETA Model (`train_eta.py`)  [MVP]

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

**Tests.** `eta_model_sanity` (server-side, Phase 7 T-18): ETA positive, roughly proportional to `distance_km`, increases with `hazard_count`. When a real model file exists, run against it; otherwise against the fallback.

---

## T-12 — ETA Inference Server + Wire Into `POST /route`  [MVP]

**Objective.** Load the trained model on the server and return `eta_minutes` in `route_response`. Per MD §3.2/§9 recommendation: **server REST call** (no on-device runtime). Because the `lightgbm` Node binding is immature, use a **Python sidecar** (`# ponytail: Python sidecar for LightGBM inference, Node-native binding if it stabilizes`), with the distance/speed heuristic as a documented fallback when the model/sidecar is unavailable.

**Subtasks.**
1. `eta_model.js`: implement `predictEta(features)` — try Python sidecar (`POST localhost:5000/predict`) first; fall back to the existing `distance/avg_speed + hazard delay` heuristic with a clear log line.
2. Implement the sidecar: `server/training/eta_sidecar.py` (Flask/FastAPI) loading `eta_model.txt`, serving `/predict` for the 6 features.
3. Compute features in `handleRoute` (Phase 3 T-07): `distance_km`, `turn_count` (T-06), `hour_of_day`, `day_of_week`, `hazard_count_along_route` (T-07), `avg_speed_limit` (T-06).
4. Ensure `eta_minutes` is positive and finite even if inference fails (fallback).
5. Document the inference location + latency tradeoff in README (MD §3.2 "Document this in your README").

**Files.** `modules/routing-eta/server/eta_model.js` (modify), `server/training/eta_sidecar.py` (new), `server/astar.js` (wire features into `handleRoute`), `server/package.json` (add sidecar run script), `README.md`.

**Dependencies.** T-11 (model), T-07 (route + hazard_count), T-06 (turn_count, distance), Python env.

**Expected output.** `POST /route` returns a sensible `eta_minutes` derived from the model (or a logged heuristic fallback).

**Definition of Done.** Sidecar runs and serves `/predict`; Node proxies correctly; heuristic fallback engaged when sidecar is down; `eta_model_sanity` passes.

**Tests.** `eta_model_sanity`: with a fixed feature vector, ETA > 0; increasing `distance_km` increases ETA; increasing `hazard_count` increases ETA.

---

## Phase Dependencies / Critical Path

```
Phase 3 T-06 (features: distance, turn_count, avg_speed_limit) ──► T-10 (data) ──► T-11 (train) ──► T-12 (infer) ──► Phase 3 T-07 (eta_minutes in /route) ──► Phase 5 T-13 (panel)
Python env + Google Maps key (or synthetic fallback)
Phase 7 T-18 consumes eta_model_sanity
```

## Phase Definition of Done

1. `routes_df.csv` generated (≥ 500 rows, or synthetic equivalent).
2. `eta_model.txt` trained + exported; RMSE recorded.
3. `POST /route` returns model-derived `eta_minutes` (or a logged heuristic fallback if the sidecar is down).
4. README documents features, training source, and the server-inference latency tradeoff.

## Tests required (this phase)

- `eta_model_sanity` (positive; proportional to distance; increases with hazard_count).

## Hand-off note for the AI agent

Work in `C:\Users\piyus\WeRide`. Python scripts live in `modules/routing-eta/server/training/`. The Node server (`server/eta_model.js`) proxies to the Python sidecar and must never crash when the sidecar/model is absent — always fall back to the heuristic. Keep the model export format loadable by the sidecar (`eta_model.txt`). `# ponytail:` markers are tunable — don't gold-plate the ML (a heuristic fallback is acceptable for the demo).