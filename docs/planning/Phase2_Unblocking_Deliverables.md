# WeRide — Person 3 · Phase 2: Unblocking Deliverables (Week 1, Day 2)

**Module:** `/modules/routing-eta` · **Source of truth:** `docs/Development/Person_C_Routing_ETA.md` (MD), spec §4.2/§5.
**Master roadmap:** `docs/planning/person3_plan.md`.

> **When:** Week 1, Day 2. **Blocking:** everyone else builds against C's mocks. This is the **mandatory unblocking rule** (MD §5.2): ship a mock `route_response` server + navigable Group List stub by end of Day 2.
> **Scope:** Mock server + Group List screen. No real routing yet (Phase 3).

---

## Phase Objective

Ship the two unblocking deliverables so the whole team can build against C's contract: (1) a running Node server where `POST /route` returns a schema-exact mock `route_response`; (2) a navigable Group List / Create / Join Ride screen using Firestore.

## Prerequisites

- **Phase 1 complete:** decisions ratified (T-01), theme ready (T-02), contracts frozen (T-03).
- Person A mock `verified_location` (W1 D2) — route origin placeholder.
- Person B HLC mock (W1 D2) — `recalculated_at_hlc` string placeholder.
- Infra: Node server runnable locally (`npm run dev` in `server/`), Firestore emulator available.

## Tasks in this phase

| Task | Name | Priority |
|---|---|---|
| T-04 | Mock `route_response` Server (`POST /route`) | MVP |
| T-05 | Group List / Create / Join Ride Screen | MVP |

---

## T-04 — Mock `route_response` Server (`POST /route`)  [MVP]

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

## T-05 — Group List / Create / Join Ride Screen  [MVP]

**Objective.** P0 entry-point screen (spec §4.2, MD §4.1): list the user's active/past groups from Firestore, create a group, join by code, tap → navigate to the Live Map for that `group_id`. The stub must be navigable by Day 2; Firestore wiring completes in Week 1.

**Subtasks.**
1. Fix `groupService.ts`: `arrayUnion(uid)` (not `arrayUnion([uid])`); add `joinGroup` error handling (invalid code); add a `myGroups()` snapshot subscription returning a usable list (currently returns a raw snapshot).
2. `GroupListScreen.tsx`: subscribe to `groups` where `member_ids` contains `uid` via `onSnapshot`; render active/past groups; keep Create/Join actions; navigate to `Map` with `{ groupId }`.
3. Replace the invalid `IconButton` import (react-native exports no `IconButton`) with a `Pressable`/text button or the icon system chosen in Phase 1 T-02.
4. Confirm navigation exists in `app/src/navigation/RootStack.tsx` (GroupList → Map).
5. Add Firestore rules note: `groups` must be readable by members (coordinated with infra; `infra/firebase/firestore.rules`).

**Files.** `app/src/screens/GroupListScreen.tsx`, `modules/routing-eta/src/group/groupService.ts`, `app/src/navigation/RootStack.tsx` (verify), `infra/firebase/firestore.rules` (review only).

**Dependencies.** T-02 (theme/icons), T-01 (state transport decision — Firestore for groups), Infra Firestore config + emulator.

**Expected output.** From login, a user can create a group, see it in the list, and tap into the Live Map.

**Definition of Done.** Create → appears in list; join by code → `member_ids` gains the rider; tap group → `Map` screen for that `group_id`. Works against Firestore emulator with mocked auth.

**Tests.** `group_list_create_join` (module test using the firebase mock from `test/__mocks__/`): create writes a doc with `member_ids=[uid]`; join adds the uid; list query filters `array-contains`.

---

## Phase Dependencies / Critical Path

```
Phase 1 (decisions/theme/contracts) ──► T-04 (mock server) ──► unblocks Phase 3, 4, 5
Infra (Node host + Firestore emulator) ──► T-04, T-05
Person B HLC mock (W1D2) ──► T-04 (recalculated_at_hlc placeholder)
Phase 1 T-02 theme ──► T-05 (icons/tokens)
```

## Phase Definition of Done

1. `POST /route` returns a schema-valid mock `route_response`; malformed request → 400.
2. Group List screen is navigable end-to-end (create → list → join → tap into Map) against Firestore emulator.
3. Both unblocking deliverables verified — the rest of the team can build against C's contract and mock.

## Tests required (this phase)

- `routingClient.test.ts` round-trip parse.
- `route_response_contract` smoke on the mock payload.
- `group_list_create_join` (create/join/list with mocked Firestore).

## Hand-off note for the AI agent

Work in `C:\Users\piyus\WeRide`. Server package is ESM (`"type": "module"`, `node --test`), client is ts-jest. Per package: `npm install` then `npm run lint && npm run typecheck && npm test`. Do not edit `contracts/` solo. Preserve the frozen §6.4 contract exactly — mock shape must validate against `route_contract.json`.