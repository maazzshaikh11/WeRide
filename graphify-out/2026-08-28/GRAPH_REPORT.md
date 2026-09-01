# Graph Report - WeRide  (2026-08-28)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 988 nodes · 1171 edges · 91 communities (85 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `aba93070`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- HLC
- DpMasking
- trackingService.ts
- dependencies
- properties
- routingClient.ts
- compilerOptions
- properties
- required
- properties
- paths
- devDependencies
- GroupListScreen.tsx
- fl_model_update.json
- vox_signal.json
- astar.js
- sos_event.json
- compilerOptions
- server/package.json
- compilerOptions
- compilerOptions
- RouteOverlay.tsx
- MapScreen.tsx
- devDependencies
- theme.ts
- route_contract.json
- properties
- devDependencies
- devDependencies
- WeRideColors
- functions/package.json
- properties
- fl-voice/package.json
- hazard-sos/package.json
- LocalQueue
- routing-eta/package.json
- tracking/package.json
- items
- required
- devDependencies
- SosOverlay.tsx
- VoxOverlay.tsx
- properties
- origin
- functions/index.js
- SosButton.tsx
- typescript
- @types/jest
- geoUtils.ts
- safety_score
- FlStatusIndicator.tsx
- MusicWidget.tsx
- eta_model.js
- road_graph.js
- collect_directions.py

## God Nodes (most connected - your core abstractions)
1. `HLC` - 21 edges
2. `LocalQueue` - 12 edges
3. `WeRideColors` - 12 edges
4. `compilerOptions` - 12 edges
5. `DpMasking` - 11 edges
6. `Ekf` - 11 edges
7. `compilerOptions` - 11 edges
8. `compilerOptions` - 11 edges
9. `compilerOptions` - 11 edges
10. `required` - 11 edges

## Surprising Connections (you probably didn't know these)
- `exclude` --extends--> `node_modules`  [EXTRACTED]
  modules/routing-eta/tsconfig.json → app/tsconfig.json
- `exclude` --extends--> `node_modules`  [EXTRACTED]
  modules/tracking/tsconfig.json → app/tsconfig.json
- `RoutingClientParams` --references--> `RouteResponse`  [EXTRACTED]
  modules/routing-eta/src/client/routingClient.ts → app/src/models/routeResponse.ts
- `RoutePanel()` --calls--> `safetyScoreColor()`  [EXTRACTED]
  modules/routing-eta/src/client/RoutePanel.tsx → app/src/theme/theme.ts
- `@contracts/*` --extends--> `../contracts/*`  [EXTRACTED]
  modules/fl-voice/tsconfig.json → app/tsconfig.json

## Import Cycles
- None detected.

## Communities (91 total, 6 thin omitted)

### Community 0 - "HLC"
Cohesion: 0.08
Nodes (21): dbscanByType(), DbscanParams, distanceM(), HazardClusterResult, HazardReport, makeCluster(), rangeQuery(), HLC (+13 more)

### Community 1 - "DpMasking"
Cohesion: 0.05
Nodes (19): DpMasking, DpMaskingParams, FlClient, FlClientParams, TODO: wire to TFLite for actual model training. For now: stub the training step., TODO: TFLite training loop with FedProx proximal term, FlRoundLogger, RoundInfo (+11 more)

### Community 2 - "trackingService.ts"
Cohesion: 0.08
Nodes (17): Ekf, EkfParams, TODO: proper Jacobian + covariance propagation, LocationPublisher, LocationPublisherParams, VerifiedLocationPayload, MockLocationProducer, MockLocationProducerParams (+9 more)

### Community 3 - "dependencies"
Cohesion: 0.05
Nodes (41): dependencies, react, react-native, react-native-background-geolocation, @react-native-firebase/app, @react-native-firebase/auth, @react-native-firebase/firestore, @react-native-firebase/messaging (+33 more)

### Community 4 - "properties"
Cohesion: 0.05
Nodes (39): type, type, type, description, type, description, type, description (+31 more)

### Community 5 - "routingClient.ts"
Cohesion: 0.08
Nodes (13): HazardCluster, HazardStatus, HazardType, RouteRequest, routeRequestToJson(), RouteResponse, routeResponseFromJson(), SosEvent (+5 more)

### Community 6 - "compilerOptions"
Cohesion: 0.06
Nodes (34): exclude, node_modules, compilerOptions, baseUrl, esModuleInterop, jsx, lib, module (+26 more)

