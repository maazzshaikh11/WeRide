# WeRide — Person 3 · Phase 6: Integration Swaps (Weeks 4–5)

**Module:** `/modules/routing-eta` · **Source of truth:** `docs/Development/Person_C_Routing_ETA.md` (MD Week 4, Week 5), spec §11 row 4 / §12 item 3.
**Master roadmap:** `docs/planning/person3_plan.md`.

> **When:** Week 4 (swap 1: real `verified_location`) and Week 5 (swap 2: real `hazard_cluster` + HLC). **Week 5 is the critical integration week** — the marquee test lives here.
> **Scope:** replace Person 1's and Person 2's mocks with real streams; prove the demo beat: new hazard mid-route → recalc <1 s → route line bends + panel updates automatically.

---

## Phase Objective

Integrate the real external data sources. In Week 4 the route origin becomes Person A's real EKF-verified rider position. In Week 5 the routing consumes Person B's real `hazard_cluster` Firestore stream and real HLC timestamps; the **marquee test** (`reroute_on_hazard`, spec §11 row 4) must pass cleanly with the server recalc completing in <1 s.

## Prerequisites

- **Phase 3 complete:** T-07 hazard-aware routing + T-09 recalculation client + T-08 A* (latency budget).
- **Phase 5 complete:** panel + route line auto-update (so the reroute is visible in the UI).
- Person A **real EKF** + `verified_location` stream (Week 4 checkpoint).
- Person B **real `hazard_cluster`** Firestore listener + real HLC utility (Week 5 checkpoint).

## Tasks in this phase

| Task | Name | Priority |
|---|---|---|
| T-16 | Integration Swap 1: Real `verified_location` (Person A) | MVP |
| T-17 | Integration Swap 2: Real `hazard_cluster` + HLC + Marquee Reroute (Person B) | MVP |

---

## T-16 — Integration Swap 1: Real `verified_location` (Person A)  [MVP]

**Objective.** Route origin becomes the rider's **real** EKF-verified position instead of the mock (MD §5.1 / Week 4). Routes must start from where the rider actually is.

**Subtasks.**
1. Subscribe to A's `verified_location` stream (Socket.io `location:update` via `app/src/services/socketService.ts`, or A's module store) for the current rider in the group.
2. In `routeStore`/`RoutingClient`, use the latest `verified_location` as `route_request.origin` (only when `spoof_flag=false` and `accuracy_m` is acceptable; otherwise keep last good origin).
3. Avoid origin-churn recalc storms: only trigger a new `/route` when the rider has moved >~100 m (or when hazards change via T-09).
4. Verify on the live map that the route line starts at the rider marker.

**Files.** `modules/routing-eta/src/client/routeStore.ts`, `src/client/hazardListener.ts` or a new `originListener.ts`, `src/client/routingClient.ts`.

**Dependencies.** Person A real EKF + `verified_location` stream (Week 4 checkpoint), T-09.

**Expected output.** Requesting a route uses the live verified position; the line starts at the rider.

**Definition of Done.** Route origin equals the latest non-spoofed `verified_location`; moving the rider >100 m refreshes the route; no recalc storm on small jitter.

**Tests.** Mock a `verified_location` update into the store → assert the next request's `origin` matches; spoofed location → origin unchanged.

---

## T-17 — Integration Swap 2: Real `hazard_cluster` + HLC + Marquee Reroute (Person B)  [MVP]

**Objective.** The critical integration week (MD Week 5): real B `hazard_cluster`s (Firestore listener) replace the mock stream; routing avoids real hazards; `recalculated_at_hlc` uses B's real HLC; the marquee test — new hazard mid-route → recalc <1 s → route + ETA update automatically (§11 row 4 / §12 item 3).

**Subtasks.**
1. Replace mock hazard feed in Phase 3 T-09's `hazardListener` with the real Firestore `hazards/{cluster_id}` listener (filter `group_id`, `status='active'`).
2. Server: fetch real active clusters for the group (Firestore admin SDK or pass-through from client) into `handleRoute`; filter by `avoid_hazard_types`; apply penalties/avoidance (T-07).
3. `recalculated_at_hlc`: use B's real HLC utility (import `@hazard/hlc` — `modules/hazard-sos/src/hlc/hlc.ts` exposes `HLC`) on the server or accept B's HLC string from the triggering event; replace the `Date.now():0` mock.
4. Marquee test: publish a new `hazard_cluster` near the route mid-ride → assert the route bends away and `recalculated_at_hlc` bumps; time the full loop (client trigger → server recalc → UI update) and verify the server portion <1 s.
5. Measure + document call frequency (debounce behavior, how many `/route` calls per minute) for the spec §11 row 7 battery/CPU story.

**Files.** `modules/routing-eta/src/client/hazardListener.ts` (real listener), `server/astar.js`/`server/hazard_penalty.js` (real hazard fetch), `server/test/reroute.test.js` (extend, timed), `app/src/screens/map/overlays/RouteOverlay.tsx` (verify update), `README.md` (call frequency).

**Dependencies.** Person B real `hazard_cluster` + HLC (Week 5 checkpoint), T-07, T-09, T-12 (ETA recalculates), T-14 (line redraw).

**Expected output.** The demo beat: hazard appears → route visibly bends away → ETA/safety panel updates automatically.

**Definition of Done.** `reroute_on_hazard` passes against real hazard fixtures; timed server recalc <1 s on the realistic graph; panel + line update without user action; HLC string reflects B's clock.

**Tests.** `reroute_on_hazard` (real cluster fixture, timed <1 s); `recalc_latency_under_1s` (kept green); app-side `eta_panel_updates` re-run with a real hazard event.

---

## Phase Dependencies / Critical Path

```
Person A real EKF (W4) ──► T-16 (real origin) ──► T-17 (routes from real position, real hazards)
Person B real hazard_cluster + HLC (W5) ──► T-17 (marquee reroute <1s)
Phase 3 (T-07, T-09) + Phase 5 (T-13, T-14) + Phase 4 (T-12) ──► T-17 (UI + ETA update live)
Phase 7 T-21 (Week 6 validation) consumes T-16/T-17
```

## Phase Definition of Done

1. Routes start at the rider's real EKF-verified position (no spoofed/jittery origins).
2. Routing avoids real `hazard_cluster`s; `recalculated_at_hlc` carries B's real HLC.
3. **Marquee:** a real hazard published mid-route → server recalc <1 s → route line visibly bends + ETA/safety panel auto-update.
4. Call-frequency (per-minute `/route` count) measured and documented.

## Tests required (this phase)

- `reroute_on_hazard` (real fixtures, timed <1 s).
- `recalc_latency_under_1s` (kept green).
- Origin-from-`verified_location` + spoofed-origin-unchanged tests.
- `eta_panel_updates` re-run with a real hazard event.

## Hand-off note for the AI agent

Work in `C:\Users\piyus\WeRide`. This phase depends on Person 1's and Person 2's real deliverables — do not block: if a real stream is late, keep the mock path and log a clear "using mock" warning. `@hazard/hlc` is importable via the shared alias. The marquee timing budget is <1 s **server-side**; the full loop (client trigger → UI) can be longer. Preserve the frozen contract and MD terminology.