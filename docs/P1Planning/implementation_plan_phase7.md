# Phase 7 Implementation Plan — Tests

This document outlines the tasks for Phase 7, separating the work that was already achieved in previous phases from the work that remains.

## Current Git State
- **Staged/Committed**: All Phase 0–6 integration work has been successfully committed in `c4a227b`.
- **Unstaged Changes**:
  - `modules/tracking/src/ekf.ts` (Full Jacobian F, Joseph form covariance update, NIS chi-squared support).
  - `modules/tracking/src/sensorStream.ts` (Background geolocation and downsampling logic).
  - `modules/tracking/test/ekf.test.ts` (Minor whitespace fix).
  - `modules/tracking/README.md`
- **Untracked Files**: 
  - Several AI agent cache folders (`.agents/`, `.kiro/`, `.opencode/`).
  - `graphify-out/` and `docs/P1Planning/` documentation folder.
  - `opencode.json` and `modules/tracking/package-lock.json`.

> **Note on Unstaged Files**: The unstaged changes in `ekf.ts` and `sensorStream.ts` represent the core Phase 1 (Mathematical algorithm) and Phase 2 (Sensors) implementations. Although these are technically Phase 1 & 2 tasks, they were left unstaged. They are **strictly required** for the Phase 7 tests (specifically `ekf.phase1.test.ts`) to pass, as the Phase 7 tests validate the tight NIS math that is only present in those unstaged files.

## 1. Already-Completed Phase 0–6 Functionality

Upon auditing the repository, it's clear that the bulk of Phase 7's required tests were proactively written and committed during earlier phases:

- ✅ **Task 7.1 — Tighten `nis_chi_squared_sanity`**: The `ekf.phase1.test.ts` file was committed previously and contains rigorous tests validating that NIS follows a Chi-Squared(2) distribution.
- ✅ **Task 7.2 — `spoof_injection_detected`**: Exists and is verified in `ekf.phase1.test.ts` (asserts the threshold triggers after 3 consecutive high NIS ticks).
- ✅ **Task 7.3 — `spoof_recovery`**: Exists and is verified in `ekf.phase1.test.ts` (asserts recovery after 5 consecutive low NIS ticks).
- ✅ **Task 7.5 — `mock_producer_contract`**: Implemented during Phase 5 in `mockLocationProducer.test.ts`. It correctly asserts that the emitted payload matches all 10 required fields and uses `HLC.parse`.
- ✅ **Task 7.6 — Covariance positive-definite check**: Exists in `ekf.phase1.test.ts`, leveraging Cholesky decomposition to verify that the covariance matrix `S` remains symmetric and positive-definite.

## 2. Missing Phase 7 Work (To Be Implemented)

### Task 7.4 — `stale_marker_grey` (Missing)
- **Description**: The widget UI test to ensure that a `RiderMarkerOverlay` renders grey when a rider is >10s stale.
- **Files/components affected**: 
  - `[NEW] app/__tests__/riderMarker.test.tsx`
- **Dependencies**: Phase 4 (overlay implemented) and Phase 6 (Zustand state wired).
- **Test Strategy**: Use `react-test-renderer` to mount `<RiderMarkerOverlay />`. Supply a rider prop whose `timestamp_hlc` resolves to an age older than 10 seconds, and assert that the underlying Mapbox `CircleLayer` receives the grey color constant.

## 3. Execution Plan

When Phase 7 execution is approved, the following steps will be taken:

1. **Commit Outstanding Phase 1 & 2 Math**: Stage and commit the existing unstaged changes in `ekf.ts`, `sensorStream.ts`, `ekf.test.ts`, and `README.md`. These files are the prerequisites for the EKF tests to pass.
2. **Implement Task 7.4**: Create `app/__tests__/riderMarker.test.tsx` and write the widget test for the grey stale marker.
3. **Verify Full Test Suite**: Run `npm run typecheck && npm test` across both `app/` and `modules/tracking/` to ensure all tests pass with the new Math and UI test in place.

## User Review Required
Please review this assessment. The main ambiguity was the presence of unstaged files (`ekf.ts`, `sensorStream.ts`). As verified, these contain the actual math implementation required for Phase 1 and 7. If you approve of staging/committing them as the first step of Phase 7, we can proceed with execution.
