/**
 * Ties sensors → EKF → publisher. The on-device tracking service.
 * Runs at 1 Hz (configurable). Uses Person B's HLC for timestamps.
 * Ported from tracking_service.dart.
 *
 * TODO: background execution (react-native-background-geolocation on Android,
 * always-on location permission on iOS).
 */

import { Ekf } from './ekf';
import { SensorStream } from './sensorStream';
import { LocationPublisher, VerifiedLocationPayload } from './locationPublisher';

/** HLC interface — implemented in modules/hazard-sos/src/hlc/hlc.ts */
export interface HlcSource {
  now(): string;
}

export interface TrackingServiceParams {
  ekf: Ekf;
  sensors: SensorStream;
  publisher: LocationPublisher;
  hlc: HlcSource;
  tickMs?: number;
}

export class TrackingService {
  private _ekf: Ekf;
  private _sensors: SensorStream;
  private _publisher: LocationPublisher;
  private _hlc: HlcSource;
  private _tickMs: number;
  private _timer?: ReturnType<typeof setInterval>;
  private _running = false;

  constructor(params: TrackingServiceParams) {
    this._ekf = params.ekf;
    this._sensors = params.sensors;
    this._publisher = params.publisher;
    this._hlc = params.hlc;
    this._tickMs = params.tickMs ?? 1000;
  }

  start(): void {
    if (this._running) return;
    this._running = true;
    this._sensors.start(this._ekf, () => this._onTick());
    this._timer = setInterval(() => this._onTick(), this._tickMs);
  }

  private _onTick(): void {
    this._ekf.predict(1.0, this._ekf.speed, this._sensors.headingRate);
    const payload: VerifiedLocationPayload = {
      timestampHlc: this._hlc.now(),
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
    if (this._timer) clearInterval(this._timer);
    await this._sensors.stop();
    this._running = false;
  }
}