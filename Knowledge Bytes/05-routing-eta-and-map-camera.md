---
### Byte 5: Routing, ETA and how the map frames the route
*Builds on:* Byte 3 (the rider's own fix is the route origin) and Byte 4 (the server hosts `/route`)

*In plain terms:*
When a ride has a destination, the app asks the server for a route from the rider's **current position**. The server returns the path plus distance, **ETA** and a **safety score**. The map then **frames the route** (like Google Maps) instead of following the rider around the world.

*The code:*
```ts
// RouteOverlay: origin = the rider's own verified fix, destination = ride plan
client.scheduleRecalculation({ group_id, origin, destination,
  avoid_hazard_types, active_hazards });          // debounced POST /route
```
```js
// server handleRoute: Mapbox Directions when a token exists, else a straight line
pathPoints = mapbox ? best.points.map(p => [p.lat, p.lng])
                    : [[origin.lat, origin.lng], [destination.lat, destination.lng]];
```

*How it fits together:*
1. **`RoutingClient`** debounces requests (500 ms) and only re-requests when the rider has moved more than 100 m or the destination/hazards changed. A new destination clears the old route first.
2. **`handleRoute`** (Node) gets candidate routes from **Mapbox Directions**, prefers the one with the fewest *active hazard* conflicts, then computes:
   - **safety score** (0–1): exposure to hazards along the path, each weighted by type (accident 5 … other 1);
   - **ETA**: features (distance, turns, hour, day, hazard count…) go to a Python **LightGBM sidecar**; if it is unreachable, a distance/speed heuristic is used.
3. **Without a Mapbox token** the server still answers, with a 2-point straight line — real hazard scoring, but not road-following.
4. **`routeStore`** holds the response; the live screen shows ETA and km left, and the route-details sheet (`RouteSheet`) adds the safety score; "Open in Google Maps" hands off turn-by-turn (the app never invents turns).

*The camera:*
```ts
// utils/mapFit.ts — pure planning, no map import
planFit(points) → { kind:'bounds', ne, sw } | { kind:'point', center, zoom:16 } | null
```
`useRouteFit` frames route + start + stops + destination **once per plan** (and again when the first route arrives), with padding that clears the header and status plate, the side buttons, and the speed/ETA cluster and control keys. It never re-fits on a re-route, and it does nothing while the rider is in follow mode.

*Why it is designed this way:* the old camera was locked to `followUserLocation`, so with no GPS puck yet the map showed the whole world and the route was a speck. Pure `planFit` also handles awkward cases (same start/end, tiny route, a stray `(0,0)`).

*Gotcha:* the camera must stay in sync with the floating UI's footprint (`TOP_CHROME_H`, `SIDE_COLUMN_W`, `BOTTOM_CHROME_H` in `MapScreen`) or the route will hide under a button.
