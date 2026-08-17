# WeRide — Person 3 · Phase 7: Tests, Docs, Polish, Demo (Weeks 2–7)

**Module:** `/modules/routing-eta` · **Source of truth:** `docs/Development/Person_C_Routing_ETA.md` (MD §7, §10, Week 6, Week 7), spec §11/§12.
**Master roadmap:** `docs/planning/person3_plan.md`.

> **When:** Weeks 2–6 (tests + docs run in parallel with Phases 3–6), Week 6 (system integration + perf), Week 7 (freeze + demo rehearsal).
> **Scope:** complete the required test suite, document every algorithm/formula, validate the <1 s recalc + safety + ETA on the integrated app, polish the UI as UI-lead, and land the Week-7 freeze + demo.

---

## Phase Objective

Turn the module from "works in isolation" into "demonstrably correct, documented, polished, and demo-ready". Close out every §7 test, write the README that makes every formula auditable, run the Week-6 system-integration validation (recalc <1 s, safety-bar correctness, ETA accuracy, battery/CPU story), review theme consistency as UI-lead, and rehearse the demo beat to ~3 s.

## Prerequisites

- **Phases 3–6 complete** (routing, ETA, UI, integration swaps) — this phase validates and closes out, it does not build features.
- CI running (`infra/ci/ci.yml`) for lint + tests per package.
- A staged way to publish a hazard mid-ride for the marquee demo (B's mock producer or a staged report).

## Tasks in this phase

| Task | Name | Priority |
|---|---|---|
| T-18 | Complete Server-Side Test Suite (§7) | MVP |
| T-19 | App-Side Tests + `demo()` Self-Check | MVP |
| T-20 | Module README + Algorithm Documentation | MVP |
| T-21 | Week 6 System Integration + Performance Validation | MVP |
| T-22 | Week 6–7 UI Polish, Theme Review, Freeze + Demo Rehearsal | MVP |

---

## T-18 — Complete Server-Side Test Suite (§7)  [MVP]

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

## T-19 — App-Side Tests + `demo()` Self-Check  [MVP]

**Objective.** §7 app-side tests (`eta_panel_updates`, `google_maps_deeplink`, `group_list_create_join`) and the self-check `demo()` that runs A* on a tiny grid with one hazard and prints the avoiding path (eyeballable without the server).

**Subtasks.**
1. Land `eta_panel_updates` (Phase 5 T-13), `google_maps_deeplink` (Phase 5 T-15), `group_list_create_join` (Phase 2 T-05) as module or `app/__tests__/` tests per AGENTS placement rules.
2. Add `modules/routing-eta/server/demo.js`: builds a small grid graph, inserts one hazard, runs A* + penalties, prints the path that avoids it.
3. Confirm `npm test` (module) + `npm test` (app) run in CI.

**Files.** `modules/routing-eta/test/*` (UI/logic tests), `app/__tests__/*` (RN-component tests), `server/demo.js` (new).

**Dependencies.** T-05, T-13, T-15, T-08.

**Expected output.** All app-side tests pass; `node server/demo.js` prints a hazard-avoiding path.

**Definition of Done.** Three §7 app tests green; `demo.js` runs standalone and prints a sensible avoiding path.

**Tests.** `eta_panel_updates`, `google_maps_deeplink`, `group_list_create_join`.

---

## T-20 — Module README + Algorithm Documentation  [MVP]

**Objective.** `modules/routing-eta/README.md` documents exactly what MD §2–3 require: road graph source + chosen approach, A* heuristic, hazard penalty function, safety_score formula, ETA model features + training source, inference location, and the recalculation/debounce/call-frequency notes.

**Subtasks.**
1. Write/finalize the README sections (scaffold exists; keep it current after Phase 3 T-06/T-07 and Phase 4 T-12).
2. Record the ETA model's RMSE + feature list (from Phase 4 T-11).
3. Document the server-inference latency tradeoff (MD §3.2).
4. Record the safety-bar thresholds + severity weights + R and how to tune them.

**Files.** `modules/routing-eta/README.md`, optionally `server/README.md`.

**Dependencies.** T-06, T-07, T-12, T-11 metrics.

**Expected output.** A README that a reviewer can read to understand every formula and integration point.

**Definition of Done.** All §3 items documented; formulas match code; RMSE recorded.

**Tests.** None (documentation). Review gate: code formulas match README formulas.

---

## T-21 — Week 6 System Integration + Performance Validation  [MVP]

**Objective.** Full-system validation of C's parts (MD Week 6): dynamic rerouting <1 s, safety-score correctness vs actual hazard exposure, ETA accuracy vs a real test ride, and battery/CPU story (module is mostly server-side — client impact is HTTP calls; document call frequency).

**Subtasks.**
1. Run the marquee reroute in the integrated app; time client→server→UI loop; confirm <1 s server portion (and acceptable end-to-end).
2. Validate safety bar color matches actual hazard exposure on a staged ride.
3. Compare predicted `eta_minutes` to a real test-ride duration; record the delta.
4. Profile HTTP call frequency (debounce + hazard-triggered + origin-move thresholds) and record in README (spec §11 row 7).

**Files.** `README.md` (perf notes), test fixtures; code changes only if a defect is found.

**Dependencies.** T-16 (real origin), T-17 (real hazards), T-12 (ETA), all of Phase 5 (UI), full app integration.

**Expected output.** Measured numbers for the report: recalc time, ETA error, call frequency.

**Definition of Done.** <1 s recalc verified; safety bar matches exposure; ETA error documented; call-frequency profile in README.

**Tests.** Re-run `recalc_latency_under_1s` + `reroute_on_hazard` in the integrated environment; manual ride validation.

---

## T-22 — Week 6–7 UI Polish, Theme Review, Freeze + Demo Rehearsal  [MVP]

**Objective.** As UI-lead: polish C's screens/overlays against the theme, review B's and D's overlays for theme consistency (no hardcoded colors), and land the Week 7 freeze + demo rehearsal of the reroute beat (§12 item 3) — hazard appears → route bends → panel updates, all within ~3 s.

**Subtasks.**
1. UI polish pass on Route/ETA panel, Group List, route line (spacing, theme tokens, safe-area bottom sheet).
2. Theme-consistency review of B's (hazard markers) and D's (VOX indicator) overlays; open review comments for any hardcoded colors.
3. Freeze the final build 2 days before submission (MD Week 7); branch freeze + tag.
4. Rehearse the demo script (MD §10): stage the hazard via the mock producer, practice the timing so the reroute lands within ~3 s; refine the one-line explanation.

**Files.** C's UI files from T-13/T-14 (polish), review comments for B/D, demo notes in `docs/meeting_notes/` or `report_drafts/`.

**Dependencies.** T-21 (validated integration), all Phase 5 UI, B/D overlay review requests.

**Expected output.** A polished, consistent UI and a rehearsed, reliable demo.

**Definition of Done.** No hardcoded colors in C's UI; B/D overlays use theme tokens; build frozen; demo beat rehearsed to ~3 s.

**Tests.** Manual demo rehearsal; regression: `npm run lint && npm run typecheck && npm test` green for app + module + server before freeze.

---

## Phase Dependencies / Critical Path

```
Phases 3–6 complete ──► T-18/T-19 (close-out tests) ──► CI green
Phase 4 T-11 (metrics) ──► T-20 (README RMSE)
Phase 6 T-16/T-17 ──► T-21 (Week 6 validation)
T-21 + Phase 5 UI ──► T-22 (polish + freeze + rehearsal) ──► Final demo
```

## Phase Definition of Done

1. All §7 tests green in CI (8 server + 3 app + debounce/demo).
2. `demo()` self-check prints a hazard-avoiding path standalone.
3. README documents road graph source, A* heuristic, penalty function, safety_score formula, ETA features/training/inference location, recalc trigger + debounce + call frequency.
4. Week-6 validation numbers recorded: server recalc <1 s, safety bar matches exposure, ETA error vs real ride, call frequency.
5. UI polished and theme-consistent (C's + reviewed B/D overlays).
6. Build frozen 2 days before submission; demo beat rehearsed to ~3 s.

## Tests required (this phase)

- §7 server suite: `astar_optimal`, `astar_heuristic_admissible`, `hazard_penalty_applied`, `reroute_on_hazard`, `recalc_latency_under_1s`, `eta_model_sanity`, `safety_score_range`, `route_response_contract`.
- App: `eta_panel_updates`, `google_maps_deeplink`, `group_list_create_join`.
- `demo()` self-check (manual).

## Hand-off note for the AI agent

Work in `C:\Users\piyus\WeRide`. Required order per package: **lint → typecheck → test** (CI enforces). Don't add features in this phase — close out tests, docs, polish, and validation. As UI-lead, Person C reviews other people's UI for hardcoded colors; raise comments, don't edit B/D files directly. The final DoD for the whole Person 3 module is in the master roadmap (`docs/planning/person3_plan.md`, §8).