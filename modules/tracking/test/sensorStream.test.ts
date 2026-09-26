import { SensorStream, ImuSample } from '../src/sensorStream';
// @ts-ignore
import Geolocation from 'react-native-geolocation-service';
// @ts-ignore
import BackgroundGeolocation from 'react-native-background-geolocation';
// @ts-ignore
import { accelerometer, gyroscope } from 'react-native-sensors';

// Mock dependencies
jest.mock('react-native-geolocation-service', () => ({
  watchPosition: jest.fn().mockReturnValue(123),
  clearWatch: jest.fn(),
  requestAuthorization: jest.fn().mockResolvedValue('granted'),
}), { virtual: true });

jest.mock('react-native-background-geolocation', () => ({
  ready: jest.fn().mockResolvedValue({ enabled: false }),
  onLocation: jest.fn(),
  start: jest.fn().mockResolvedValue(true),
  stop: jest.fn().mockResolvedValue(true),
  removeAllListeners: jest.fn(),
  DESIRED_ACCURACY_HIGH: 0,
}), { virtual: true });

// Provide minimal mock for accelerometer and gyroscope
let accelCallback: ((val: {x:number,y:number,z:number}) => void) | undefined;
let gyroCallback: ((val: {x:number,y:number,z:number}) => void) | undefined;

jest.mock('react-native-sensors', () => ({
  accelerometer: {
    subscribe: jest.fn((cb) => {
      accelCallback = cb;
      return { unsubscribe: jest.fn() };
    }),
  },
  gyroscope: {
    subscribe: jest.fn((cb) => {
      gyroCallback = cb;
      return { unsubscribe: jest.fn() };
    }),
  },
  setUpdateIntervalForType: jest.fn(),
  setLogLevelForType: jest.fn(),
}), { virtual: true });

