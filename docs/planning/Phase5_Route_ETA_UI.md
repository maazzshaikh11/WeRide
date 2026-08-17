# WeRide — Person 3 · Phase 5: Route/ETA UI (Weeks 2–3)

**Module:** `/modules/routing-eta` (components) + `app/src/screens/map/overlays/RouteOverlay.tsx`
**Source of truth:** `docs/Development/Person_C_Routing_ETA.md` (MD §4.2/§4.3), spec §4.2, spec §2 (Google Maps deep link).
**Master roadmap:** `docs/planning/person3_plan.md`.

> **When:** Weeks 2–3 (parallel with Phase 3/4). **Blocks:** the Week-5 marquee demo (route + panel must auto-update).
> **Scope:** Route/ETA bottom sheet (collapsed + expanded), route line overlay on the map, Google Maps deep link. All UI consumes the route store from Phase 3 T-09 and the theme from Phase 1 T-02.

---

## Phase Objective

Give the Live Map the visible routing UI: a bottom-sheet panel that shows ETA (min) + distance (km) + safety bar and auto-updates when `route_response` changes, a map route line that re-draws on `recalculated_at_hlc`, and an "Open in Google Maps" deep link for real turn-by-turn navigation (in-app turn-by-turn is YAGNI — hand off via intent URL).

## Prerequisites

- **Phase 1 T-02** theme (all colors/tokens via `WeRideColors` / `safetyScoreColor`).
- **Phase 3 T-09** `routeStore` (module-local Zustand store with the latest `route_response`).
- **Phase 3 T-07** real `route_response` content (path, distance, safety_score, eta).
- Person A's `MapScreen` shell — the overlay interface was locked in Week 1 Day 2; `RouteOverlay` is already registered on `MapScreen`.

## Tasks in this phase

| Task | Name | Priority |
|---|---|---|
| T-13 | Route/ETA Panel (collapsed + expanded, auto-update, avoid toggle) | MVP |
| T-14 | Route Line Map Overlay | MVP |
| T-15 | Google Maps Deep Link | MVP |

---

## T-13 — Route/ETA Panel (collapsed + expanded, auto-update, avoid toggle)  [MVP]

**Objective.** The bottom-sheet panel on the Live Map (MD §4.2, spec §4.2): collapsed shows ETA (min) + distance (km) + safety bar (green/yellow/red); expanded shows the turn list (when turn data exists) + "Open in Google Maps"; auto-updates when `route_response` changes (no manual refresh); includes the "Avoid hazards" toggle that swaps `avoid_hazard_types` between all-types and none. `RoutePanel.tsx` (module component) is the reusable UI; `RouteOverlay.tsx` (app overlay, already registered on `MapScreen`) hosts it.

**Subtasks.**
1. `RoutePanel.tsx`: implement collapsed/expanded states (expanded reveals turn list if present), render via `safetyScoreColor`, add the toggle + deep-link button callbacks.
2. `RouteOverlay.tsx`: subscribe to `routeStore` (T-09); re-render automatically when `route_response` changes; on toggle change, update store `avoidHazards` and trigger `requestRoute`; pass `onOpenInGoogleMaps` → T-15.
3. Add the route slice consumers; ensure re-render is driven by `recalculated_at_hlc` (bump) so the panel updates without user action.
4. Remove the hardcoded `0 / 0 / 1` placeholder values.

**Files.** `modules/routing-eta/src/client/RoutePanel.tsx` (modify), `app/src/screens/map/overlays/RouteOverlay.tsx` (modify), `modules/routing-eta/src/index.ts` (re-export), `app/src/store/appStore.ts` (no change — per-module store, per AGENTS).

**Dependencies.** T-09 (store), T-07 (route_response content), T-02 (theme), T-15 (deep-link handler).

**Expected output.** On the Live Map, the panel shows live ETA/distance/safety and updates when the route recomputes.

**Definition of Done.** Panel re-renders when the store's `route` changes (no manual refresh); toggle flips `avoid_hazard_types` and re-requests; safety bar uses theme thresholds.

**Tests.** `eta_panel_updates` (module test with RN preset / react-test-renderer, or `app/__tests__/`): render with route A, update store to route B → panel text reflects B without user action.

---

## T-14 — Route Line Map Overlay  [MVP]

**Objective.** Draw the route on the map from `route_response.path_points` as a Mapbox `ShapeSource` + `LineLayer` (GeoJSON `LineString`), re-drawn when `recalculated_at_hlc` changes (MD §4.3; spec §4.2). Coordinate with Person A's overlay interface — `RouteOverlay` is already registered on A's `MapScreen` shell.