### Community 7 - "properties"
Cohesion: 0.06
Nodes (35): enum, type, oil_spill, other, hazard_type, description, type, enum (+27 more)

### Community 8 - "required"
Cohesion: 0.06
Nodes (36): required, hazard_type, lat, lng, rider_id, timestamp_hlc, required, created_at_hlc (+28 more)

### Community 9 - "properties"
Cohesion: 0.06
Nodes (34): description, type, description, description, type, type, type, type (+26 more)

### Community 10 - "paths"
Cohesion: 0.09
Nodes (34): ../contracts/*, paths, ../../app/src/*, ../fl-voice/src/*, ../hazard-sos/src/*, ../routing-eta/src/*, ../tracking/src/*, @app/* (+26 more)

### Community 11 - "devDependencies"
Cohesion: 0.06
Nodes (32): description, devDependencies, @babel/core, babel-jest, @babel/preset-env, jest, metro-react-native-babel-preset, react-test-renderer (+24 more)

### Community 12 - "GroupListScreen.tsx"
Cohesion: 0.10
Nodes (20): displayName, name, App(), RootStack(), RootStackParamList, Stack, GroupListScreen(), TODO: subscribe to groups where member_ids contains uid via onSnapshot (+12 more)

### Community 13 - "fl_model_update.json"
Cohesion: 0.07
Nodes (27): description, type, description, type, description, type, privacy, properties (+19 more)

### Community 14 - "vox_signal.json"
Cohesion: 0.07
Nodes (27): null, string, resolved_at_hlc, description, type, description, type, description (+19 more)

### Community 15 - "astar.js"
Cohesion: 0.12
Nodes (17): applyHazardPenalties(), astar(), handleRoute(), haversineMeters(), MinHeap, TODO: load road graph for the bbox (Option A: use Directions API; Option B: OSM…, TODO: fetch active hazards from Firestore, filter by avoid_hazard_types, TODO: applyHazardPenalties, run astar, compute safety_score, call ETA model (+9 more)

### Community 16 - "sos_event.json"
Cohesion: 0.08
Nodes (25): crdt, description, type, description, type, type, type, properties (+17 more)

### Community 17 - "compilerOptions"
Cohesion: 0.09
Nodes (23): @react-native/typescript-config, compilerOptions, baseUrl, esModuleInterop, jsx, paths, skipLibCheck, strict (+15 more)

### Community 18 - "server/package.json"
Cohesion: 0.12
Nodes (15): cors, express, dependencies, cors, express, socket.io, description, name (+7 more)

### Community 19 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, baseUrl, esModuleInterop, jsx, lib, module, outDir, skipLibCheck (+7 more)

### Community 20 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, baseUrl, esModuleInterop, jsx, lib, module, outDir, skipLibCheck (+7 more)

### Community 21 - "RouteOverlay.tsx"
Cohesion: 0.20
Nodes (10): TODO: Google Maps deep link (intent URL — Linking.openURL), TODO: wire to RoutingClient (calls POST /route), TODO: collapsed/expanded bottom sheet states, RouteOverlay(), styles, safetyScoreColor(), Props, TODO: collapsed/expanded bottom sheet states, turn list, Google Maps intent URL… (+2 more)

### Community 22 - "MapScreen.tsx"
Cohesion: 0.19
Nodes (9): styles, FlStatusOverlay(), TODO: wire to local FL round logger state, styles, HazardOverlay(), TODO: show HazardReportSheet (bottom sheet with type picker), TODO: wire to Firestore hazards/ listener filtered by group_id, TODO: wire to Socket.io location:update listener, render Mapbox shape sources (+1 more)

### Community 23 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, eslint, jest, ts-jest, typescript, jest, ts-jest

### Community 24 - "theme.ts"
Cohesion: 0.23
Nodes (9): hazardColor(), HazardType, hazardMarkerColor(), HazardMarkerData, TODO: wire to HazardService.watchClusters stream, render Mapbox ShapeSources, HazardReportSheet(), Props, styles (+1 more)

### Community 25 - "route_contract.json"
Cohesion: 0.18
Nodes (10): description, request, required, $schema, title, transport, type, avoid_hazard_types (+2 more)

### Community 26 - "properties"
Cohesion: 0.18
Nodes (11): type, type, distance_km, eta_minutes, recalculated_at_hlc, route_id, description, type (+3 more)

### Community 27 - "devDependencies"
Cohesion: 0.18
Nodes (11): eslint, eslint, eslint, eslint, devDependencies, eslint, jest, ts-jest (+3 more)

### Community 28 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, jest, ts-jest, @typescript-eslint/eslint-plugin, @typescript-eslint/parser, jest, ts-jest, @typescript-eslint/eslint-plugin (+1 more)

### Community 29 - "WeRideColors"
Cohesion: 0.22
Nodes (5): WeRideColors, TODO: wire to VoxClient + Vad., styles, Props, styles

### Community 30 - "functions/package.json"
Cohesion: 0.22
Nodes (8): firebase-admin, firebase-functions, dependencies, firebase-admin, firebase-functions, description, main, name

### Community 31 - "properties"
Cohesion: 0.25
Nodes (8): items, type, type, type, avoid_hazard_types, destination, group_id, properties

### Community 32 - "fl-voice/package.json"
Cohesion: 0.25
Nodes (7): name, private, scripts, lint, test, typecheck, version

### Community 33 - "hazard-sos/package.json"
Cohesion: 0.25
Nodes (7): name, private, scripts, lint, test, typecheck, version

### Community 34 - "LocalQueue"
Cohesion: 0.11
Nodes (9): LocalQueue, OrSet, SosEvent, sosEventFromJson(), sosEventToJson(), TODO: also fetch remote SOS events and merge into local CRDT (cross-client…, SyncWorker, TODO: queue the resolve op for later sync (+1 more)

### Community 35 - "routing-eta/package.json"
Cohesion: 0.25
Nodes (7): name, private, scripts, lint, test, typecheck, version

### Community 36 - "tracking/package.json"
Cohesion: 0.25
Nodes (7): name, private, scripts, lint, test, typecheck, version

### Community 37 - "items"
Cohesion: 0.33
Nodes (7): items, maxItems, minItems, type, items, type, path_points

### Community 38 - "required"
Cohesion: 0.29
Nodes (7): required, distance_km, eta_minutes, path_points, recalculated_at_hlc, route_id, safety_score

### Community 39 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, jest, ts-jest, @types/jest, @types/node, jest, ts-jest, @types/node (+2 more)

### Community 40 - "SosOverlay.tsx"
Cohesion: 0.33
Nodes (5): TODO: implement hold/double-tap gesture (use react-native-gesture-handler), TODO: wire to SosService (local CRDT queue + Firestore sync + FCM), TODO: replace with hold/double-tap gesture — single tap must NOT trigger, SosOverlay(), styles

### Community 41 - "VoxOverlay.tsx"
Cohesion: 0.33
Nodes (5): TODO: wire to VoxClient (WebRTC + /vox signaling), TODO: implement VAD-driven voice_active broadcast, TODO: PTT fallback button in manual mode, styles, VoxOverlay()

### Community 42 - "properties"
Cohesion: 0.40
Nodes (6): properties, type, type, properties, lat, lng

### Community 43 - "origin"
Cohesion: 0.40
Nodes (6): required, lat, lng, required, type, origin

### Community 44 - "functions/index.js"
Cohesion: 0.40
Nodes (3): admin, functions, TODO: implement — Person B coordinates with infra.

### Community 45 - "SosButton.tsx"
Cohesion: 0.40
Nodes (3): Props, TODO: use react-native-gesture-handler for proper hold detection., styles

### Community 46 - "typescript"
Cohesion: 0.40
Nodes (5): typescript, typescript, typescript, typescript, typescript

### Community 47 - "@types/jest"
Cohesion: 0.40
Nodes (5): @types/jest, @types/jest, @types/jest, @types/jest, @types/jest

### Community 50 - "safety_score"
Cohesion: 0.50
Nodes (4): safety_score, maximum, minimum, type

## Knowledge Gaps
- **369 isolated node(s):** `HlcState`, `NowFn`, `DpMaskingParams`, `RoundInfo`, `VadParams` (+364 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `group_id` connect `required` to `route_contract.json`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Why does `HLC` connect `HLC` to `LocalQueue`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `compilerOptions`, `devDependencies`, `typescript`, `@types/jest`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **What connects `HlcState`, `NowFn`, `DpMaskingParams` to the rest of the system?**
  _369 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `HLC` be split into smaller, more focused modules?**
  _Cohesion score 0.07641196013289037 - nodes in this community are weakly interconnected._
- **Should `DpMasking` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._
- **Should `trackingService.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07822410147991543 - nodes in this community are weakly interconnected._