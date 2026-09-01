# Graph Report - WeRide  (2026-08-31)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1023 nodes · 1293 edges · 115 communities (99 shown, 16 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `aba93070`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- hazardSos.test.ts
- DpMasking
- trackingService.ts
- routingClient.ts
- paths
- GroupListScreen.tsx
- properties
- fl_model_update.json
- properties
- vox_signal.json
- properties
- astar.js
- sos_event.json
- compilerOptions
- devDependencies
- compilerOptions
- server/package.json
- dependencies
- MapScreen.tsx
- theme.ts
- app/package.json
- RouteOverlay.tsx
- devDependencies
- devDependencies
- devDependencies
- properties
- compilerOptions
- compilerOptions
- compilerOptions
- dependencies
- WeRideColors
- required
- functions/package.json
- devDependencies
- required
- required
- destination
- group_id
- verified_location.json
- fl-voice/package.json
- hazard-sos/package.json
- routing-eta/package.json
- tracking/package.json
- node_modules
- hazard_cluster.json
- properties
- items
- required
- required
- SosOverlay.tsx
- VoxOverlay.tsx
- route_contract.json
- origin
- status
- hazard_report.json
- functions/index.js
- fl-voice/tsconfig.json
- SosButton.tsx
- routing-eta/tsconfig.json
- eslint
- geoUtils.ts
- safety_score
- FlStatusIndicator.tsx
- HazardService
- netinfoMock.js
- @react-native-firebase/app
- @react-native-firebase/firestore
- MusicWidget.tsx
- eta_model.js
- road_graph.js
- collect_directions.py
- react-native-background-geolocation
- react-native
- react-native-geolocation-service
- @react-native-ml-kit/text-recognition
- react-native-safe-area-context
- react-native-screens
- react-native-webrtc
- @react-navigation/native
- @react-navigation/stack

## God Nodes (most connected - your core abstractions)
1. `HLC` - 23 edges
2. `compilerOptions` - 12 edges
3. `WeRideColors` - 12 edges
4. `DpMasking` - 11 edges
5. `Ekf` - 11 edges
6. `compilerOptions` - 11 edges
7. `compilerOptions` - 11 edges
8. `compilerOptions` - 11 edges
9. `required` - 11 edges
10. `required` - 11 edges

## Surprising Connections (you probably didn't know these)
- `exclude` --extends--> `node_modules`  [EXTRACTED]
  modules/hazard-sos/tsconfig.json → app/tsconfig.json
- `exclude` --extends--> `node_modules`  [EXTRACTED]
  modules/fl-voice/tsconfig.json → app/tsconfig.json
- `exclude` --extends--> `node_modules`  [EXTRACTED]
  modules/routing-eta/tsconfig.json → app/tsconfig.json
- `RoutingClientParams` --references--> `RouteResponse`  [EXTRACTED]
  modules/routing-eta/src/client/routingClient.ts → app/src/models/routeResponse.ts
- `RoutePanel()` --calls--> `safetyScoreColor()`  [EXTRACTED]
  modules/routing-eta/src/client/RoutePanel.tsx → app/src/theme/theme.ts

## Import Cycles
- None detected.

## Communities (115 total, 16 thin omitted)

### Community 0 - "hazardSos.test.ts"
Cohesion: 0.05
Nodes (63): getQueueStorage(), HAZARD_QUEUE, queueClear(), queueDequeue(), QueuedOperation, queueEnqueue(), queuePeek(), queueSize() (+55 more)

### Community 1 - "DpMasking"
Cohesion: 0.05
Nodes (19): DpMasking, DpMaskingParams, FlClient, FlClientParams, TODO: wire to TFLite for actual model training. For now: stub the training step., TODO: TFLite training loop with FedProx proximal term, FlRoundLogger, RoundInfo (+11 more)

### Community 2 - "trackingService.ts"
Cohesion: 0.08
Nodes (17): Ekf, EkfParams, TODO: proper Jacobian + covariance propagation, LocationPublisher, LocationPublisherParams, VerifiedLocationPayload, MockLocationProducer, MockLocationProducerParams (+9 more)

