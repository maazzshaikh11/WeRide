# Person A — Tracking & Anti-Spoofing (EKF)

On-device Extended Kalman Filter fusing GPS + IMU. Publishes `verified_location`
(Socket.io `location:update` + throttled Firestore write).

## State vector
4-state: `[lat, lng, speed_mps, heading_deg]`

Units: lat/lng/heading in degrees, speed in m/s

## Phase 1: Core EKF Implementation (CORRECTED)

### Motion Model & Jacobian (Task 1.1)

**Motion equations:**
```
lat' = lat + (speed * dt * cos(heading*π/180)) / 111320
lng' = lng + (speed * dt * sin(heading*π/180)) / (111320 * cos(lat*π/180))
speed' = speed + accel * dt
heading' = heading + headingRate * dt
```

**Jacobian F** (∂x'/∂x) with CORRECT degree/radian conversions:

Since state uses degrees, derivatives with respect to degree-based variables include π/180:

- F[0,0] = 1
- F[0,2] = (dt * cos(heading*π/180)) / 111320
- F[0,3] = -(dt * speed * sin(heading*π/180) * **π/180**) / 111320  ← includes conversion
- F[1,0] = (dt * speed * sin(heading*π/180) * sin(lat*π/180) * **π/180**) / (111320 * cos²(lat*π/180))  ← includes conversion
- F[1,1] = 1
- F[1,2] = (dt * sin(heading*π/180)) / (111320 * cos(lat*π/180))
- F[1,3] = (dt * speed * cos(heading*π/180) * **π/180**) / (111320 * cos(lat*π/180))  ← includes conversion
- F[2,2] = 1
- F[3,3] = 1
- All other entries = 0

**Covariance propagation:** `P = F P F^T + Q`

**Validation:** Analytical Jacobian validated against finite-difference numerical derivatives (see test suite).

### Measurement Model (Task 1.2)

**Measurement Jacobian H** (2×4, selects lat/lng from state):
```
H = [1, 0, 0, 0]
    [0, 1, 0, 0]
```

**Innovation covariance:** `S = H P H^T + R` (full 2×2 matrix, **not diagonal approximation**)

**NIS computation:** `NIS = innovation^T * S^-1 * innovation`

Where:
- innovation = [gps_lat - predicted_lat, gps_lng - predicted_lng]
- S^-1 computed via 2×2 closed-form inversion with controlled regularization
- NIS follows chi-squared(2) distribution under normal operation

**Near-singular S handling:**
- If |det(S)| < 1e-10: regularize S → S + λI where λ=1e-10
- Fallback: pseudo-inverse (diagonal only) if still singular
- Ensures NIS remains finite and mathematically valid

### Kalman Gain & Update (Task 1.3)

**Kalman gain:** `K = P H^T S^-1` (4×2)

**State update:** `x = x + K * innovation`

**Covariance update (Joseph form):** `P = (I - KH) P (I - KH)^T + K R K^T`

Properties:
- Joseph form is numerically stable (avoids fragility of simple `P = (I-KH)P`)
- P symmetrized for floating-point cleanup
- P validated for positive-definiteness (Sylvester's criterion)
- Covariance decreases after valid GPS measurement

### IMU Dead-Reckoning (Task 1.4)

**LIMITATION (Phase 1):**
- SensorStream provides raw accelerometer {x, y, z} in device frame
- **Without device attitude/orientation, true vehicle-forward acceleration CANNOT be computed**
- Current implementation: `accelForward = sqrt(x² + y² + z²) - 9.81` (simplified, NOT physically correct)
- This is a **provisional placeholder** for Phase 1 prediction interface
- Assumes device roughly horizontal and forward motion dominates (defensible but not accurate)

**Phase 2+ requirement:** Integrate device attitude or use platform motion API for correct forward acceleration.

**Integration:**
- Speed updated via: `speed += accelForward * dt`
- Heading updated via gyroscope z-axis: `heading += headingRate * dt`

**Spoof behavior:**
- When GPS is rejected (spoofFlag = true), state continues via IMU prediction only
- GPS measurements do not pull state toward spoofed location
- IMU dead-reckoning provides fallback navigation

### Noise Model (Task 1.5)

**Process noise Q** (4×4 diagonal, **PROVISIONAL - NOT EMPIRICAL**):

Derived from stated assumptions:
- Position drift: ~0.1m over 1s prediction → (0.1/111320)² deg²/s
- Speed drift: ~0.1 m/s² accel noise → (0.1)² (m/s)²/s
- Heading drift: ~1 deg/s gyro noise → 1² deg²/s

Values:
- Q[0,0] ≈ 8e-12 deg²/s (lat process noise)
- Q[5,5] ≈ 8e-12 deg²/s (lng process noise)
- Q[10,10] = 0.01 (m/s)²/s (speed process noise)
- Q[15,15] = 1.0 deg²/s (heading process noise)

**Measurement noise R** (2×2 diagonal, **PROVISIONAL - NOT EMPIRICAL**):

Assuming 10m GPS 1-sigma accuracy:
- σ_gps = 10m / 111320 ≈ 8.98e-5 deg
- R[0,0] = σ² ≈ 8.1e-9 deg² (lat measurement noise)
- R[1,1] = σ² ≈ 8.1e-9 deg² (lng measurement noise)

**Status:** Q/R values labeled PROVISIONAL. Field testing required for empirical tuning (Week 2–3).

**Initial P** (state uncertainty at cold start):
- GPS cold start: ~50m uncertainty → (50/111320)² ≈ 2e-7 deg²
- Speed unknown: ~5 m/s → 25 (m/s)²
- Heading unknown: ~180 deg → 32400 deg²

## NIS (Normalized Innovation Squared) & Spoof Detection

**NIS Degrees of Freedom: 2**

GPS measures 2D position (latitude and longitude) only, not the full 4D state vector.
Therefore, NIS has 2 degrees of freedom.

Under normal operation (no spoof, no multipath), NIS follows a chi-squared distribution with 2 DoF.
- Chi-squared(2) has mean = 2.0
- Chi-squared(2) 95th percentile ≈ 5.99

**Threshold:** NIS_THRESHOLD = 5.99 (chi-squared(2) 95th percentile). Values > 5.99 indicate a likely GPS spoofing or multipath anomaly.

**Reference:** Standard Kalman Filter diagnostics. See:
- Bar-Shalom, Y., Li, X-R., & Kirubarajan, T. (2001). *Estimation with Applications to Tracking and Navigation*. Section 6.3 (NIS for filter validation).

## Spoof Detection Logic

**State Machine:**
- `spoof_flag=true` when NIS > threshold for ≥ N consecutive ticks (default N=3)
- While flagged: IMU dead-reckoning only; GPS measurements are rejected
- `spoof_flag=false` when NIS < threshold for ≥ M consecutive ticks after flagging (default M=5)

**Rationale:**
- N=3: Require 3 consecutive high-NIS ticks to avoid false positives from transient multipath
- M=5: Require 5 consecutive low-NIS ticks to re-trust GPS after a spoof event; stricter than trigger to avoid flapping

**Behavior while flagged:**
- EKF continues to predict using IMU (accel + gyro)
- No state correction from GPS
- `spoof_flag=true` is published in `verified_location` so downstream consumers (hazard reports, routing) know the position is degraded
- When spoof clears, flag drops and normal GPS fusion resumes

## Key parameters
| Param | Value | Notes |
|---|---|---|
| Tick rate | 1 Hz | EKF prediction+update per second |
| NIS DoF | 2 | GPS measures lat/lng only |
| NIS threshold | 5.99 | chi-squared(2) 95th percentile |
| Q (process noise) | See above | PROVISIONAL (not empirical) |
| R (measurement noise) | ~8e-9 deg² diag | PROVISIONAL; assumes 10m GPS 1-sigma |
| Initial P | See above | GPS 50m, speed 5 m/s, heading 180 deg |
| Spoof trigger ticks (N) | 3 | consecutive NIS > threshold to set flag |
| Spoof recovery ticks (M) | 5 | consecutive NIS < threshold to clear flag |
| Firestore write throttle | 5s | persisted location cadence |
| Accel clamp | ±5 m/s² | Prevents unrealistic acceleration outliers |

## Phase 1 Mathematical Corrections Applied

1. **Jacobian F:** Added π/180 conversion factors for derivatives w.r.t. degree-based state variables
2. **Covariance update:** Implemented Joseph form `P = (I-KH)P(I-KH)^T + KRK^T` for numerical stability
3. **S inversion:** Controlled regularization (S + λI) when near-singular, not arbitrary diagonal
4. **IMU limitation:** Honestly documented that magnitude-gravity ≠ true forward accel without device attitude
5. **Q/R values:** Calculated from stated assumptions, labeled PROVISIONAL (not empirical)
6. **Initial P:** Quantified with defensible GPS/speed/heading uncertainties

## Test Coverage (Phase 1)

Deterministic validation tests (no Math.random()):
- Analytical Jacobian F vs finite-difference numerical derivatives
- NIS ~ chi-squared(2) distribution over synthetic measurements
- Near-singular S handling
- Joseph-form covariance update
- Covariance symmetry and positive-definiteness (Sylvester's criterion)
- State update correctness
- Spoof trigger/recovery with production threshold 5.99
- Deterministic IMU prediction
- Full S matrix computation (off-diagonal covariance)

## Known Limitations (Phase 1)

1. **IMU forward acceleration:** Simplified model (magnitude - gravity) without device attitude
2. **Q/R tuning:** Provisional values from assumptions, not field-tested
3. **Latitude scaling:** R does not scale lng uncertainty by cos(lat) (acceptable for mid-latitudes)
4. **No magnetometer:** Heading drift accumulates without absolute heading reference

## See also
- Plan: `Person_A_Tracking_AntiSpoofing.md`
- Contract: `contracts/verified_location.json`
