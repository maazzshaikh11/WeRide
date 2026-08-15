# Person A — Live Tracking & Anti-Spoofing (EKF)

**Objective 1:** Live member tracking with anti-spoofing via Extended Kalman Filter (EKF) running on-device.

**Module folder:** `/modules/tracking`
**UI screens owned:** Live Map base layer (rider markers, spoof-flag colors)

---

## 1. Your Objective (End-to-End)

You own the **verified location pipeline**: from raw phone sensors (GPS + IMU) → on-device EKF → spoof detection (NIS score) → published `verified_location` to the group in real time. Every other person (B, C, D) consumes your `verified_location` stream. You are the **foundation** — if your output is wrong, everyone downstream is wrong.

**What "done" looks like (demo, Week 7):**
> Live map shows verified rider dots. You stage a GPS spoof injection mid-ride → `spoof_flag` flips to true in real time, the rider marker turns red/grey, IMU dead-reckoning takes over, UI shows flagged state. NIS score is visible. When the spoof stops, the flag clears and the marker returns to green.

---

## 2. Data Contract You Publish (Frozen — §6.1)

You are the **sole producer** of `verified_location`. This shape is frozen; changing it requires all 4 to agree in a weekly sync and a PR review on `/contracts/verified_location.json`.

```json
{
  "rider_id": "string (uuid)",
  "group_id": "string (uuid)",
  "timestamp_hlc": "string",
  "lat": "float", "lng": "float",
  "speed_mps": "float", "heading_deg": "float",
  "spoof_flag": "boolean",
  "nis_score": "float",
  "accuracy_m": "float"
}
```

**Transport (your responsibility to implement):**
- **Live:** Socket.io event `location:update` — emitted on every EKF update tick (target ~1–5 Hz depending on battery budget; document your chosen rate in `modules/tracking/README.md`).
- **Persisted:** Firestore `groups/{group_id}/locations/{rider_id}` — written on a throttled cadence (e.g., every 5–10s) so late joiners can fetch the last-known position. Do NOT write every tick to Firestore (cost + write-limit risk).

**Note on `timestamp_hlc`:** Person B owns the HLC implementation. You **consume** B's HLC clock to timestamp your updates. Until B ships the real HLC, use the mock HLC stub B provides by end of Week 1 Day 2 (see dependency §5 below). Do not roll your own HLC — that creates a second clock and CRDT merges break.

---

## 3. Algorithm: Extended Kalman Filter (EKF)

### 3.1 Why EKF (not a plain Kalman filter)
GPS gives noisy position; IMU (accelerometer + gyroscope) gives relative motion. Fusing them with a linear Kalman filter is wrong because the motion model (constant-velocity in 2D with heading) is mildly non-linear when you account for bearing changes. The EKF linearizes the prediction/measurement Jacobians each tick.

### 3.2 State vector (recommended — document your final choice)
```
x = [lat, lng, speed_mps, heading_deg]^T   (4-state)
```
You may extend to include acceleration if you find 4-state underperforms, but start with 4 — fewer states = easier to tune and less CPU. Document the choice in your module README.

### 3.3 Prediction step (IMU-driven)
- Use accelerometer magnitude + gyroscope heading rate between GPS fixes to propagate state forward.
- Process noise Q: tune to reflect IMU noise (start with manufacturer specs from the phone, then empirically tune during Week 2–3 field tests).
- **Ponytail note:** do not over-engineer the noise model. A diagonal Q tuned by hand beats a 6-parameter auto-tuner at this scale. `# ponytail: manual Q tuning, add adaptive Q if residual analysis shows drift`

### 3.4 Update step (GPS-driven)
- On each new GPS fix, compute the innovation (measurement − prediction), the innovation covariance S, and the NIS (Normalized Innovation Squared): `NIS = innovation^T * S^-1 * innovation`.
- NIS is your **spoof / anomaly detector**: under normal operation NIS follows a chi-squared distribution with `dim(measurement)` degrees of freedom. A sudden spike = the GPS jumped in a way the IMU cannot explain = likely spoof or multipath.
- **Threshold:** document your NIS threshold (e.g., 95th percentile of chi-squared with 2 DoF ≈ 5.99). Make it a named constant, not magic.

### 3.5 Spoof-flag logic
- `spoof_flag = true` when NIS exceeds threshold for ≥ N consecutive ticks (start N=3 to avoid one-off flukes). While flagged, **trust IMU dead-reckoning only** — do not let the spoofed GPS corrupt the state. Clear the flag when NIS returns below threshold for M consecutive ticks (start M=5, stricter to re-trust).
- While flagged, keep publishing `verified_location` with `spoof_flag=true` and the IMU-projected position — downstream consumers (B hazard reports, C routing) must know this position is degraded.

