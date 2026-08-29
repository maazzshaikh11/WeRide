/**
 * Mock verified_location producer (Week 1 Day 2 unblock).
 * Walks along a predefined polyline, emitting at 1 Hz.
 * Everyone builds against this until Week 4 integration swap.
 * Ported from mock_location_producer.dart.
 *
 * Uses Person B's HLC (Hybrid Logical Clock) for timestamps so downstream
 * consumers parse it identically to real timestamps.
 */

import { LocationPublisher, VerifiedLocationPayload } from './locationPublisher';

/** HLC interface — implemented in modules/hazard-sos/src/hlc/hlc.ts */
export interface HlcSource {
  now(): string;
}

export interface MockLocationProducerParams {
  publisher: LocationPublisher;
  polyline: number[][]; // [[lat,lng],...]
  hlc: HlcSource; // Hybrid Logical Clock for timestamps
  intervalMs?: number;
  speedMps?: number;
}

/** Sensor source for externally-driven demo runs (Task 5.2). */
export interface MockSensorSource {
  onPositionUpdate(callback: (lat: number, lng: number) => void): void;
  getImuSample(): { accelForward: number; headingRateDegPerSec: number };
  tick(): { lat: number; lng: number; heading: number };
  injectSpoof(deltaLat: number, deltaLng: number): void;
}

export class MockLocationProducer {
  private _publisher: LocationPublisher;
  private _polyline: number[][];
  private _hlc: HlcSource;
  private _intervalMs: number;
  private _speed: number;
  private _timer?: ReturnType<typeof setInterval>;
  private _idx = 0;

  // Spoof injection state — applied once on the next tick, then cleared.
  // Repeated calls before a tick REPLACE the prior offset (last call wins).
  private _spoofOffsetLat = 0;
  private _spoofOffsetLng = 0;

  // Sensor source state (Task 5.2)
  private _currentHeading = 0;
  private _lastImuSample = { accelForward: 0, headingRateDegPerSec: 0 };
  private _prevHeading = 0;
  private _hasPrevHeading = false;

  constructor(params: MockLocationProducerParams) {
    this._publisher = params.publisher;
    this._polyline = params.polyline;
    this._hlc = params.hlc;
    this._intervalMs = params.intervalMs ?? 1000;
    this._speed = params.speedMps ?? 8.0;
  }

  /**
   * Compute bearing (heading in degrees) from point A to point B.
   * Uses the forward azimuth formula for great-circle distance.
   * Returns heading in degrees [0, 360).
   */
  private _computeBearing(latA: number, lngA: number, latB: number, lngB: number): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const toDeg = (rad: number) => (rad * 180) / Math.PI;

    const dLng = toRad(lngB - lngA);
    const latA_rad = toRad(latA);
    const latB_rad = toRad(latB);

    // Forward azimuth formula (bearing from A to B):
    // θ = atan2(sin(Δλ) * cos(φ2), cos(φ1) * sin(φ2) − sin(φ1) * cos(φ2) * cos(Δλ))
    const y = Math.sin(dLng) * Math.cos(latB_rad);
    const x = Math.cos(latA_rad) * Math.sin(latB_rad) - Math.sin(latA_rad) * Math.cos(latB_rad) * Math.cos(dLng);
    let bearing = toDeg(Math.atan2(y, x));

