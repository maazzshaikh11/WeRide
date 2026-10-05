---
### Byte 1: The big picture — one app shell, four capability modules, frozen contracts
*Builds on:* None — starting point

*In plain terms:*
WeRide is a mobile app for riding motorcycles in a group. Instead of one big codebase, it is split into **four independent modules, each owning one capability**, plus a thin React Native **app shell** that wires them together. Modules never reach into each other's internals — they only exchange data in shapes defined by shared **contracts**.

*The code:*
```text
WeRide/
├── app/                    React Native shell: screens, navigation, stores, UI
├── modules/
│   ├── tracking/           Person A — GPS+sensor fusion, anti-spoofing, 1 Hz publishing
│   ├── hazard-sos/         Person B — hazard clustering, offline SOS (CRDT)
│   ├── routing-eta/        Person C — routing/ETA client + the Node.js server + group service
│   └── fl-voice/           Person D — federated learning + walkie-talkie voice (partly stubbed)
├── contracts/              JSON schemas: the "frozen" data shapes between modules
└── infra/                  Firestore rules, Cloud Function (SOS push), CI
```

*How it fits together:*
- **The app shell is glue.** `app/` owns screens, navigation and the Zustand stores, and imports module code through **path aliases** so cross-package imports never use `../../`:

```jsonc
// app/tsconfig.json (mirrored in every jest.config.js)
"paths": {
  "@app/*": ["src/*"],            "@tracking/*": ["../modules/tracking/src/*"],
  "@hazard/*": ["../modules/hazard-sos/src/*"],
  "@routing/*": ["../modules/routing-eta/src/*"],
  "@flvoice/*": ["../modules/fl-voice/src/*"],
  "@contracts/*": ["../contracts/*"]
}
```

- **Contracts are the seams.** `verified_location`, `hazard_cluster`, `sos_event`, `route_request/response`, `vox_signal` and `fl_model_update` are JSON schemas under `contracts/`. Changing one needs all four owners to agree — that is what lets four people work in parallel.
- **There is no root `package.json`.** Every package (app, each module, the server) is installed, linted and tested on its own; CI runs them as separate jobs.

*Why it is designed this way:* module logic (Kalman filter, DBSCAN, CRDT, routing) is **pure TypeScript** that can be unit-tested without a phone. Anything that touches native APIs (sensors, MMKV, Firebase) is mocked in tests, so each owner can iterate alone.

*Gotcha:* because there is no workspace, you must `npm install` inside each package you touch, and a module's own `node_modules` is what its tests resolve against.
