# WeRide

Group motorcycle/vehicle ride app: live tracking with anti-spoofing, crowdsourced hazards, offline-resilient SOS, safety-aware routing, privacy-preserving analytics, and hands-free voice.

**Stack:** React Native (TypeScript) · Zustand · MMKV · @rnmapbox/maps · Node.js backend · Firebase · WebRTC

## Repo layout

```
/app                → React Native (TypeScript) app shell, screens, navigation, shared theme
  /src
    /screens         → LoginScreen, GroupListScreen, MapScreen (+ overlays/)
    /services        → firebase, socket, MMKV storage
    /models          → TS interfaces for all 6 contracts
    /theme           → theme.ts (shared design system, owned by Person C)
    /store           → Zustand root store
    /navigation      → React Navigation stack
  /__tests__         → Jest unit tests
/modules
  /tracking         → Person A: EKF service + mobile sensor integration (src/*.ts)
  /hazard-sos        → Person B: DBSCAN + CRDT/HLC + offline queue (src/*.ts, ui/*.tsx)
  /routing-eta       → Person C: A* + LightGBM REST API + UI lead (src/*.ts, server/*.js)
  /fl-voice          → Person D: FedProx/FedOpt + WebRTC VOX (src/*.ts, ui/*.tsx)
/contracts          → JSON schema files (source of truth for §6, PR-reviewed by all 4)
/infra              → Firebase config, CI workflows, Cloud Functions
/docs               → Spec, meeting notes, report drafts
```

## Quick start

1. **Decisions locked Day 1** — see `WeRide_Project_Spec.md` §9 (RN, Zustand, MMKV, @rnmapbox/maps)
2. Each owner ships a mock of their output by end of Day 2, Week 1
3. See your plan: `Person_A_Tracking_AntiSpoofing.md`, `Person_B_Hazard_SOS.md`, `Person_C_Routing_ETA.md`, `Person_D_FL_VOX.md`

### Run the app

```bash
cd app
npm install
npm run ios        # or npm run android
```

### Run module tests

```bash
cd modules/tracking   && npm test   # Jest
cd modules/hazard-sos  && npm test
cd modules/routing-eta && npm test   # client (ts-jest); server: cd server && npm test
cd modules/fl-voice    && npm test
```

## Source of truth

`WeRide_Project_Spec.md` is the single reference. Any change must be edited there and announced in the weekly sync.