**Subtasks.**
1. Use `routeLine.ts`'s `routeToGeoJsonLine` (already converts to `[lng,lat]` and tags `recalculated_at_hlc`) as the source of the feature.
2. In `RouteOverlay.tsx` (or a small `RouteLineLayer` child), render `<MapboxGL.ShapeSource><MapboxGL.LineLayer/></MapboxGL.ShapeSource>` inside the map; rebuild the feature when the store route's `recalculated_at_hlc` changes (useMemo keyed on that field).
3. Add basic line styling via the theme (route color from `WeRideColors.primary`/`accent`), width/casing defaults — no custom map style (YAGNI).
4. Verify re-draw latency visually during the marquee reroute (Phase 6 T-17).

**Files.** `modules/routing-eta/src/client/routeLine.ts` (verify/extend), `app/src/screens/map/overlays/RouteOverlay.tsx` (add line layer), `modules/routing-eta/test/routeLine.test.ts` (new).

**Dependencies.** T-09 (store), T-02 (theme color), Person A's MapScreen shell (interface locked W1 D2).

**Expected output.** A visible route line on the map that changes shape when the route recomputes.

**Definition of Done.** Feature coordinates in `[lng,lat]` order; line re-renders on `recalculated_at_hlc` change; tests assert the GeoJSON shape + the feature key.

**Tests.** `route_line_geojson`: input `path_points [[lat,lng]...]` → LineString with swapped coords and `recalculated_at_hlc` property.

---

## T-15 — Google Maps Deep Link  [MVP]

**Objective.** "Open in Google Maps" hands off turn-by-turn navigation via the Google Maps intent URL (spec §2 / MD §4.2) — the app does **not** do in-app turn-by-turn (YAGNI).

**Subtasks.**
1. Add `googleMapsDeepLink(origin, destination)` util (e.g., in `routeLine.ts` or a new `deepLink.ts`): `https://www.google.com/maps/dir/?api=1&origin=lat,lng&destination=lat,lng&travelmode=driving`.
2. Wire `RoutePanel`'s button → `Linking.openURL(url)`; guard with `Linking.canOpenURL`; surface an error toast/alert on failure.
3. Test the exact URL shape for the current origin (rider `verified_location`) and destination.

**Files.** `modules/routing-eta/src/client/deepLink.ts` (new) or `routeLine.ts`, `modules/routing-eta/src/client/RoutePanel.tsx` (button handler), `modules/routing-eta/test/deepLink.test.ts` (new).

**Dependencies.** T-13 (panel button), Phase 6 T-16 origin (can use destination-only for the test).

**Expected output.** Tapping the button opens Google Maps navigation for the route.

**Definition of Done.** URL matches the documented format; `canOpenURL` guard present; test asserts exact URL.

**Tests.** `google_maps_deeplink`: for given origin/dest, `googleMapsDeepLink` returns `dir/?api=1&origin=...&destination=...&travelmode=driving`.

---

## Phase Dependencies / Critical Path

```
Phase 1 T-02 (theme) ──► T-13, T-14
Phase 3 T-09 (routeStore) ──► T-13 (panel), T-14 (line)
Phase 3 T-07 (route_response) ──► T-13 (content)
Phase 6 T-16 (real origin) ──► T-15 (deep link origin)  [optional for tests]
RouteOverlay registered on Person A's MapScreen (interface locked W1 D2)
```

## Phase Definition of Done

1. Route/ETA bottom sheet shows live ETA, distance, safety bar; auto-updates with no manual refresh.
2. "Avoid hazards" toggle re-requests the route with updated `avoid_hazard_types`.
3. Route line renders on the map and re-draws on `recalculated_at_hlc` change.
4. "Open in Google Maps" launches navigation via the correct intent URL.

## Tests required (this phase)

- `eta_panel_updates` (panel re-renders on store change).
- `route_line_geojson` (coord order + recalculated_at_hlc key).
- `google_maps_deeplink` (exact URL).

## Hand-off note for the AI agent

Work in `C:\Users\piyus\WeRide`. `RoutePanel.tsx` is the reusable module component; `RouteOverlay.tsx` is the app-side host that subscribes to the module store and positions the bottom sheet. All colors come from `WeRideColors` / `safetyScoreColor` — no hardcoded hex. In-app turn-by-turn and custom map styles are out of scope (YAGNI). Mapbox GeoJSON must be `[lng, lat]`.