/**
 * Sensor stream wrapper for GPS and IMU.
 *
 * PHASE 1 LIMITATION:
 * The current accelerometer interface provides raw {x, y, z} values in device frame.
 * Without device attitude/orientation, we CANNOT correctly compute vehicle-forward acceleration.
 *
 * Current implementation: magnitude - gravity (simplified, not physically correct forward accel).
 * This is a placeholder for Phase 1 prediction interface.
 *
 * Phase 2+ requirement: Integrate device attitude or use platform-provided motion API.
 */

// @ts-ignore
import Geolocation from 'react-native-geolocation-service';
// @ts-ignore
import BackgroundGeolocation from 'react-native-background-geolocation';
// @ts-ignore
import { accelerometer, gyroscope } from 'react-native-sensors';

const GRAVITY_MPS2 = 9.81;

export interface SensorDataCallbacks {
  onGpsFix: (lat: number, lng: number) => void;
}

export interface ImuSample {
  accelForward: number;
  headingRate: number;
}

export class SensorStream {
  private _gpsWatch?: number;
  private _bgGpsActive = false;
  private _accelSub?: { unsubscribe: () => void };
  private _gyroSub?: { unsubscribe: () => void };

  private _bgLocationSub?: { remove: () => void };

  // O(1) aggregation accumulators
  private _accelSum = 0;
  private _accelCount = 0;
  private _headingRateSum = 0;
  private _headingRateCount = 0;

  /**
   * Starts the sensor stream.
   * @param callbacks Callback for GPS fixes.
   * @param useBackground If true, uses background geolocation. If background is unavailable, it will throw an error rather than silently fallback.
   */
  async start(callbacks: SensorDataCallbacks, useBackground: boolean = false): Promise<void> {
    if (this._gpsWatch != null || this._bgGpsActive) {
      // Prevent duplicate start
      return;
    }

    if (useBackground) {
      if (!BackgroundGeolocation) {
        throw new Error('BackgroundGeolocation is not available or configured properly.');
      }

      const state = await BackgroundGeolocation.ready({
        desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
        distanceFilter: 0,
        locationUpdateInterval: 1000,
        fastestLocationUpdateInterval: 500,
        stopOnTerminate: false,
        startOnBoot: true,
      });

      this._bgLocationSub = BackgroundGeolocation.onLocation((location: any) => {
        callbacks.onGpsFix(location.coords.latitude, location.coords.longitude);
      }, (err: any) => {
        console.warn('Background GPS error', err);
      });

      if (!state.enabled) {
        await BackgroundGeolocation.start();
      }
      this._bgGpsActive = true;
    } else {
      this._gpsWatch = Geolocation.watchPosition(
        (pos: any) => {
          callbacks.onGpsFix(pos.coords.latitude, pos.coords.longitude);
        },
        (err: any) => console.warn('GPS error', err),
        { enableHighAccuracy: true, distanceFilter: 0, interval: 1000, fastestInterval: 500 }
      );
    }

    if (!this._accelSub) {
      this._accelSub = accelerometer.subscribe(({ x, y, z }: { x: number, y: number, z: number }) => {
        const accelMagnitude = Math.sqrt(x * x + y * y + z * z);
        const corrected = accelMagnitude - GRAVITY_MPS2;
        const accelForward = Math.max(-5, Math.min(5, corrected));

        this._accelSum += accelForward;
        this._accelCount++;
      });
    }

    if (!this._gyroSub) {
      this._gyroSub = gyroscope.subscribe(({ z }: { z: number }) => {
        this._headingRateSum += z;
        this._headingRateCount++;
      });
    }
  }

  /**
   * Returns the aggregated IMU sample since the last call, or null if no samples arrived.
   * Resets the aggregation window.
   */
  popImuSample(): ImuSample | null {
    if (this._accelCount === 0 || this._headingRateCount === 0) {
      // If we didn't get any samples, return null to avoid fabricating data.
      // Reset accumulators to prevent stale data from leaking into the next window.
      this._accelSum = 0;
      this._accelCount = 0;
      this._headingRateSum = 0;
      this._headingRateCount = 0;
      return null;
    }

    const accelForward = this._accelSum / this._accelCount;
    const headingRate = this._headingRateSum / this._headingRateCount;

    // Reset accumulators
    this._accelSum = 0;
    this._accelCount = 0;
    this._headingRateSum = 0;
    this._headingRateCount = 0;

    return { accelForward, headingRate };
  }

  async stop(): Promise<void> {
    if (this._gpsWatch != null) {
      Geolocation.clearWatch(this._gpsWatch);
      this._gpsWatch = undefined;
    }

    if (this._bgGpsActive && BackgroundGeolocation) {
      if (this._bgLocationSub) {
        this._bgLocationSub.remove();
        this._bgLocationSub = undefined;
      }
      await BackgroundGeolocation.stop();
      this._bgGpsActive = false;
    }

    if (this._accelSub) {
      this._accelSub.unsubscribe();
      this._accelSub = undefined;
    }
    if (this._gyroSub) {
      this._gyroSub.unsubscribe();
      this._gyroSub = undefined;
    }

    // Reset accumulators on stop
    this._accelSum = 0;
    this._accelCount = 0;
    this._headingRateSum = 0;
    this._headingRateCount = 0;
  }
}
