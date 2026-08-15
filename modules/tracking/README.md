# Person A — Tracking & Anti-Spoofing (EKF)

On-device Extended Kalman Filter fusing GPS + IMU. Publishes `verified_location`
(Socket.io `location:update` + throttled Firestore write).

## State vector
4-state: `[lat, lng, speed_mps, heading_deg]`

## Key parameters (tune in Week 2-3, document final values here)
| Param | Value | Notes |
|---|---|---|
| Tick rate | 1 Hz | EKF prediction+update per second |
| Q (process noise) | TODO | IMU-driven |
| R (measurement noise) | TODO | GPS variance |
| NIS threshold | 5.99 | chi-squared(2) 95th percentile |
| Spoof trigger ticks (N) | 3 | consecutive NIS exceedances to flag |
| Spoof recovery ticks (M) | 5 | consecutive low-NIS to clear |
| Firestore write throttle | 5s | persisted location cadence |

## Spoof logic
- `spoof_flag=true` when NIS > threshold for >= N consecutive ticks
- While flagged: IMU dead-reckoning only (GPS rejected), keep publishing with flag=true
- Clears when NIS < threshold for >= M ticks

## See also
- Plan: `Person_A_Tracking_AntiSpoofing.md`
- Contract: `contracts/verified_location.json`