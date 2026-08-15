/**
 * Wraps platform sensor streams (GPS via react-native-geolocation-service,
 * IMU via react-native-sensors) and feeds the EKF.
 * Also provides the latest sensor values for the EKF prediction step.
 *
 * Ported from sensor_stream.dart.
 *
 * TODO: handle permission requests, background location, sensor downsampling.
 */

import Geolocation from 'react-native-geolocation-service';
import { accelerometer, gyroscope } from 'react-native-sensors';
import { Ekf } from './ekf';

export type SensorTickCallback = () => void;

export class SensorStream {
  accelMagnitude = 0;
  headingRate = 0; // deg/s from gyro

  private _gpsWatch?: number;
  private _accelSub?: { unsubscribe: () => void };
  private _gyroSub?: { unsubscribe: () => void };

  start(ekf: Ekf, onTick: SensorTickCallback): void {
    // IMU streams — react-native-sensors uses Observables
    this._accelSub = accelerometer.subscribe(({ x, y, z }) => {
      this.accelMagnitude = x * x + y * y + z * z;
    });
    this._gyroSub = gyroscope.subscribe(({ z }) => {
      this.headingRate = z; // z-axis rotation → heading rate
    });

    this._gpsWatch = Geolocation.watchPosition(
      (pos) => {
        ekf.update(pos.coords.latitude, pos.coords.longitude);
        onTick();
      },
      (err) => console.warn('GPS error', err),
      { enableHighAccuracy: true, distanceFilter: 0, interval: 1000, fastestInterval: 500 }
    );
  }

  async stop(): Promise<void> {
    if (this._gpsWatch != null) Geolocation.clearWatch(this._gpsWatch);
    this._accelSub?.unsubscribe();
    this._gyroSub?.unsubscribe();
  }
}