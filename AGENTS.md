# AGENTS.md

Repo-specific guidance for OpenCode sessions working in WeRide.
Read `README.md` and `WeRide_Project_Spec.md` first; this file only captures what those don't make obvious.

## Layout & ownership

Multi-package repo, **no workspace root** — each package has its own `package.json` and must be installed/tested independently. There is no top-level `package.json`, no monorepo tool (no npm workspaces, turborepo, pnpm).

- `app/` — React Native 0.73 shell (TypeScript). Entry: `app/index.js` → `app/src/App.tsx`. Owns navigation, screens, shared theme, Zustand store. `theme.ts` is owned by Person C (routing-eta); do not edit casually.
- `modules/tracking/` — Person A. EKF + anti-spoof. Pure TS, ts-jest.
- `modules/hazard-sos/` — Person B. DBSCAN + CRDT/OR-Set + HLC. Pure TS, ts-jest.
- `modules/routing-eta/` — Person C. **Two separate packages**: client TS in `modules/routing-eta/` (ts-jest), server JS in `modules/routing-eta/server/` (ESM, `node --test`). The server is the only Node.js backend and also hosts FL aggregation proxy (`/fl/*`) and VOX signaling (`/vox` namespace).
- `modules/fl-voice/` — Person D. FedProx + WebRTC VOX. Pure TS, ts-jest.
- `contracts/` — JSON schemas, source of truth. **No solo edits** — any change needs all 4 members' review (see `contracts/README.md`).
- `infra/firebase/functions/` — Cloud Functions (SOS FCM trigger), plain JS, deps installed separately.
- `docs/Development/` — per-person plans; authoritative for each owner's scope.

## Commands

Per-package: always `npm install` inside the package dir first. No root install.

```bash
# App (RN)
cd app && npm install
npm run lint && npm run typecheck && npm test
npm run ios | npm run android | npm start   # metro / run

# Module (TS) — tracking | hazard-sos | routing-eta | fl-voice
cd modules/<name> && npm install
npm run lint && npm run typecheck && npm test

# routing-eta server (separate package, ESM, node:test)
cd modules/routing-eta/server && npm install
npm test            # node --test server/test/
npm run dev         # node --watch, PORT env (default 3000)

# Firebase (only if touching infra/firebase)
cd infra/firebase/functions && npm install
```

Required order before considering a TS package done: **lint → typecheck → test** (CI enforces this order per job). Run all three in the package you touched, not just test.

Single test (Jest, TS packages): `npx jest <pattern>` from the package dir. Server (node --test): `node --test server/test/<file>.test.js`.

## TS path aliases (shared across all packages)

All TS packages use the same `@<name>/*` aliases pointing across packages (defined in each `tsconfig.json` and mirrored in `jest.config.js` `moduleNameMapper`). Do not add relative `../../` imports for cross-package code — use the alias:

- `@app/*`, `@contracts/*`, `@tracking/*`, `@hazard/*`, `@routing/*`, `@flvoice/*`

The aliases resolve relative to each package's own `baseUrl`, so they work from `app/` and from every `modules/*` without modification. If you add a new module, wire aliases into **all six** `tsconfig.json` + `jest.config.js` files, not just one.

## Jest quirks

- App uses `react-native` preset with `ts-jest` transform and `app/jest.setup.js` mocking MMKV, geolocation, sensors, `@rnmapbox/maps`. Tests live in `app/__tests__/` only (testMatch-restricted).
- Every TS module mirrors its own copy of `test/__mocks__/` (firebase, mmkv, sensors, geo, webrtc, socket). These are duplicated per module intentionally — if you change a mock, update the matching copies in the other modules if the native API surface changed.
- Module tests only match `test/**/*.test.ts` (not `src/`). Don't put tests in `src/`.
- `testEnvironment: 'node'` everywhere, even for RN-adjacent modules — native deps are mocked, not jsdom.

## ESM server gotcha

`modules/routing-eta/server/package.json` has `"type": "module"`. Use `import`/`export`, filenames use `.js` extension with ESM semantics. `node --test` (not Jest) runs `server/test/*.test.js`. Don't add a `jest.config.js` there.

## Firebase / secrets

- `google-services.json`, `GoogleService-Info.plist`, `firebase-adminsdk-*.json` are **not committed** (gitignored). Don't synthesize placeholders — local runs without them will fail at native link time; this is expected.
- Deploy Firestore rules: `firebase deploy --only firestore:rules` (from `infra/firebase/`). `firestore.rules` is the source of truth for collection security; `routes/` and `fl_rounds/` are server-write-only.
- Local dev: `firebase emulators:start --only firestore,auth`.

## Conventions

- ESLint: `@typescript-eslint/recommended`, `no-console: warn`, `no-explicit-any: off`, unused vars allowed if prefixed `_`. Shared base across app + modules.
- TS: `strict: true`, `esModuleInterop: true`, `jsx: react` (app only).
- `tsconfig.json` per package extends `@react-native/typescript-config` only in `app/`; modules use standalone configs.
- Contracts under `contracts/` are validated in CI by a trivial `python -m json.tool`-style loop — invalid JSON fails CI.

## CI

`infra/ci/ci.yml` runs separate jobs per package (app, tracking, hazard-sos, routing-eta [+server], fl-voice, contracts) on Node 20. Triggers: push to `main`/`feature/**`, PR to `main`. Each job does `npm install` in its own `working-directory` — there is no shared install step, mirroring the lack of a workspace root.