### Community 3 - "routingClient.ts"
Cohesion: 0.08
Nodes (13): HazardCluster, HazardStatus, HazardType, RouteRequest, routeRequestToJson(), RouteResponse, routeResponseFromJson(), SosEvent (+5 more)

### Community 4 - "paths"
Cohesion: 0.08
Nodes (35): ../contracts/*, @contracts/*, paths, ../../app/src/*, ../fl-voice/src/*, ../hazard-sos/src/*, ../routing-eta/src/*, ../tracking/src/* (+27 more)

### Community 5 - "GroupListScreen.tsx"
Cohesion: 0.10
Nodes (20): displayName, name, App(), RootStack(), RootStackParamList, Stack, GroupListScreen(), TODO: subscribe to groups where member_ids contains uid via onSnapshot (+12 more)

### Community 6 - "properties"
Cohesion: 0.07
Nodes (31): enum, type, oil_spill, other, hazard_type, type, enum, type (+23 more)

### Community 7 - "fl_model_update.json"
Cohesion: 0.07
Nodes (27): description, type, description, type, description, type, privacy, properties (+19 more)

### Community 8 - "properties"
Cohesion: 0.07
Nodes (28): type, type, type, description, type, type, description, maximum (+20 more)

### Community 9 - "vox_signal.json"
Cohesion: 0.07
Nodes (27): null, string, resolved_at_hlc, description, type, description, type, description (+19 more)

### Community 10 - "properties"
Cohesion: 0.07
Nodes (27): description, type, description, type, type, type, type, description (+19 more)

### Community 11 - "astar.js"
Cohesion: 0.12
Nodes (17): applyHazardPenalties(), astar(), handleRoute(), haversineMeters(), MinHeap, TODO: load road graph for the bbox (Option A: use Directions API; Option B: OSM…, TODO: fetch active hazards from Firestore, filter by avoid_hazard_types, TODO: applyHazardPenalties, run astar, compute safety_score, call ETA model (+9 more)

### Community 12 - "sos_event.json"
Cohesion: 0.08
Nodes (25): crdt, description, type, description, type, type, type, properties (+17 more)

### Community 13 - "compilerOptions"
Cohesion: 0.09
Nodes (22): @react-native/typescript-config, compilerOptions, baseUrl, esModuleInterop, jsx, paths, skipLibCheck, strict (+14 more)

### Community 14 - "devDependencies"
Cohesion: 0.10
Nodes (21): devDependencies, @babel/core, babel-jest, @babel/preset-env, jest, metro-react-native-babel-preset, react-test-renderer, ts-jest (+13 more)

### Community 15 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, baseUrl, esModuleInterop, jsx, lib, module, outDir, skipLibCheck (+9 more)

### Community 16 - "server/package.json"
Cohesion: 0.12
Nodes (15): cors, express, dependencies, cors, express, socket.io, description, name (+7 more)

### Community 17 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, react, @react-native-firebase/auth, @react-native-firebase/messaging, react-native-sensors, @rnmapbox/maps, socket.io-client, zustand (+7 more)

### Community 18 - "MapScreen.tsx"
Cohesion: 0.19
Nodes (9): styles, FlStatusOverlay(), TODO: wire to local FL round logger state, styles, HazardOverlay(), TODO: show HazardReportSheet (bottom sheet with type picker), TODO: wire to Firestore hazards/ listener filtered by group_id, TODO: wire to Socket.io location:update listener, render Mapbox shape sources (+1 more)

### Community 19 - "theme.ts"
Cohesion: 0.23
Nodes (9): hazardColor(), HazardType, hazardMarkerColor(), HazardMarkerData, TODO: wire to HazardService.watchClusters stream, render Mapbox ShapeSources, HazardReportSheet(), Props, styles (+1 more)

### Community 20 - "app/package.json"
Cohesion: 0.17
Nodes (11): description, name, private, scripts, android, ios, lint, start (+3 more)

### Community 21 - "RouteOverlay.tsx"
Cohesion: 0.20
Nodes (10): TODO: Google Maps deep link (intent URL — Linking.openURL), TODO: wire to RoutingClient (calls POST /route), TODO: collapsed/expanded bottom sheet states, RouteOverlay(), styles, safetyScoreColor(), Props, TODO: collapsed/expanded bottom sheet states, turn list, Google Maps intent URL… (+2 more)

### Community 22 - "devDependencies"
Cohesion: 0.17
Nodes (12): @types/node, @types/node, devDependencies, eslint, jest, ts-jest, @types/jest, @types/node (+4 more)

### Community 23 - "devDependencies"
Cohesion: 0.18
Nodes (11): @types/jest, @types/jest, devDependencies, eslint, jest, ts-jest, @types/jest, @types/node (+3 more)

### Community 24 - "devDependencies"
Cohesion: 0.18
Nodes (11): typescript, devDependencies, jest, ts-jest, @types/jest, typescript, jest, ts-jest (+3 more)

### Community 25 - "properties"
Cohesion: 0.18
Nodes (11): type, type, distance_km, eta_minutes, recalculated_at_hlc, route_id, description, type (+3 more)

### Community 26 - "compilerOptions"
Cohesion: 0.18
Nodes (11): compilerOptions, baseUrl, esModuleInterop, jsx, lib, module, outDir, skipLibCheck (+3 more)

### Community 27 - "compilerOptions"
Cohesion: 0.18
Nodes (11): compilerOptions, baseUrl, esModuleInterop, jsx, lib, module, outDir, skipLibCheck (+3 more)

### Community 28 - "compilerOptions"
Cohesion: 0.18
Nodes (11): compilerOptions, baseUrl, esModuleInterop, jsx, lib, module, outDir, skipLibCheck (+3 more)

### Community 29 - "dependencies"
Cohesion: 0.22
Nodes (9): react-native-mmkv, uuid, dependencies, @react-native-community/netinfo, react-native-mmkv, uuid, @react-native-community/netinfo, react-native-mmkv (+1 more)

### Community 30 - "WeRideColors"
Cohesion: 0.22
Nodes (5): WeRideColors, TODO: wire to VoxClient + Vad., styles, Props, styles

### Community 31 - "required"
Cohesion: 0.22
Nodes (9): lat, lng, rider_id, required, accuracy_m, heading_deg, nis_score, speed_mps (+1 more)

### Community 32 - "functions/package.json"
Cohesion: 0.22
Nodes (8): firebase-admin, firebase-functions, dependencies, firebase-admin, firebase-functions, description, main, name

### Community 33 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, jest, ts-jest, @typescript-eslint/eslint-plugin, @typescript-eslint/parser, jest, ts-jest, @typescript-eslint/eslint-plugin (+1 more)

### Community 34 - "required"
Cohesion: 0.25
Nodes (8): required, centroid_lat, centroid_lng, cluster_id, hazard_score, polygon_points, report_count, status

### Community 35 - "required"
Cohesion: 0.25
Nodes (8): hazard_type, lat, lng, rider_id, timestamp_hlc, required, report_id, reported_at_hlc

### Community 36 - "destination"
Cohesion: 0.29
Nodes (8): properties, type, type, type, properties, destination, lat, lng

### Community 37 - "group_id"
Cohesion: 0.25
Nodes (8): required, group_id, rider_id, required, avoid_hazard_types, destination, origin, voice_active

### Community 38 - "verified_location.json"
Cohesion: 0.25
Nodes (7): description, $schema, title, transport, live, persisted, type

### Community 39 - "fl-voice/package.json"
Cohesion: 0.25
Nodes (7): name, private, scripts, lint, test, typecheck, version

### Community 40 - "hazard-sos/package.json"
Cohesion: 0.25
Nodes (7): name, private, scripts, lint, test, typecheck, version

### Community 41 - "routing-eta/package.json"
Cohesion: 0.25
Nodes (7): name, private, scripts, lint, test, typecheck, version

### Community 42 - "tracking/package.json"
Cohesion: 0.25
Nodes (7): name, private, scripts, lint, test, typecheck, version

### Community 43 - "node_modules"
Cohesion: 0.29
Nodes (6): exclude, node_modules, exclude, include, src/**/*, test/**/*