### 3.6 CPU / battery budget
The spec requires **<1% CPU** for the EKF module. Practical rules:
- Run EKF at 1 Hz (one prediction + one update per second) unless field tests show you need 5 Hz. Higher rate = battery drain + write amplification.
- Batch sensor reads — don't wake the CPU for every IMU sample; downsample the IMU to your EKF rate.
- Use the platform's background location service correctly (RN: `react-native-background-geolocation` + `react-native-sensors`). Misconfigured background location is the #1 cause of battery drain.

---

## 4. UI Screens You Own

### 4.1 Live Map — rider markers (base layer)
- @rnmapbox/maps base layer (per §2 of spec) for the overview map. Mapbox handles both overview + offline tiles / custom overlay — that's shared infra, coordinate with C who uses Mapbox for routing overlay.
- Rider markers: one per `verified_location` in the current `group_id`.
  - **Green:** `spoof_flag=false`, fresh timestamp (< 10s old).
  - **Red:** `spoof_flag=true` (flagged rider).
  - **Grey:** stale (> 10s old, no recent update — signal lost).
- Marker updates come from your own Socket.io `location:update` listener for the current group.
- Marker tap → small info card: rider name, speed, heading, NIS score (only show NIS in a debug/profile mode — not on the main screen, it's noise for end users).

### 4.2 What you do NOT own
- Hazard markers (B), route line (C), VOX indicator (D) — all of these render on the same Live Map, but they are not your code. You own the **base layer + rider markers only**. Coordinate with B, C, D on the map widget so everyone's overlays stack cleanly. Recommendation: you own the `MapScreen` widget shell; B/C/D contribute child overlay widgets they register with you. Lock this interface in Week 1 Day 2.

---

## 5. Dependencies (what you wait for / what waits for you)

### 5.1 You depend on
| From | What | When you need it |
|---|---|---|
| Person B | HLC timestamp source (for `timestamp_hlc`) | Week 1 Day 2 (mock), real by Week 2–3 |
| Infra (shared) | Firebase project config, Socket.io server endpoint | Week 1 Day 1–2 |
| Design system (C owns theme) | `theme.ts` — colors, font, icon set | Week 1 Day 1 |
| App shell (whoever builds navigation) | `MapScreen` route in the app's navigator | Week 1 Day 3–7 |

### 5.2 What waits on you
| Who | What they need from you | When |
|---|---|---|
| Person B | `verified_location` stream (for attaching coords to hazard/SOS reports) | Mock by Week 1 Day 2, real by Week 4 |
| Person C | `verified_location` (origin for route requests, live rider positions) | Mock by Week 1 Day 2, real by Week 4 |
| Person D | `verified_location` (not strictly needed for VOX, but FL client uses ride data incl. location) | Mock by Week 1 Day 2, real by Week 5 |

**Unblocking rule (mandatory, from spec §5):** You MUST ship a mock `verified_location` producer by end of Day 2, Week 1. The mock emits plausible lat/lng walking along a predefined polyline, with `spoof_flag=false`, at 1 Hz, over Socket.io `location:update` AND writing to Firestore on the throttled cadence. Everyone builds against this mock until Week 4 integration swap.

---

## 6. Week-by-Week Plan

### Week 1
- **Day 1:** Be in the room for §9 decisions. You care most about: RN stack (locked — `react-native-sensors` for IMU is sufficient), realtime transport (Socket.io for location — lower latency than Firestore listeners), and the design system (so your map matches).
- **Day 1–2:** Write the `/contracts/verified_location.json` JSON schema file with B, C, D reviewing.
- **Day 2:** Ship mock `verified_location` producer (predefined polyline walker + Socket.io emit + throttled Firestore write). This unblocks everyone. **This is your hardest deadline — do not slip it.**
- **Day 3–7:** Start real EKF implementation in `modules/tracking`. Stand up sensor streams (`react-native-sensors` + `react-native-geolocation-service`). Get a single phone publishing its real position through the EKF (even if Q is untuned) by end of week.

### Week 2–3 (core algorithm)
- Tune Q (process noise) and R (measurement noise) with field tests — walk/ride with the phone, compare EKF output vs raw GPS, look at residual plots.
- Implement NIS computation and the spoof-flag state machine (§3.5).
- Unit tests (see §7): chi-squared NIS sanity check, spoof-injection test, stale-marker test.
- Write `modules/tracking/README.md` documenting your state vector, Q/R values, tick rate, NIS threshold.

### Week 4 (integration swap 1)
- Real EKF replaces your mock for B, C, D. This is the week things get real — expect breakage. Budget time for fixing contract mismatches (someone's mock consumer assumed a field you didn't populate, etc.).
- Verify the late-joiner path: open the app fresh mid-ride → it reads Firestore `groups/{gid}/locations/{rider_id}` and shows last-known position immediately, then live updates flow over Socket.io.

### Week 5
- D integrates real location for FL ride data. You may need to expose a local ride-data buffer (lat/lng/speed/time history) for D's FL client to train on. Coordinate the shape of this buffer with D — it's not in §6, so define it in a weekly sync and add to `/contracts`.

### Week 6
- Full system integration testing. Your part: GPS spoof test (§11 row 1), battery/CPU profile (§11 row 7 — your module must be <1% CPU).
- Offline cold-start test (§11 last row) partially hits you: does your EKF resume correctly and re-publish on reconnect?

### Week 7
- Final build frozen 2 days before submission. Demo rehearsal: your beat is the spoof injection (§12 item 1). Practice the timing — the spoof needs to be visibly detected within ~3s for the demo to land.

---

## 7. Tests You Must Write (minimum)

Create `modules/tracking/test/`. Use Jest (the project's test runner — `npm test` in each module). No frameworks beyond what's already configured.

| Test | What it asserts |
|---|---|
| `nis_chi_squared_sanity` | Over 1000 normal ticks, NIS values follow chi-squared(2) distribution (mean ≈ 2). Catches a broken innovation covariance. |
| `spoof_injection_detected` | Feed a synthetic GPS jump (teleport 1km) → `spoof_flag` flips true within N ticks, state stays at IMU-projected position. |
| `spoof_recovery` | After spoof clears, `spoof_flag` returns false after M ticks of low NIS. |
| `stale_marker_grey` | No update for > 10s → UI marker is grey (this is a widget test, not pure logic). |
| `mock_producer_contract` | The mock you ship Week 1 Day 2 emits the exact `verified_location` schema — guards against contract drift. |

For the self-check during development (ponytail rule), include a `demo()` / `__main__`-style runnable that prints a sample EKF run with and without a spoof injection, so you can eyeball it without running the full app.

---

## 8. Files You Own

```
modules/tracking/
  src/
    ekf.ts                    # the filter itself — pure logic, testable without sensors
    sensorStream.ts           # wraps react-native-geolocation-service + react-native-sensors, feeds ekf
    locationPublisher.ts      # Socket.io emit + throttled Firestore write
    spoofDetector.ts          # NIS threshold + flag state machine (may be folded into ekf if small)
    trackingService.ts        # ties sensors → ekf → publisher; the on-device service
    mockLocationProducer.ts   # Week 1 Day 2 unblock — predefined polyline walker
    index.ts                  # re-exports
  README.md                   # state vector, Q/R, tick rate, NIS threshold, spoof logic — the tuning doc
  test/
    ekf.test.ts               # NIS sanity, spoof injection, spoof recovery
contracts/verified_location.json   # the frozen schema (you author, all 4 review)
```

In the app shell (`/app`), you own:
```
app/src/screens/map/
  MapScreen.tsx               # the map widget shell — B/C/D register overlays here
  overlays/RiderMarkerOverlay.tsx  # green/red/grey marker logic
```

---

## 9. Risks Specific to You

| Risk | Mitigation |
|---|---|
| IMU sensor quality varies wildly across Android devices | Test on ≥2 real devices Week 2; if a device's IMU is too noisy to dead-reckon, fall back to GPS-only with a degraded `accuracy_m` value and document it. |
| Background location killed by OS (Android Doze / iOS background limits) | Use the platform's approved background location API; test with screen off for 5 min; if killed, you need a foreground service (Android) / always-on location permission (iOS). |
| EKF tuning takes longer than Week 2–3 | Mocks unblock everyone — you get extra time. Do not rush tuning; a poorly-tuned EKF is worse than raw GPS. |
| NIS threshold is wrong (too sensitive → false spoofs; too loose → misses real spoof) | Collect NIS histograms from real rides in Week 2–3, set threshold at the 99th percentile of normal riding. Re-tune if field tests show false positives. |

---

## 10. Demo Script (Your Beat — §12 item 1)

1. Show the Live Map with ≥2 riders (you + a teammate) as green dots moving.
2. Use a GPS-spoofing app (e.g., Fake GPS location on Android, or a dev-mode location override) to teleport your marker 1km sideways.
3. Within ~3s: your marker turns red, NIS spikes (visible in debug overlay), the marker stays at the IMU-projected real position (not the spoofed one).
4. Stop spoofing → marker returns to green after the recovery window.
5. Say one line: "IMU dead-reckoning held the real position; NIS caught the jump."

---

## 11. What to Skip (YAGNI for your module)

- Adaptive / auto-tuning Q. Hand-tune. `# ponytail: manual Q, add adaptive if residual analysis demands`
- Map matching to roads (snapping). Not required by the spec; routing (C) handles road logic.
- Multi-constellation GNSS selection logic. Use whatever the platform gives you.
- A separate "spoof ML model." NIS is your detector; do not build a second one.
- Publishing every EKF tick to Firestore. Throttle. Cost + write limits.

---

*Questions about your contract or dependencies? Raise in the weekly sync, do not assume. This plan assumes the spec (WeRide_Project_Spec.md) is the source of truth.*