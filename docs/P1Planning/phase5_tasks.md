# Phase 5 — Mock producer completion & demo tooling

**Objective:** Make the mock useful for the spoof demo (§10) and add the ponytail `demo()` runnable (§7).

---

## Task 5.1 — Spoof injection mode in mock

- **Description:** Mock currently always `spoof_flag=false`. Demo §10 step 2 needs to "teleport marker 1km sideways" and have the real EKF catch it. Add a method to inject a spoof jump.
- **Why it is required:** Can't rehearse demo without a spoof trigger.
- **Files/components affected:** `modules/tracking/src/mockLocationProducer.ts`.
- **Dependencies:** Task 0.3, Task 0.4.
- **Expected deliverable:** `injectSpoof(deltaLat, deltaLng)` — next tick emits the jumped position with `spoof_flag` computed (or let the real EKF run on the mock's GPS output — see 5.2).
- **Definition of Done:** Calling `injectSpoof(0.01, 0.01)` causes the consuming EKF to flag within N ticks.

---

## Task 5.2 — Demo mode: mock feeds real EKF (not just publisher)

- **Description:** For the demo, the mock should act as a synthetic GPS+IMU source feeding the real `Ekf`, so the spoof is detected by NIS, not faked.
- **Why it is required:** Spec §7 ponytail: "prints a sample EKF run with and without a spoof injection." Demo must show NIS spike, not a hard-coded flag.
- **Files/components affected:** `modules/tracking/src/mockLocationProducer.ts` (add `asSensorSource()` returning a fake `SensorStream` interface), `modules/tracking/src/demo.ts` (new).
- **Dependencies:** Phase 1 (EKF correct).
- **Expected deliverable:** `demo()` runnable (node script or `__main__`) that runs EKF on mock polyline, injects spoof at tick 50, prints state + NIS + flag each tick.
- **Definition of Done:** `npx ts-node modules/tracking/src/demo.ts` prints a table showing NIS spike at spoof tick.