### Community 44 - "hazard_cluster.json"
Cohesion: 0.29
Nodes (6): description, $schema, title, transport, persisted, type

### Community 45 - "properties"
Cohesion: 0.29
Nodes (7): items, type, type, avoid_hazard_types, group_id, request, properties

### Community 46 - "items"
Cohesion: 0.33
Nodes (7): items, maxItems, minItems, type, items, type, path_points

### Community 47 - "required"
Cohesion: 0.29
Nodes (7): required, distance_km, eta_minutes, path_points, recalculated_at_hlc, route_id, safety_score

### Community 48 - "required"
Cohesion: 0.29
Nodes (7): created_at_hlc, lat, lng, rider_id, required, resolved_at_hlc, sos_id

### Community 49 - "SosOverlay.tsx"
Cohesion: 0.33
Nodes (5): TODO: implement hold/double-tap gesture (use react-native-gesture-handler), TODO: wire to SosService (local CRDT queue + Firestore sync + FCM), TODO: replace with hold/double-tap gesture — single tap must NOT trigger, SosOverlay(), styles

### Community 50 - "VoxOverlay.tsx"
Cohesion: 0.33
Nodes (5): TODO: wire to VoxClient (WebRTC + /vox signaling), TODO: implement VAD-driven voice_active broadcast, TODO: PTT fallback button in manual mode, styles, VoxOverlay()

