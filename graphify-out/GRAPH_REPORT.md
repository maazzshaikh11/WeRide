# Graph Report - WeRide  (2026-08-31)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1030 nodes · 1357 edges · 110 communities (95 shown, 15 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `aba93070`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- hazardSos.test.ts
- DpMasking
- sos_event.json
- trackingService.ts
- routingClient.ts
- paths
- devDependencies
- properties
- fl_model_update.json
- properties
- properties
- astar.js
- compilerOptions
- GroupListScreen.tsx
- MapScreen.tsx
- compilerOptions
- server/package.json
- dependencies
- properties
- WeRideColors
- theme.ts
- App.tsx
- RouteOverlay.tsx
- required
- devDependencies
- devDependencies
- route_contract.json
- devDependencies
- compilerOptions
- compilerOptions
- compilerOptions
- vox_signal.json
- devDependencies
- dependencies
- required
- functions/package.json
- required
- required
- properties
- verified_location.json
- fl-voice/package.json
- hazard-sos/package.json
- routing-eta/package.json
- tracking/package.json
- node_modules
- hazard_cluster.json
- items
- required
- SosOverlay.tsx
- properties
- origin
- hazard_report.json
- functions/index.js
- fl-voice/tsconfig.json
- routing-eta/tsconfig.json
- @types/jest
- geoUtils.ts
- FlStatusIndicator.tsx
- netinfoMock.js
- @react-native-firebase/app
- @react-native-firebase/firestore
- MusicWidget.tsx
- eta_model.js
- road_graph.js
- collect_directions.py
- @types/node
- react-native-background-geolocation
- react-native-geolocation-service
- @react-native-ml-kit/text-recognition
- react-native-safe-area-context
- react-native-screens
- react-native-webrtc
- @react-navigation/native
- @react-navigation/stack
- @react-native-firebase/messaging

## God Nodes (most connected - your core abstractions)
1. `HLC` - 21 edges
2. `compilerOptions` - 12 edges
3. `WeRideColors` - 12 edges
4. `DpMasking` - 11 edges
5. `Ekf` - 11 edges
6. `orSetLoad()` - 11 edges
7. `triggerClustering()` - 11 edges
8. `compilerOptions` - 11 edges
9. `compilerOptions` - 11 edges
10. `compilerOptions` - 11 edges

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

## Communities (110 total, 15 thin omitted)

### Community 0 - "hazardSos.test.ts"
Cohesion: 0.05
Nodes (72): getQueueStorage(), HAZARD_QUEUE, queueClear(), queueDequeue(), QueuedOperation, queueEnqueue(), queuePeek(), queueSize() (+64 more)

### Community 1 - "DpMasking"
Cohesion: 0.05
Nodes (19): DpMasking, DpMaskingParams, FlClient, FlClientParams, TODO: wire to TFLite for actual model training. For now: stub the training step., TODO: TFLite training loop with FedProx proximal term, FlRoundLogger, RoundInfo (+11 more)

### Community 2 - "sos_event.json"
Cohesion: 0.04
Nodes (47): crdt, description, type, description, type, null, string, type (+39 more)

### Community 3 - "trackingService.ts"
Cohesion: 0.08
Nodes (17): Ekf, EkfParams, TODO: proper Jacobian + covariance propagation, LocationPublisher, LocationPublisherParams, VerifiedLocationPayload, MockLocationProducer, MockLocationProducerParams (+9 more)

### Community 4 - "routingClient.ts"
Cohesion: 0.08
Nodes (13): HazardCluster, HazardStatus, HazardType, RouteRequest, routeRequestToJson(), RouteResponse, routeResponseFromJson(), SosEvent (+5 more)

