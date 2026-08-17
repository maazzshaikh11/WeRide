# WeRide — Person 3 · Phase 1: Decisions + Design System (Week 1, Day 1)

**Module:** `/modules/routing-eta` · **UI-lead:** Person C owns `app/src/theme/theme.ts`
**Source of truth:** `docs/Development/Person_C_Routing_ETA.md` (MD) and `WeRide_Project_Spec.md`.
**Master roadmap:** `docs/planning/person3_plan.md`.

> **When:** Week 1, Day 1. **Blocking:** everything else (P2–P7). Ship theme.ts Day 1 — it blocks all 4 people's UI.
> **Scope:** No feature code. Decisions + shared design tokens + frozen contracts.

---

## Phase Objective

Lock every Day-1 decision that gates the module, complete the shared design system (`theme.ts`: palette + font + icon set + hazard/rider/safety color maps), and freeze the `route_request` / `route_response` contracts. This is the coordination/UI-lead phase — nothing here can be built on an assumption.

## Prerequisites

- All 4 team members present at the Week-1 sync (decisions require 4-way agreement; contracts are PR-reviewed by all 4).
- Infra: Firebase project config + Node server hosting confirmed available (W1 D1–2).
- Mapbox access token (app already uses `@rnmapbox/maps`); Google Maps API key optional now (needed in Phase 4).

## Tasks in this phase

| Task | Name | Priority |
|---|---|---|
| T-01 | Lock Day-1 Technical Decisions | MVP |
| T-02 | Finalize Shared Theme (`theme.ts`: font + icon set) | MVP |
| T-03 | Verify/Freeze `route_request` / `route_response` Contracts | MVP |

---

## T-01 — Lock Day-1 Technical Decisions  [MVP]

**Objective.** Ratify every open decision that gates this module so no implementation work is built on an assumption (MD §5.1 "decide Day 1", spec §9). No code — this is a coordination artifact.

**Subtasks.**
1. Walk the Decision Register below with all 4 in the Week-1 sync.
2. Ratify scaffold choices: **Express** (`server/package.json` already uses it), **LightGBM** (already recorded in `README.md`), **server-side REST ETA inference**, **single Node process** with namespaced routers (`/route`, `/fl`, `/vox`).
3. Make the **Option A vs Option B** routing call (D-04). Recommended: **Option A for MVP** (Mapbox/Google Directions base route + hazard post-processing), upgrade to Option B (true A* on OSM) in Weeks 5–6. `# ponytail: start Option A, upgrade to B if time permits in Weeks 5-6`
4. Pick one **font** + one **icon set** (Material Icons or Lucide — not mixed). Record it so T-02 can implement it.
5. Record agreed **severity-weight defaults** (accident > oil_spill > debris > pothole > other; scaffold values 5/4/3/2/1) and **R = 100 m** as starting points to tune in Phase 3.
6. Update `WeRide_Project_Spec.md` §9 checkboxes for any decision changed in-sync (spec is source of truth; no solo changes).

**Files.** `docs/planning/person3_plan.md` (register), `WeRide_Project_Spec.md` §9, `modules/routing-eta/README.md` (decision summary).

**Dependencies.** All 4 present; Infra hosting + API-key availability confirmed.

**Expected output.** A filled Decision Register, one owner + one status per row; no open questions blocking T-02..T-12.

**Definition of Done.** Every register row is `Decided` or `Decision Required — recommendation accepted`; decisions recorded in spec/README; team verbally agrees.

**Tests.** None (coordination). Verify by reading the register.

---

## T-02 — Finalize Shared Theme (`theme.ts`: font + icon set)  [MVP]

**Objective.** Complete the shared design system MD §4.4 requires: one palette + one font + one icon set, hazard-type color map, rider-marker colors, safety-bar thresholds. `theme.ts` already has colors; add the missing font/icon constants and harden the file so everyone imports it and no one hardcodes colors. **Blocks everyone's UI — ship Day 1.**

**Subtasks.**
1. Add `fonts` (primary/headline from the chosen font) and `iconSet` name constant to `app/src/theme/theme.ts`.
2. Verify hazard-type color map (`hazardColor()`), rider colors, and safety thresholds are present and match MD §4.4. Fix any drift (`safetyScoreColor` thresholds ≥0.7 / 0.4–0.7 / <0.4).
3. Add spacing/radii tokens only if needed by C's own screens (keep minimal — no redesign).
4. Replace the invalid `IconButton` import in `GroupListScreen.tsx` (Phase 2 T-05) — `react-native` exports no `IconButton`; use a `Pressable`/text button or the chosen icon system.
5. Add a small test asserting the theme exports the required keys and threshold boundaries.

