# Phase 2 — Sensor pipeline & background location

**Objective:** Make `SensorStream` production-ready: permissions, downsampling, background execution, decoupling from EKF for testability.

---

## Task 2.1 — Decouple GPS callback from EKF

- **Description:** `SensorStream.start(ekf, onTick)` calls `ekf.update` inside the geolocation callback. Instead, emit the fix via a callback; let `TrackingService` decide when to call `ekf.update`.
- **Why it is required:** Couples sensor I/O to filter; untestable without mocking geolocation; makes the tick-vs-fix race explicit.
- **Files/components affected:** `modules/tracking/src/sensorStream.ts`, `modules/tracking/src/trackingService.ts`.
- **Dependencies:** None.
- **Expected deliverable:** `SensorStream.start(onGpsFix, onImuSample)`; `TrackingService` owns the ekf calls.
- **Definition of Done:** `SensorStream` has no `Ekf` import.

---

## Task 2.2 — IMU downsampling to EKF rate

- **Description:** `react-native-sensors` emits at ~60 Hz; EKF runs at 1 Hz. Spec §3.6: "downsample the IMU to your EKF rate. Don't wake the CPU for every IMU sample."
- **Why it is required:** Battery. Spec <1% CPU.
- **Files/components affected:** `modules/tracking/src/sensorStream.ts`.
- **Dependencies:** Task 2.1.
- **Expected deliverable:** A sliding-window aggregator that emits one averaged `(accelForward, headingRate)` per tick window.
- **Definition of Done:** `onImuSample` called ≤1 Hz externally regardless of sensor native rate.

---

## Task 2.3 — Background location permission & service

- **Description:** `react-native-background-geolocation` is in `app/package.json` but unused. Wire it for Android foreground service + iOS always-on location. TODO in `trackingService.ts` line 7.
- **Why it is required:** Spec §3.6 + risk §9 row 2: "Background location killed by OS is #1 cause of battery drain / data loss."
- **Files/components affected:** `modules/tracking/src/sensorStream.ts`, `modules/tracking/src/trackingService.ts`, `app/android/app/src/main/AndroidManifest.xml` (foreground service permission), `app/ios/Runner/Info.plist` (`UIBackgroundModes` location).
- **Dependencies:** Task 2.1.
- **Expected deliverable:** `SensorStream.start` uses background-geolocation watch when configured; foreground notification on Android.
- **Definition of Done:** Phone screen off for 5 min → EKF still publishing.

---

## Task 2.4 — GPS permission request flow

- **Description:** No permission request code exists. `react-native-geolocation-service` requires runtime permission on Android ≥6, always-on on iOS.
- **Why it is required:** App crashes on first launch without permission.
- **Files/components affected:** `modules/tracking/src/sensorStream.ts` (or a new `permissions.ts`).
- **Dependencies:** None.
- **Expected deliverable:** `requestLocationPermission(): Promise<boolean>` called before `start`.
- **Definition of Done:** First-launch flow requests permission; denied state handled gracefully.