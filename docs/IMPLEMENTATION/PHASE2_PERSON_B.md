# Phase 2 — Person B (Hazard + SOS) — Implementation Log

**Date:** 2026-09-26 · **Status: PASS**

## What was done

### B-P1-6 — `submitHazardReport` online path: zero data loss (FIXED)
`modules/hazard-sos/src/services/hazardService.ts`
- Online Firestore write is now wrapped in try/catch. If the write fails after the
  connectivity check passed (rules denial, mid-write network drop, Firestore outage),
  the report falls through to the offline queue instead of propagating as a lost report.
- The offline enqueue was extracted into `enqueueHazardReport()` so both paths share it.
- **Deliberate API change:** returns `Promise<{ report, queued }>` instead of
  `Promise<HazardReport>`. Callers need to know which outcome happened to show the
  honest confirmation ("Hazard reported" vs "saved — will sync when you're back online").
  Tests updated to the new shape (same assertions on `.report`, plus new `queued` assertions) —
  not weakened; one new test added for the online-write-fails path.
- Callers updated: `HazardReportSheet` (uses `queued`, drops its racy pre-submit
  `isOnline()` check — the flag is now authoritative), `AlertsScreen`
  (uses `queued`; its catch block now means "truly unexpected failure", message updated).

### B-P0-1 (residual) — `triggerClustering` HLC parse (FIXED)
`modules/hazard-sos/src/services/hazardService.ts` — the `.split('-')` on
`reported_at_hlc` is now `HLC.parse(...).physical`. Robust to both the canonical
colon format and legacy dash-format reports still sitting in old queues.
(The dash→colon canonicalization itself was done earlier in Phase 2.)

### B-P0-3 — Firestore rules for `groups/{groupId}/reports` (FIXED)
`infra/firebase/firestore.rules`
- `create`: now requires group membership **and** binds `rider_id == auth.uid`
  **and** `group_id == <path groupId>` (no cross-group writes). Previously any authed
  user could write anywhere.
- `update`: allowed for group members (was denied entirely).
- `read`: member-scoped (unchanged). `delete`: denied (unchanged).

### B-P0-4 — Mount hazard report UI + sync worker (FIXED)
- `app/src/screens/map/MapScreen.tsx`: `HazardReportButton` FAB added to the FAB column;
  `HazardReportSheet` mounted with explicit `groupId`, `riderId`, and the verified
  `currentLocation` (lat/lng + `timestamp_hlc` + `spoof_flag` from Person A's stream).
  SOS was already mounted (`SosFab` + `SosModal`) via the user's commit — verified.
- `app/src/App.tsx`: new `SyncBootstrap` — starts `startSyncWorker(groupId)` for the
  active group, runs one cold-start sync pass (`syncHazardReports` → `syncSosEvents` →
  `mergeSosOnSync`), restarts on group switch, stops on unmount. B-P1-7 closed by the same change.

### B-P0-5 — FCM token persistence (FIXED)
`app/src/services/firebaseService.ts` — new `saveFcmToken(uid, token?)` writes
`users/{uid}.fcm_token` (merge). Called after login in `LoginScreen` (best-effort,
never blocks login) and on `onTokenRefresh` in `initFirebase`. The `onSosCreate`
Cloud Function already reads this field — the loop is now closed. Rules already
allow a user to write their own `users/{uid}` doc.

### B-P2-9 — Demo fallbacks removed; dead code deleted (FIXED)
- `HazardReportSheet`: `?? 'demo-group'` / `?? 'demo-rider'` replaced with `null`;
  submit is blocked with "No active ride — join a group before reporting a hazard."
  Props remain optional for the standalone/test case; MapScreen passes real values.
- `modules/hazard-sos/src/ui/hazardMarker.ts`: deleted (verified zero imports repo-wide
  via grep before `git rm`).
- Note: `SosButton` (module) is unmounted in the app but is **kept** — it's module public
  API with test coverage (`phase6-ui-test-final.tsx`); the app's `SosFab`+`SosModal`
  is the chosen UX. Not dead code.

### B-P1-8 — Clustering authority: DECIDED (documented deviation from plan)
**Decision: client-side clustering stays the authority for now.**
- The plan leaned toward server-side clustering (Cloud Function). Keeping it client-side:
  the code is real, tested (133 tests), works offline — and a server-side port would need
  a new Cloud Function with Firestore admin + DBSCAN that cannot be runtime-verified in
  this environment (no emulator, no Firebase project).
- **Known wart, recorded:** two clients clustering the same reports simultaneously can
  produce duplicate clusters; centroid-proximity matching only converges them on later
  runs. Server-side clustering remains the follow-up when a Firebase project is available.

### Test-only fix (app jest config)
`app/jest.config.js` — added `'^react-native$': '<rootDir>/node_modules/react-native'`
to `moduleNameMapper`. Importing `@hazard/ui/*` components into MapScreen pulled the
module's own `react-native` copy under jest (unmocked → invariant violation), failing
`mapScreen.test.tsx`. Same dedup pattern the config already used for `react`/`zustand`.
Runtime is unaffected (Metro resolves one copy from the app root).

## Verification
| Package | Lint | Typecheck | Tests |
|---|---|---|---|
| modules/hazard-sos | 0 errors (14 pre-existing `no-console` warnings) | clean | **133/133** (5 suites; +1 new online-failure test) |
| app | 0 errors (56 warnings, pre-existing patterns) | clean | **136/136** (9 suites) |

Commands used (module bins invoked directly — `npm run` scripts can't link bins on this VM's overlay FS):
`node node_modules/eslint/bin/eslint.js src --ext .ts,.tsx`,
`node node_modules/typescript/bin/tsc --noEmit`,
`node node_modules/jest/bin/jest.js`.

## Method notes
- Read fully before editing: `hazardService.ts` (submit + clustering), `HazardReportSheet.tsx`,
  `syncWorker.ts` (1–140), `App.tsx`, `firebaseService.ts`, `LoginScreen.tsx`,
  `AlertsScreen.tsx` (submit path), `MapScreen.tsx` (imports, FAB column, modal area),
  `firestore.rules` (reports section), `jest.config.js`.
- Grep-verified: `hazardMarker.ts` zero imports; `SosButton` only in module index + module test;
  `HazardReportButton`/`HazardReportSheet` previously unmounted in `app/src`.
- Firestore rules changes are **not runtime-verified** (no emulator/Java in this VM) — syntax
  follows the file's existing patterns; flag for CI/emulator before deploy.
- Nothing committed yet; all work is uncommitted on top of `3570fde`.