### Community 51 - "route_contract.json"
Cohesion: 0.33
Nodes (5): description, $schema, title, transport, type

### Community 52 - "origin"
Cohesion: 0.40
Nodes (6): required, lat, lng, required, type, origin

### Community 53 - "status"
Cohesion: 0.40
Nodes (5): status, enum, type, resolved, active

### Community 54 - "hazard_report.json"
Cohesion: 0.40
Nodes (4): description, $schema, title, type

### Community 55 - "functions/index.js"
Cohesion: 0.40
Nodes (3): admin, functions, TODO: implement — Person B coordinates with infra.

### Community 56 - "fl-voice/tsconfig.json"
Cohesion: 0.40
Nodes (4): exclude, include, src/**/*, test/**/*

### Community 57 - "SosButton.tsx"
Cohesion: 0.40
Nodes (3): Props, TODO: use react-native-gesture-handler for proper hold detection., styles

### Community 58 - "routing-eta/tsconfig.json"
Cohesion: 0.40
Nodes (4): exclude, include, src/**/*, test/**/*

### Community 59 - "eslint"
Cohesion: 0.50
Nodes (4): eslint, eslint, eslint, eslint

### Community 62 - "safety_score"
Cohesion: 0.50
Nodes (4): safety_score, maximum, minimum, type

### Community 65 - "netinfoMock.js"
Cohesion: 0.50
Nodes (3): listeners, mockNetworkState, NetInfo

### Community 66 - "@react-native-firebase/app"
Cohesion: 0.67
Nodes (3): @react-native-firebase/app, @react-native-firebase/app, @react-native-firebase/app

### Community 67 - "@react-native-firebase/firestore"
Cohesion: 0.67
Nodes (3): @react-native-firebase/firestore, @react-native-firebase/firestore, @react-native-firebase/firestore

## Knowledge Gaps
- **372 isolated node(s):** `HlcState`, `NowFn`, `DBCluster`, `HazardClusterResult`, `HazardReportLegacy` (+367 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `group_id` connect `group_id` to `required`, `required`, `required`, `required`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Why does `required` connect `group_id` to `properties`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `required` connect `required` to `required`, `required`, `hazard_cluster.json`, `group_id`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **What connects `HlcState`, `NowFn`, `DBCluster` to the rest of the system?**
  _372 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `hazardSos.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05083986562150056 - nodes in this community are weakly interconnected._
- **Should `DpMasking` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._
- **Should `trackingService.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07822410147991543 - nodes in this community are weakly interconnected._