### Community 5 - "paths"
Cohesion: 0.08
Nodes (35): ../contracts/*, @contracts/*, paths, ../../app/src/*, ../fl-voice/src/*, ../hazard-sos/src/*, ../routing-eta/src/*, ../tracking/src/* (+27 more)

### Community 6 - "devDependencies"
Cohesion: 0.06
Nodes (32): description, devDependencies, @babel/core, babel-jest, @babel/preset-env, jest, metro-react-native-babel-preset, react-test-renderer (+24 more)

### Community 7 - "properties"
Cohesion: 0.07
Nodes (31): enum, type, oil_spill, other, hazard_type, type, enum, type (+23 more)

### Community 8 - "fl_model_update.json"
Cohesion: 0.07
Nodes (27): description, type, description, type, description, type, privacy, properties (+19 more)

### Community 9 - "properties"
Cohesion: 0.07
Nodes (28): type, type, type, description, type, type, description, maximum (+20 more)

### Community 10 - "properties"
Cohesion: 0.07
Nodes (27): description, type, description, type, type, type, type, description (+19 more)

### Community 11 - "astar.js"
Cohesion: 0.12
Nodes (17): applyHazardPenalties(), astar(), handleRoute(), haversineMeters(), MinHeap, TODO: load road graph for the bbox (Option A: use Directions API; Option B: OSM…, TODO: fetch active hazards from Firestore, filter by avoid_hazard_types, TODO: applyHazardPenalties, run astar, compute safety_score, call ETA model (+9 more)

### Community 12 - "compilerOptions"
Cohesion: 0.09
Nodes (22): @react-native/typescript-config, compilerOptions, baseUrl, esModuleInterop, jsx, paths, skipLibCheck, strict (+14 more)

### Community 13 - "GroupListScreen.tsx"
Cohesion: 0.16
Nodes (15): RootStack(), RootStackParamList, Stack, GroupListScreen(), TODO: subscribe to groups where member_ids contains uid via onSnapshot, styles, LoginScreen(), styles (+7 more)

### Community 14 - "MapScreen.tsx"
Cohesion: 0.13
Nodes (14): styles, FlStatusOverlay(), TODO: wire to local FL round logger state, styles, HazardOverlay(), TODO: show HazardReportSheet (bottom sheet with type picker), TODO: wire to Firestore hazards/ listener filtered by group_id, TODO: wire to Socket.io location:update listener, render Mapbox shape sources (+6 more)

### Community 15 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, baseUrl, esModuleInterop, jsx, lib, module, outDir, skipLibCheck (+9 more)

### Community 16 - "server/package.json"
Cohesion: 0.12
Nodes (15): cors, express, dependencies, cors, express, socket.io, description, name (+7 more)

### Community 17 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, react, react-native, @react-native-firebase/auth, react-native-sensors, @rnmapbox/maps, socket.io-client, zustand (+7 more)

### Community 18 - "properties"
Cohesion: 0.13
Nodes (15): type, type, distance_km, eta_minutes, recalculated_at_hlc, route_id, safety_score, description (+7 more)

### Community 19 - "WeRideColors"
Cohesion: 0.14
Nodes (8): WeRideColors, TODO: wire to VoxClient + Vad., styles, Props, styles, Props, TODO: use react-native-gesture-handler for proper hold detection., styles

### Community 20 - "theme.ts"
Cohesion: 0.23
Nodes (9): hazardColor(), HazardType, hazardMarkerColor(), HazardMarkerData, TODO: wire to HazardService.watchClusters stream, render Mapbox ShapeSources, HazardReportSheet(), Props, styles (+1 more)

### Community 21 - "App.tsx"
Cohesion: 0.24
Nodes (5): displayName, name, App(), initFirebase(), initStorage()

### Community 22 - "RouteOverlay.tsx"
Cohesion: 0.20
Nodes (10): TODO: Google Maps deep link (intent URL — Linking.openURL), TODO: wire to RoutingClient (calls POST /route), TODO: collapsed/expanded bottom sheet states, RouteOverlay(), styles, safetyScoreColor(), Props, TODO: collapsed/expanded bottom sheet states, turn list, Google Maps intent URL… (+2 more)

### Community 23 - "required"
Cohesion: 0.17
Nodes (12): status, enum, type, created_at_hlc, lat, lng, resolved, rider_id (+4 more)

### Community 24 - "devDependencies"
Cohesion: 0.18
Nodes (11): eslint, eslint, devDependencies, eslint, jest, ts-jest, @types/jest, jest (+3 more)

### Community 25 - "devDependencies"
Cohesion: 0.18
Nodes (11): typescript, typescript, typescript, devDependencies, eslint, jest, ts-jest, typescript (+3 more)

### Community 26 - "route_contract.json"
Cohesion: 0.18
Nodes (10): description, request, required, $schema, title, transport, type, avoid_hazard_types (+2 more)

### Community 27 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, jest, ts-jest, @types/jest, typescript, jest, ts-jest

### Community 28 - "compilerOptions"
Cohesion: 0.18
Nodes (11): compilerOptions, baseUrl, esModuleInterop, jsx, lib, module, outDir, skipLibCheck (+3 more)

### Community 29 - "compilerOptions"
Cohesion: 0.18
Nodes (11): compilerOptions, baseUrl, esModuleInterop, jsx, lib, module, outDir, skipLibCheck (+3 more)

### Community 30 - "compilerOptions"
Cohesion: 0.18
Nodes (11): compilerOptions, baseUrl, esModuleInterop, jsx, lib, module, outDir, skipLibCheck (+3 more)

### Community 31 - "vox_signal.json"
Cohesion: 0.20
Nodes (9): group_id, description, rider_id, required, $schema, title, transport, type (+1 more)

### Community 32 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, jest, ts-jest, @types/node, @typescript-eslint/eslint-plugin, @typescript-eslint/parser, jest, ts-jest (+2 more)

### Community 33 - "dependencies"
Cohesion: 0.22
Nodes (9): react-native-mmkv, uuid, dependencies, @react-native-community/netinfo, react-native-mmkv, uuid, @react-native-community/netinfo, react-native-mmkv (+1 more)

### Community 34 - "required"
Cohesion: 0.22
Nodes (9): lat, lng, rider_id, required, accuracy_m, heading_deg, nis_score, speed_mps (+1 more)

### Community 35 - "functions/package.json"
Cohesion: 0.22
Nodes (8): firebase-admin, firebase-functions, dependencies, firebase-admin, firebase-functions, description, main, name

### Community 36 - "required"
Cohesion: 0.25
Nodes (8): required, centroid_lat, centroid_lng, cluster_id, hazard_score, polygon_points, report_count, status

### Community 37 - "required"
Cohesion: 0.25
Nodes (8): hazard_type, lat, lng, rider_id, timestamp_hlc, required, report_id, reported_at_hlc

### Community 38 - "properties"
Cohesion: 0.25
Nodes (8): items, type, type, type, avoid_hazard_types, destination, group_id, properties

### Community 39 - "verified_location.json"
Cohesion: 0.25
Nodes (7): description, $schema, title, transport, live, persisted, type

### Community 40 - "fl-voice/package.json"
Cohesion: 0.25
Nodes (7): name, private, scripts, lint, test, typecheck, version

### Community 41 - "hazard-sos/package.json"
Cohesion: 0.25
Nodes (7): name, private, scripts, lint, test, typecheck, version

### Community 42 - "routing-eta/package.json"
Cohesion: 0.25
Nodes (7): name, private, scripts, lint, test, typecheck, version

### Community 43 - "tracking/package.json"
Cohesion: 0.25
Nodes (7): name, private, scripts, lint, test, typecheck, version

### Community 44 - "node_modules"
Cohesion: 0.29
Nodes (6): exclude, node_modules, exclude, include, src/**/*, test/**/*

