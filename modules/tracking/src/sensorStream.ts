/**
 * Sensor stream wrapper for GPS and IMU.
 *
 * IMU processing is attitude-aware (see ./attitude.ts):
 * a quaternion complementary filter fuses gyro + accelerometer to track
 * device orientation. Gravity is removed in the device frame, the residual
 * linear acceleration is rotated to the world frame (ENU) and projected
 * onto the GPS course-over-ground bearing to yield forward acceleration.
 * The gyro yaw rate is likewise expressed in the world frame and
 * sign-corrected for compass headings.
 *
 * When no GPS bearing is available (stationary / no fixes yet),
 * accelForward is null — meaning "unknown", NOT zero — so the EKF runs a
 * GPS-only constant-velocity prediction instead of inventing acceleration.
 */
import { AttitudeEstimator, Vec3 } from './attitude';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore unresolved when compiled from app context (deps live in module node_modules)
import Geolocation from 'react-native-geolocation-service';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore unresolved when compiled from app context (deps live in module node_modules)
import BackgroundGeolocation from 'react-native-background-geolocation';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore unresolved when compiled from app context (deps live in module node_modules)
import { accelerometer, gyroscope, setUpdateIntervalForType } from 'react-native-sensors';

export interface SensorDataCallbacks {
  onGpsFix: (lat: number, lng: number) => void;
}

export interface ImuSample {
  /**
   * Forward acceleration in m/s² along the GPS course-over-ground bearing,
   * or null when unknown (no bearing yet). Null means "GPS-only prediction",
   * never "zero acceleration".
   */
  accelForward: number | null;
  /** World-frame yaw rate in compass-heading degrees per second. */
  headingRate: number;
}

const METERS_PER_DEG_LAT = 111320;
/** Minimum GPS displacement (m) before the course-over-ground bearing updates. */
const BEARING_MIN_DISPLACEMENT_M = 3;
/** Bearing older than this (ms) is treated as unknown. */
const BEARING_MAX_AGE_MS = 10_000;

export class SensorStream {
  private _gpsWatch?: number;
  private _bgGpsActive = false;
  private _accelSub?: { unsubscribe: () => void };
  private _gyroSub?: { unsubscribe: () => void };

  private _bgLocationSub?: { remove: () => void };

  // Attitude estimator: gyro+accel → device orientation (device→world).
  private _attitude = new AttitudeEstimator();

  // O(1) aggregation accumulators (raw accel averaged over the tick window)
  private _accelSumX = 0;
  private _accelSumY = 0;
  private _accelSumZ = 0;
  private _accelCount = 0;

  // Latest gyro sample + timestamp, for pairing with accel callbacks.
  private _latestGyro: Vec3 | null = null;
  private _lastAccelAtSec = 0;

  // GPS course-over-ground bearing (radians, clockwise from north).
  private _lastGps: { lat: number; lng: number } | null = null;
  private _bearingRad: number | null = null;
  private _bearingAtMs = 0;

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
        this._handleGpsFix(location.coords.latitude, location.coords.longitude, callbacks);
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
          this._handleGpsFix(pos.coords.latitude, pos.coords.longitude, callbacks);
        },
        (err: any) => console.warn('GPS error', err),
        { enableHighAccuracy: true, distanceFilter: 0, interval: 1000, fastestInterval: 500 }
      );
    }

    // 10 Hz sensor collection (unit is milliseconds; 0 = fastest, which
    // triggers HIGH_SAMPLING_RATE_SENSORS SecurityException on Android 12+).
    setUpdateIntervalForType('accelerometer', 100);
    setUpdateIntervalForType('gyroscope', 100);

    if (!this._accelSub) {
      this._accelSub = accelerometer.subscribe(({ x, y, z }: { x: number, y: number, z: number }) => {
        const nowSec = Date.now() / 1000;
        const dt = this._lastAccelAtSec > 0
          ? Math.min(Math.max(nowSec - this._lastAccelAtSec, 0.001), 0.5)
          : 0.1;
        this._lastAccelAtSec = nowSec;

        // Feed the attitude filter with the latest gyro sample.
        if (this._latestGyro) {
          this._attitude.update(this._latestGyro, { x, y, z }, dt);
        }

        this._accelSumX += x;
        this._accelSumY += y;
        this._accelSumZ += z;
        this._accelCount++;
      });
    }

    if (!this._gyroSub) {
      this._gyroSub = gyroscope.subscribe(({ x, y, z }: { x: number, y: number, z: number }) => {
        this._latestGyro = { x, y, z };
      });
    }
  }

  /**
   * Records a GPS fix: updates the course-over-ground bearing when the
   * device has moved enough, then forwards the fix to the caller.
   */
  private _handleGpsFix(lat: number, lng: number, callbacks: SensorDataCallbacks): void {
    const prev = this._lastGps;
    this._lastGps = { lat, lng };
    if (prev) {
      const dNorth = (lat - prev.lat) * METERS_PER_DEG_LAT;
      const dEast = (lng - prev.lng) * METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
      if (Math.hypot(dNorth, dEast) >= BEARING_MIN_DISPLACEMENT_M) {
        // atan2(east, north): radians clockwise from north.
        this._bearingRad = Math.atan2(dEast, dNorth);
        this._bearingAtMs = Date.now();
      }
    }
    callbacks.onGpsFix(lat, lng);
  }

  /** Current course-over-ground bearing, or null when unknown/stale. */
  private _currentBearingRad(): number | null {
    if (this._bearingRad == null) return null;
    if (Date.now() - this._bearingAtMs > BEARING_MAX_AGE_MS) return null;
    return this._bearingRad;
  }

  /**
   * Returns the aggregated IMU sample since the last call, or null if no samples arrived.
   * Resets the aggregation window.
   */
  popImuSample(): ImuSample | null {
    if (this._accelCount === 0 || this._latestGyro == null) {
      // If we didn't get any samples, return null to avoid fabricating data.
      // Reset accumulators to prevent stale data from leaking into the next window.
      this._resetAccumulators();
      return null;
    }

    const avgAccel: Vec3 = {
      x: this._accelSumX / this._accelCount,
      y: this._accelSumY / this._accelCount,
      z: this._accelSumZ / this._accelCount,
    };
    // World-frame yaw rate, sign-corrected for compass headings.
    const headingRate = this._attitude.worldYawRateDegPerSec(this._latestGyro);
    // Forward accel along GPS bearing; null when the bearing is unknown
    // (caller runs GPS-only constant-velocity prediction in that case).
    const accelForward = this._attitude.forwardAccel(avgAccel, this._currentBearingRad());

    this._resetAccumulators();

    return { accelForward, headingRate };
  }

  private _resetAccumulators(): void {
    this._accelSumX = 0;
    this._accelSumY = 0;
    this._accelSumZ = 0;
    this._accelCount = 0;
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

    // Reset aggregation + estimator state on stop
    this._resetAccumulators();
    this._latestGyro = null;
    this._lastAccelAtSec = 0;
    this._attitude = new AttitudeEstimator();
    this._lastGps = null;
    this._bearingRad = null;
    this._bearingAtMs = 0;
  }
}
