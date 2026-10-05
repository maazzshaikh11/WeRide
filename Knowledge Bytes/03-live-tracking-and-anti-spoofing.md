---
### Byte 3: Live tracking — from raw sensors to a trusted position
*Builds on:* Byte 2 (the Map screen starts tracking and the stores receive the result)

*In plain terms:*
Raw phone GPS is noisy and can be faked. The **tracking** module fuses GPS with motion sensors using an **Extended Kalman Filter (EKF)** to produce one smooth, *verified* position per second. If new GPS readings stop agreeing with what physics predicts, the rider is **flagged as possibly spoofed**.

*The code:*
```ts
// modules/tracking/src/trackingService.ts  — runs once per tick (1 Hz)
this._ekf.predict(dt, imuSample.accelForward ?? 0, imuSample.headingRate);  // motion model
const payload: VerifiedLocationPayload = {
  timestampHlc, lat: this._ekf.lat, lng: this._ekf.lng,
  speedMps: this._ekf.speed, headingDeg: this._ekf.heading,
  spoofFlag: this._ekf.spoofFlag, nisScore: this._ekf.nisScore, accuracyM: this._ekf.accuracyM,
};
this._publisher.publish(payload);
```

*How it fits together:*
1. **`SensorStream`** supplies GPS fixes and downsampled accelerometer/gyro data.
2. **`Ekf`** keeps a 4-state estimate `[lat, lng, speed, heading]`. Each GPS fix is an *update*; each tick without one is a *prediction* from the motion model.
3. **`NIS`** (Normalised Innovation Squared) measures how surprising a GPS fix is. Above the chi-squared 95% threshold (`5.99`) for several ticks in a row, **`SpoofDetector`** sets `spoof_flag` (and clears it after a recovery streak).
4. **`LocationPublisher`** sends the payload over Socket.io (live) and writes it to Firestore at most every 5 s (so late joiners can see where everyone last was).
5. Receivers colour each rider by state — **green** verified, **red** spoofed, **grey** stale (older than 10 s).

*A design decision worth knowing — own position is fed back locally.* The server broadcasts a rider's fix to everyone **except the sender**, so a rider never receives their own position over the socket. The app therefore subclasses the publisher:

```ts
// app/src/services/ownLocationPublisher.ts
publish(p) {
  super.publish(p);                       // socket + Firestore, unchanged
  this._onOwnFix({ rider_id: this.riderId, /* … */ spoof_flag: p.spoofFlag });
}
```
`MapScreen` uses that callback to fill `routeStore` — which is where the route origin, hazard-report location and stop distances come from. A fix is only trusted for routing if it is not spoof-flagged and accuracy ≤ 50 m.

*Why it is designed this way:* the filter lives in a module with no UI, so it can be tested with synthetic tracks; the subclass leaves Person A's code untouched.

*Gotcha:* SOS is the exception — it falls back to the latest fix even if it fails the 50 m / spoof gate, because a rough position beats none in an emergency.
