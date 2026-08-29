/**
 * Ties sensors → EKF → publisher. The on-device tracking service.
 * Runs at 1 Hz (configurable). Uses Person B's HLC for timestamps.
 * Ported from tracking_service.dart.
 *
 * Phase 1: Passes IMU acceleration (not speed) to EKF for dead-reckoning.
 * Phase 3: Holds a concrete HLC and persists state on every tick via hlcStore.
 *
 * Caller integration (Phase 6):
 *   const hlc = loadHlc();
 *   const service = new TrackingService({ ..., hlc });
 *
 * TODO: background execution (react-native-background-geolocation on Android,
 * always-on location permission on iOS).
 */

import { Ekf } from './ekf';
import { SensorStream } from './sensorStream';
import { LocationPublisher, VerifiedLocationPayload } from './locationPublisher';
import { requestLocationPermission } from './permissions';
import { persistHlc } from './hlcStore';
import { HLC } from '@hazard/hlc/hlc';

/**
 * Minimal HLC interface — kept for other consumers that only need now().
 * TrackingService itself requires the concrete HLC class for persistence.
 */
export interface HlcSource {
  now(): string;
}

export interface TrackingServiceParams {
  ekf: Ekf;
  sensors: SensorStream;
  publisher: LocationPublisher;
  /** Must be a concrete HLC instance so TrackingService can persist state. */
  hlc: HLC;
  tickMs?: number;
}

export class TrackingService {
  private _ekf: Ekf;
  private _sensors: SensorStream;
  private _publisher: LocationPublisher;
  private _hlc: HLC;
  private _tickMs: number;
  private _timer?: ReturnType<typeof setInterval>;
  private _running = false;
  private _hasInitialFix = false;

  constructor(params: TrackingServiceParams) {
    this._ekf = params.ekf;
    this._sensors = params.sensors;
    this._publisher = params.publisher;
    this._hlc = params.hlc;
    this._tickMs = params.tickMs ?? 1000;
  }

  private _startPromise?: Promise<boolean>;

  async start(useBackground: boolean = false): Promise<boolean> {
    if (this._running) return true;
    if (this._startPromise) return this._startPromise;

    this._startPromise = this._doStart(useBackground);
    const result = await this._startPromise;
    this._startPromise = undefined;
    return result;
  }

  private async _doStart(useBackground: boolean): Promise<boolean> {
    // Task 2.4 - Request Permissions Flow
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      console.warn('TrackingService start aborted: location permission denied.');
      return false;
    }

    try {
      this._running = true;
      await this._sensors.start({
        onGpsFix: (lat, lng) => {
          this._hasInitialFix = true;
          this._ekf.update(lat, lng);
        }
      }, useBackground);

      this._timer = setInterval(() => this._onTick(), this._tickMs);
      return true;
    } catch (err) {
      console.error('TrackingService start failed:', err);
      this._running = false;
      await this._sensors.stop();
      return false;
    }
  }

  private _onTick(): void {
    if (!this._hasInitialFix) {
      return;
    }

    // Calculate dt from tick interval
    const dt = this._tickMs / 1000.0;

    // Pull downsampled IMU data from SensorStream
    const imuSample = this._sensors.popImuSample();

    if (imuSample) {
      // Convert heading rate from rad/s to deg/s (gyroscope provides rad/s)
      const headingRateDegPerSec = (imuSample.headingRate * 180) / Math.PI;
      // Predict: pass acceleration (not speed) for IMU dead-reckoning
      this._ekf.predict(dt, imuSample.accelForward, headingRateDegPerSec);
    }

    // Advance HLC then immediately persist so restart-recovery always has latest state.
    const timestampHlc = this._hlc.now();
    persistHlc(this._hlc);

    const payload: VerifiedLocationPayload = {
      timestampHlc,
      lat: this._ekf.lat,
      lng: this._ekf.lng,
      speedMps: this._ekf.speed,
      headingDeg: this._ekf.heading,
      spoofFlag: this._ekf.spoofFlag,
      nisScore: this._ekf.nisScore,
      accuracyM: this._ekf.accuracyM,
    };
    this._publisher.publish(payload);
  }

  async stop(): Promise<void> {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = undefined;
    }
    await this._sensors.stop();
    this._running = false;
  }
}
