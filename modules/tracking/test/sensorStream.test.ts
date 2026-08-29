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

  describe('IMU Downsampling', () => {
    it('returns null when no IMU data has arrived', async () => {
      const callbacks = { onGpsFix: jest.fn() };
      await sensorStream.start(callbacks, false);

      const imu = sensorStream.popImuSample();
      expect(imu).toBeNull();
    });

    it('aggregates multiple IMU samples in O(1)', async () => {
      const callbacks = { onGpsFix: jest.fn() };
      await sensorStream.start(callbacks, false);

      expect(accelCallback).toBeDefined();
      expect(gyroCallback).toBeDefined();

      // Simulate 3 accel events and 3 gyro events
      // Mag = sqrt(0+0+z^2) = z. Corrected = Mag - 9.81
      accelCallback!({ x: 0, y: 0, z: 9.81 + 1.0 }); // forward = 1.0
      accelCallback!({ x: 0, y: 0, z: 9.81 + 3.0 }); // forward = 3.0
      accelCallback!({ x: 0, y: 0, z: 9.81 + 2.0 }); // forward = 2.0

      gyroCallback!({ x: 0, y: 0, z: 0.1 });
      gyroCallback!({ x: 0, y: 0, z: 0.3 });
      gyroCallback!({ x: 0, y: 0, z: 0.2 });

      const imu = sensorStream.popImuSample();
      expect(imu).not.toBeNull();
      // (1+3+2)/3 = 2.0
      expect(imu?.accelForward).toBeCloseTo(2.0);
      // (0.1+0.3+0.2)/3 = 0.2
      expect(imu?.headingRate).toBeCloseTo(0.2);
    });

    it('discards incomplete window and prevents stale data leak', async () => {
      const callbacks = { onGpsFix: jest.fn() };
      await sensorStream.start(callbacks, false);

      // Window 1: Accel arrives, no gyro
      accelCallback!({ x: 0, y: 0, z: 9.81 + 5.0 }); // forward = 5.0

      const imu1 = sensorStream.popImuSample();
      expect(imu1).toBeNull(); // Missing gyro, so it returns null

      // Window 2: Fresh accel and gyro arrive
      accelCallback!({ x: 0, y: 0, z: 9.81 + 1.0 }); // forward = 1.0
      gyroCallback!({ x: 0, y: 0, z: 0.1 });

      const imu2 = sensorStream.popImuSample();
      expect(imu2).not.toBeNull();
      // Should NOT include the 5.0 from Window 1
      expect(imu2?.accelForward).toBeCloseTo(1.0);
      expect(imu2?.headingRate).toBeCloseTo(0.1);
    });

    it('resets accumulators after popping', async () => {
      const callbacks = { onGpsFix: jest.fn() };
      await sensorStream.start(callbacks, false);

      accelCallback!({ x: 0, y: 0, z: 9.81 + 1.0 });
      gyroCallback!({ x: 0, y: 0, z: 0.1 });

      const imu1 = sensorStream.popImuSample();
      expect(imu1).not.toBeNull();

      const imu2 = sensorStream.popImuSample();
      expect(imu2).toBeNull();
    });
  });
});