    // Normalize to [0, 360)
    bearing = (bearing + 360) % 360;
    return bearing;
  }

  /**
   * Inject a one-shot GPS spoof displacement.
   *
   * The next emitted position will be offset by (deltaLat, deltaLng) degrees.
   * The offset is applied ONCE and then cleared automatically.
   *
   * Behavior for repeated calls before the next tick: REPLACE (last call wins).
   * This is intentional — a single position jump matches the demo requirement.
   *
   * Input validation: throws TypeError if deltaLat or deltaLng is not a finite
   * number (NaN, undefined, non-number). This prevents silent propagation of
   * invalid values into the mock position.
   */
  injectSpoof(deltaLat: number, deltaLng: number): void {
    if (typeof deltaLat !== 'number' || typeof deltaLng !== 'number' ||
        !Number.isFinite(deltaLat) || !Number.isFinite(deltaLng)) {
      throw new TypeError('injectSpoof requires finite number deltaLat and deltaLng');
    }
    this._spoofOffsetLat = deltaLat;
    this._spoofOffsetLng = deltaLng;
  }

  start(): void {
    this._timer = setInterval(() => {
      const currentPoint = this._polyline[this._idx % this._polyline.length];
      const nextIdx = (this._idx + 1) % this._polyline.length;
      const nextPoint = this._polyline[nextIdx];

      // Compute bearing to next waypoint
      const heading = this._computeBearing(
        currentPoint[0],
        currentPoint[1],
        nextPoint[0],
        nextPoint[1]
      );

      // Apply spoof offset (if any) to the current position, then clear it.
      // The offset is applied once per injectSpoof() call.
      const lat = currentPoint[0] + this._spoofOffsetLat;
      const lng = currentPoint[1] + this._spoofOffsetLng;
      this._spoofOffsetLat = 0;
      this._spoofOffsetLng = 0;

      const payload: VerifiedLocationPayload = {
        timestampHlc: this._hlc.now(),
        lat,
        lng,
        speedMps: this._speed,
        headingDeg: heading,
        spoofFlag: false,
        nisScore: 1.0,
        accuracyM: 5.0,
      };
      this._publisher.publish(payload);
      this._idx++;
    }, this._intervalMs);
  }

  stop(): void {
    if (this._timer) clearInterval(this._timer);
  }

  /**
   * Advance the mock by exactly one tick.
   * Returns the emitted position and heading for the tick.
   * Used by the sensor source for externally-driven ticks.
   */
  private _tickInternal(): { lat: number; lng: number; heading: number } {
    const currentPoint = this._polyline[this._idx % this._polyline.length];
    const nextIdx = (this._idx + 1) % this._polyline.length;
    const nextPoint = this._polyline[nextIdx];

    const heading = this._computeBearing(
      currentPoint[0],
      currentPoint[1],
      nextPoint[0],
      nextPoint[1]
    );

    // Apply spoof offset (if any) to the current position, then clear it.
    const lat = currentPoint[0] + this._spoofOffsetLat;
    const lng = currentPoint[1] + this._spoofOffsetLng;
    this._spoofOffsetLat = 0;
    this._spoofOffsetLng = 0;

    this._idx++;

    return { lat, lng, heading };
  }

  /**
   * Create a sensor source for externally-driven demo runs (Task 5.2).
   *
   * This replaces the internal setInterval with an externally-driven tick
   * mechanism, allowing deterministic demo runs. The returned object does
   * NOT create any timers.
   *
   * The sensor source provides:
   * - onPositionUpdate: callback invoked with (lat, lng) on each tick()
   * - getImuSample: returns { accelForward, headingRateDegPerSec }
   * - tick: advances one tick, invokes onPositionUpdate callback
   * - injectSpoof: queues a spoof offset for the next tick
   *
   * IMU behavior (demo approximation, not a physical model):
   * - accelForward = 0 (mock walks at constant speed)
   * - headingRateDegPerSec = wrapped angular delta / dt
   *   where wrapped delta handles 359° → 1° case correctly:
   *   delta = ((heading - prevHeading + 540) % 360) - 180
   *   headingRateDegPerSec = delta / dt
   */
  asSensorSource(): MockSensorSource {
    let positionCallback: ((lat: number, lng: number) => void) | null = null;
    let prevHeading = 0;
    let hasPrevHeading = false;

    const source: MockSensorSource = {
      onPositionUpdate: (callback: (lat: number, lng: number) => void) => {
        positionCallback = callback;
      },

      getImuSample: (): { accelForward: number; headingRateDegPerSec: number } => {
        return { ...this._lastImuSample };
      },

      tick: (): { lat: number; lng: number; heading: number } => {
        const { lat, lng, heading } = this._tickInternal();
        this._currentHeading = heading;

        // Compute IMU sample for this tick using previous heading
        let imuHeadingRate = 0;
        if (hasPrevHeading) {
          const delta = ((heading - prevHeading + 540) % 360) - 180;
          const dt = 1;
          imuHeadingRate = delta / dt;
        }
        prevHeading = heading;
        hasPrevHeading = true;

        // Store IMU for getImuSample()
        this._lastImuSample = { accelForward: 0, headingRateDegPerSec: imuHeadingRate };

        // Invoke position callback
        if (positionCallback) {
          positionCallback(lat, lng);
        }

        return { lat, lng, heading };
      },

      injectSpoof: (deltaLat: number, deltaLng: number): void => {
        this.injectSpoof(deltaLat, deltaLng);
      },
    };

    return source;
  }
}