describe('SensorStream', () => {
  let sensorStream: SensorStream;

  beforeEach(() => {
    jest.clearAllMocks();
    sensorStream = new SensorStream();
    accelCallback = undefined;
    gyroCallback = undefined;
  });

  describe('Lifecycle and GPS Configuration', () => {
    it('uses foreground geolocation by default', async () => {
      const callbacks = { onGpsFix: jest.fn() };
      await sensorStream.start(callbacks, false);

      expect(Geolocation.watchPosition).toHaveBeenCalled();
      expect(BackgroundGeolocation.ready).not.toHaveBeenCalled();
    });

    it('uses background geolocation when configured', async () => {
      const callbacks = { onGpsFix: jest.fn() };
      await sensorStream.start(callbacks, true);

      expect(BackgroundGeolocation.ready).toHaveBeenCalled();
      expect(BackgroundGeolocation.onLocation).toHaveBeenCalled();
      expect(BackgroundGeolocation.start).toHaveBeenCalled();
      expect(Geolocation.watchPosition).not.toHaveBeenCalled();
    });

    it('start twice does not create duplicate watchers', async () => {
      const callbacks = { onGpsFix: jest.fn() };
      await sensorStream.start(callbacks, false);
      await sensorStream.start(callbacks, false);

      expect(Geolocation.watchPosition).toHaveBeenCalledTimes(1);
    });

    it('cleans up watchers on stop', async () => {
      const callbacks = { onGpsFix: jest.fn() };
      await sensorStream.start(callbacks, false);
      await sensorStream.stop();

      expect(Geolocation.clearWatch).toHaveBeenCalledWith(123);

      const accelSub = (accelerometer.subscribe as jest.Mock).mock.results[0].value;
      const gyroSub = (gyroscope.subscribe as jest.Mock).mock.results[0].value;
      expect(accelSub.unsubscribe).toHaveBeenCalled();
      expect(gyroSub.unsubscribe).toHaveBeenCalled();
    });

    it('cleans up background watchers on stop', async () => {
      const callbacks = { onGpsFix: jest.fn() };
      const subMock = { remove: jest.fn() };
      (BackgroundGeolocation.onLocation as jest.Mock).mockReturnValue(subMock);

      await sensorStream.start(callbacks, true);
      await sensorStream.stop();

      expect(subMock.remove).toHaveBeenCalled();
      expect(BackgroundGeolocation.stop).toHaveBeenCalled();
    });

    it('stop twice is idempotent', async () => {
      const callbacks = { onGpsFix: jest.fn() };
      await sensorStream.start(callbacks, false);
      await sensorStream.stop();
      await sensorStream.stop();

      expect(Geolocation.clearWatch).toHaveBeenCalledTimes(1);
    });

    it('stop then start re-initializes correctly', async () => {
      const callbacks = { onGpsFix: jest.fn() };
      await sensorStream.start(callbacks, false);
      await sensorStream.stop();
      await sensorStream.start(callbacks, false);

      expect(Geolocation.watchPosition).toHaveBeenCalledTimes(2);
      expect(Geolocation.clearWatch).toHaveBeenCalledTimes(1);
    });
  });

  describe('IMU attitude-aware processing', () => {
    // Grab the geolocation success callback to inject GPS fixes.
    function gpsSuccess() {
      const calls = (Geolocation.watchPosition as jest.Mock).mock.calls;
      return calls[0][0] as (pos: { coords: { latitude: number; longitude: number } }) => void;
    }

    function fixMovingNorth() {
      const cb = gpsSuccess();
      cb({ coords: { latitude: 37.0, longitude: -122.0 } });
      // ~10 m north: establishes course-over-ground bearing = 0 (north).
      cb({ coords: { latitude: 37.0 + 10 / 111320, longitude: -122.0 } });
    }

    it('returns null when no IMU data has arrived', async () => {
      const callbacks = { onGpsFix: jest.fn() };
      await sensorStream.start(callbacks, false);

      const imu = sensorStream.popImuSample();
      expect(imu).toBeNull();
    });

    it('projects forward acceleration onto the GPS bearing', async () => {
      const callbacks = { onGpsFix: jest.fn() };
      await sensorStream.start(callbacks, false);
      fixMovingNorth();

      // Seed attitude with a flat static sample in its own window, then
      // accelerate north at 2 m/s² (device flat, top pointing north).
      gyroCallback!({ x: 0, y: 0, z: 0 });
      accelCallback!({ x: 0, y: 0, z: 9.81 });
      sensorStream.popImuSample(); // discard the seed window
      accelCallback!({ x: 0, y: 2, z: 9.81 });
      accelCallback!({ x: 0, y: 2, z: 9.81 });

      const imu = sensorStream.popImuSample();
      expect(imu).not.toBeNull();
      // Sustained acceleration is partly absorbed as tilt by the complementary
      // filter (fundamental IMU ambiguity); expect ≈2 within a wide tolerance.
      expect(imu?.accelForward).toBeCloseTo(2.0, 0);
      expect(imu?.headingRate).toBeCloseTo(0, 6);
    });

    it('vertical acceleration does not count as forward motion', async () => {
      const callbacks = { onGpsFix: jest.fn() };
      await sensorStream.start(callbacks, false);
      fixMovingNorth();

      gyroCallback!({ x: 0, y: 0, z: 0 });
      accelCallback!({ x: 0, y: 0, z: 9.81 });
      // Bump: +2 m/s² straight up — horizontal projection must be ≈ 0.
      accelCallback!({ x: 0, y: 0, z: 9.81 + 2 });

      const imu = sensorStream.popImuSample();
      expect(imu).not.toBeNull();
      expect(imu?.accelForward).toBeCloseTo(0.0, 1);
    });

    it('accelForward is null (unknown) when no GPS bearing exists', async () => {
      const callbacks = { onGpsFix: jest.fn() };
      await sensorStream.start(callbacks, false);
      // No GPS fixes injected → no course-over-ground bearing.

      gyroCallback!({ x: 0, y: 0, z: 0 });
      accelCallback!({ x: 0, y: 0, z: 9.81 });
      accelCallback!({ x: 0, y: 2, z: 9.81 });

      const imu = sensorStream.popImuSample();
      expect(imu).not.toBeNull();
      expect(imu?.accelForward).toBeNull();
      // Yaw rate is still valid without a bearing.
      expect(imu?.headingRate).toBeCloseTo(0, 6);
    });

    it('headingRate is world yaw rate in deg/s (CCW-from-above is negative)', async () => {
      const callbacks = { onGpsFix: jest.fn() };
      await sensorStream.start(callbacks, false);

      gyroCallback!({ x: 0, y: 0, z: 0 });
      accelCallback!({ x: 0, y: 0, z: 9.81 });
      // +0.5 rad/s about device z, phone flat = left turn → heading decreases.
      gyroCallback!({ x: 0, y: 0, z: 0.5 });
      accelCallback!({ x: 0, y: 0, z: 9.81 });

      const imu = sensorStream.popImuSample();
      expect(imu).not.toBeNull();
      expect(imu?.headingRate).toBeCloseTo((-0.5 * 180) / Math.PI, 3);
    });

    it('discards incomplete window and prevents stale data leak', async () => {
      const callbacks = { onGpsFix: jest.fn() };
      await sensorStream.start(callbacks, false);

      // Window 1: Accel arrives, no gyro
      accelCallback!({ x: 0, y: 0, z: 9.81 + 5.0 });

      const imu1 = sensorStream.popImuSample();
      expect(imu1).toBeNull(); // Missing gyro, so it returns null

      // Window 2: Fresh accel and gyro arrive
      gyroCallback!({ x: 0, y: 0, z: 0 });
      accelCallback!({ x: 0, y: 0, z: 9.81 });
      fixMovingNorth();
      accelCallback!({ x: 0, y: 1, z: 9.81 });

      const imu2 = sensorStream.popImuSample();
      expect(imu2).not.toBeNull();
      // Must reflect only window 2 (the seed sample is static → ≈0 forward).
      expect(imu2?.accelForward).not.toBeNull();
    });

    it('resets accumulators after popping', async () => {
      const callbacks = { onGpsFix: jest.fn() };
      await sensorStream.start(callbacks, false);

      gyroCallback!({ x: 0, y: 0, z: 0 });
      accelCallback!({ x: 0, y: 0, z: 9.81 });

      const imu1 = sensorStream.popImuSample();
      expect(imu1).not.toBeNull();

      const imu2 = sensorStream.popImuSample();
      expect(imu2).toBeNull();
    });
  });
});