### Community 45 - "hazard_cluster.json"
Cohesion: 0.29
Nodes (6): description, $schema, title, transport, persisted, type

### Community 46 - "items"
Cohesion: 0.33
Nodes (7): items, maxItems, minItems, type, items, type, path_points

### Community 47 - "required"
Cohesion: 0.29
Nodes (7): required, distance_km, eta_minutes, path_points, recalculated_at_hlc, route_id, safety_score

### Community 48 - "SosOverlay.tsx"
Cohesion: 0.33
Nodes (5): TODO: implement hold/double-tap gesture (use react-native-gesture-handler), TODO: wire to SosService (local CRDT queue + Firestore sync + FCM), TODO: replace with hold/double-tap gesture — single tap must NOT trigger, SosOverlay(), styles

### Community 49 - "properties"
Cohesion: 0.40
Nodes (6): properties, type, type, properties, lat, lng

### Community 50 - "origin"
Cohesion: 0.40
Nodes (6): required, lat, lng, required, type, origin

### Community 51 - "hazard_report.json"
Cohesion: 0.40
Nodes (4): description, $schema, title, type

### Community 52 - "functions/index.js"
Cohesion: 0.40
Nodes (3): admin, functions, TODO: implement — Person B coordinates with infra.

### Community 53 - "fl-voice/tsconfig.json"
Cohesion: 0.40
Nodes (4): exclude, include, src/**/*, test/**/*

### Community 54 - "routing-eta/tsconfig.json"
Cohesion: 0.40
Nodes (4): exclude, include, src/**/*, test/**/*

### Community 55 - "@types/jest"
Cohesion: 0.50
Nodes (4): @types/jest, @types/jest, @types/jest, @types/jest

### Community 59 - "netinfoMock.js"
Cohesion: 0.50
Nodes (3): listeners, mockNetworkState, NetInfo

### Community 60 - "@react-native-firebase/app"
Cohesion: 0.67
Nodes (3): @react-native-firebase/app, @react-native-firebase/app, @react-native-firebase/app

### Community 61 - "@react-native-firebase/firestore"
Cohesion: 0.67
Nodes (3): @react-native-firebase/firestore, @react-native-firebase/firestore, @react-native-firebase/firestore

### Community 66 - "@types/node"
Cohesion: 0.50
Nodes (4): @types/node, @types/node, @types/node, @types/node

## Knowledge Gaps
- **377 isolated node(s):** `SosEvent`, `DBCluster`, `HazardClusterResult`, `HazardReportLegacy`, `HlcState` (+372 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `group_id` connect `vox_signal.json` to `required`, `required`, `required`, `required`, `route_contract.json`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Why does `required` connect `required` to `required`, `vox_signal.json`, `hazard_cluster.json`, `required`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Why does `required` connect `route_contract.json` to `vox_signal.json`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **What connects `SosEvent`, `DBCluster`, `HazardClusterResult` to the rest of the system?**
  _377 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `hazardSos.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.054705003734129946 - nodes in this community are weakly interconnected._
- **Should `DpMasking` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._
- **Should `sos_event.json` be split into smaller, more focused modules?**
  _Cohesion score 0.041666666666666664 - nodes in this community are weakly interconnected._