**Files.** `app/src/theme/theme.ts` (modify), `app/src/theme/colors.ts` (re-export exists). Tests: `app/__tests__/theme.test.ts` (new).

**Dependencies.** T-01 (font + icon-set decision). Downstream: Person B (hazard colors), Person D (VOX indicator styling).

**Expected output.** One theme file fully specifying the design system; all C-owned screens import from it.

**Definition of Done.** `npm run lint && npm run typecheck && npm test` pass in `app/`; `theme.test.ts` covers every color-key/threshold; no hardcoded color hex remains in C's owned screens/components.

**Tests.** `theme.test.ts`: exports required tokens; `safetyScoreColor(0.7)=green`, `(0.4)=yellow`, `(0.39)=red`; `hazardColor` returns each hazard-type color.

---

## T-03 — Verify/Freeze `route_request` / `route_response` Contracts  [MVP]

**Objective.** Confirm the frozen §6.4 shapes (single `contracts/route_contract.json`, per MD §8) are correct and machine-checked, with all 4 reviewing (contracts are PR-reviewed, no solo changes). Person C is sole producer of `route_response` and sole consumer of `route_request`.

**Subtasks.**
1. Review `contracts/route_contract.json` against MD §2.1/§2.2 — exact field names, types, `path_points` as `[[lat,lng]]`, `safety_score ∈ [0,1]`, `recalculated_at_hlc` string. No changes unless the full team agrees.
2. Add a CI/schema check that validates any `POST /route` response against this schema (server test `route_response_contract` — also required in Phase 7 T-18).
3. Ensure `app/src/models/routeResponse.ts` matches the contract (it does today) and is the single client-side mapping source.
4. Record the outcome in the register (D-13: keep single-file contract — matches repo convention + MD §8).

**Files.** `contracts/route_contract.json` (verify only), `modules/routing-eta/server/test/` (add schema-validation test), `app/src/models/routeResponse.ts` (verify only).

**Dependencies.** All 4 reviewers.

**Expected output.** A CI-enforced schema that `POST /route` responses must satisfy; no contract drift possible.

**Definition of Done.** Contract file unchanged (or changed only via 4-way PR approval); a validation test fails on a malformed response and passes on a valid one.

**Tests.** `route_response_contract`: serialize a sample `route_response` through the schema check → valid; mutate a required field → invalid.

---

## Decision Register (Phase 1 subset — full register in master plan)

| ID | Decision | Status / Recommendation |
|---|---|---|
| D-01 | Express vs Fastify | **Decision Required → Express** (already scaffolded) |
| D-02 | LightGBM vs XGBoost | **Decided — LightGBM** (don't maintain both) |
| D-03 | ETA inference: server REST vs on-device ONNX | **Decided — server REST call** |
| D-04 | Road graph: Option A vs Option B | **Decision Required → Option A MVP; Option B upgrade W5–6** |
| D-05 | LightGBM Node binding vs Python sidecar | **Decision Required → Python sidecar**, heuristic fallback |
| D-06 | Single Node process vs separate services | **Decided — single Node process** (`/route`, `/fl`, `/vox`) |
| D-07 | Font + icon set (Material Icons or Lucide, not mixed) | **Decision Required → Material Icons**; one font |
| D-08 | Safety-bar thresholds | **Decided — ≥0.7 green, 0.4–0.7 yellow, <0.4 red** (in theme.ts) |
| D-09 | Hazard severity weights | **Decision Required — start 5/4/3/2/1**, tune in Phase 3 |
| D-10 | Hazard influence radius R | **Decision Required — default 100 m** |
| D-11 | Recalculation debounce window | **Decided — 500 ms** (tune if laggy) |
| D-13 | Contract layout: single file vs split | **Decided — keep single `route_contract.json`** |
| D-16 | Directions provider for base route | **Decision Required → Google Maps Directions** (Mapbox stays tiles SDK) |

## Phase Definition of Done

1. All register rows resolved/ratified and recorded in the spec/README.
2. `theme.ts` complete (colors + fonts + icon set + all 3 color maps + safety thresholds) with a passing `theme.test.ts`.
3. `route_contract.json` frozen + machine-checkable; `routeResponse.ts` matches.
4. Master plan updated with any changed decisions.

## Tests required (this phase)

- `theme.test.ts` (keys, thresholds, hazard color map).

## Hand-off note for the AI agent

Work in `C:\Users\piyus\WeRide`. Per-package commands (no root install): `cd app && npm install`, then `npm run lint && npm run typecheck && npm test`. Contracts under `contracts/` must never be edited solo — any change needs all-4 review. Do not redesign the architecture; preserve MD terminology (`hazard_cluster`, `route_request`, `route_response`, `recalculated_at_hlc`, `avoid_hazard_types`, `safety_score`).