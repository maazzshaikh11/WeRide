import { TrackingService } from '../src/trackingService';
import { Ekf } from '../src/ekf';
import { SensorStream, ImuSample } from '../src/sensorStream';
import { LocationPublisher } from '../src/locationPublisher';
import { requestLocationPermission } from '../src/permissions';
import { HLC } from '@hazard/hlc/hlc';

// Mock dependencies
jest.mock('../src/permissions', () => ({
  requestLocationPermission: jest.fn(),
}));

jest.mock('react-native-geolocation-service', () => ({}), { virtual: true });
jest.mock('react-native-background-geolocation', () => ({}), { virtual: true });
jest.mock('react-native-sensors', () => ({}), { virtual: true });
jest.mock('socket.io-client', () => ({}), { virtual: true });
jest.mock('@react-native-firebase/firestore', () => ({}), { virtual: true });
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  PermissionsAndroid: { request: jest.fn(), RESULTS: { GRANTED: 'granted' } }
}), { virtual: true });

// Mock hlcStore so TrackingService.persistHlc() is a no-op in these tests.
// HLC persistence correctness is verified in hlcStore.test.ts.
jest.mock('../src/hlcStore', () => ({
  persistHlc: jest.fn(),
  loadHlc: jest.fn(),
  HLC_MMKV_KEY: 'tracking:hlc_state',
  _resetMmkvForTest: jest.fn(),
}));

jest.mock('../src/ekf');
jest.mock('../src/sensorStream');
jest.mock('../src/locationPublisher');

describe('TrackingService', () => {
  let ekf: jest.Mocked<Ekf>;
  let sensors: jest.Mocked<SensorStream>;
  let publisher: jest.Mocked<LocationPublisher>;
  let hlc: HLC;
  let service: TrackingService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    ekf = new Ekf({ lat: 0, lng: 0, speed: 0, heading: 0, r: [0, 0, 0, 0] }) as jest.Mocked<Ekf>;
    sensors = new SensorStream() as jest.Mocked<SensorStream>;
    publisher = new LocationPublisher({ socket: {} as any, riderId: 'user1', groupId: 'group1' }) as jest.Mocked<LocationPublisher>;
    hlc = HLC.fresh();

    service = new TrackingService({ ekf, sensors, publisher, hlc, tickMs: 1000 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Permissions and Startup', () => {
    it('aborts start if permission is denied', async () => {
      (requestLocationPermission as jest.Mock).mockResolvedValue(false);

      const result = await service.start();

      expect(result).toBe(false);
      expect(sensors.start).not.toHaveBeenCalled();
    });

    it('starts successfully if permission granted', async () => {
      (requestLocationPermission as jest.Mock).mockResolvedValue(true);

      const result = await service.start();
      expect(result).toBe(true);
      expect(sensors.start).toHaveBeenCalled();
    });

    it('handles concurrent start() calls gracefully', async () => {
      (requestLocationPermission as jest.Mock).mockResolvedValue(true);

      // Fire two start calls concurrently without awaiting the first
      const p1 = service.start();
      const p2 = service.start();

      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1).toBe(true);
      expect(r2).toBe(true);

      // Should only initialize sensors once
      expect(sensors.start).toHaveBeenCalledTimes(1);
      expect(requestLocationPermission).toHaveBeenCalledTimes(1);
    });

    it('cleans up sensors if start fails after partial initialization', async () => {
      (requestLocationPermission as jest.Mock).mockResolvedValue(true);
      sensors.start.mockRejectedValue(new Error('Simulated start failure'));

      const result = await service.start();

      expect(result).toBe(false);
      expect(sensors.start).toHaveBeenCalledTimes(1);
      // Ensure stop is called in the failure path
      expect(sensors.stop).toHaveBeenCalledTimes(1);
    });

    it('start twice is idempotent', async () => {
      (requestLocationPermission as jest.Mock).mockResolvedValue(true);

      await service.start();
      await service.start();

      expect(requestLocationPermission).toHaveBeenCalledTimes(1);
      expect(sensors.start).toHaveBeenCalledTimes(1);
    });
  });

  describe('Initial Fix Guard', () => {
    it('does not publish or predict on tick if no GPS fix has been received', async () => {
      (requestLocationPermission as jest.Mock).mockResolvedValue(true);
      await service.start();

      jest.advanceTimersByTime(1000);

      expect(ekf.predict).not.toHaveBeenCalled();
      expect(publisher.publish).not.toHaveBeenCalled();
    });
  });

  describe('Lifecycle and Ticks', () => {
    beforeEach(async () => {
      (requestLocationPermission as jest.Mock).mockResolvedValue(true);
      await service.start();

      // Simulate initial GPS fix so hasInitialFix becomes true
      const onGpsFix = sensors.start.mock.calls[0][0].onGpsFix;
      onGpsFix(37.7749, -122.4194);
    });

    it('skips ekf.predict on tick if no IMU data', () => {
      sensors.popImuSample.mockReturnValue(null);

      jest.advanceTimersByTime(1000);

      expect(ekf.predict).not.toHaveBeenCalled();
      expect(publisher.publish).toHaveBeenCalled();
    });

    it('calls ekf.predict on tick with downsampled IMU data', () => {
      const imuSample: ImuSample = { accelForward: 2.5, headingRate: Math.PI / 2 };
      sensors.popImuSample.mockReturnValue(imuSample);

      jest.advanceTimersByTime(1000);

      // headingRate in degrees = (PI/2 * 180 / PI) = 90
      expect(ekf.predict).toHaveBeenCalledWith(1.0, 2.5, 90);
    });

    it('gps callback routes to ekf.update', () => {
      const onGpsFix = sensors.start.mock.calls[0][0].onGpsFix;

      onGpsFix(37.7749, -122.4194);

      expect(ekf.update).toHaveBeenCalledWith(37.7749, -122.4194);
    });

    it('continues ticking when publisher.publish does not throw (caught Firestore failures)', () => {
      sensors.popImuSample.mockReturnValue(null);
      // Simulate publisher succeeding (or having internally caught an error)
      publisher.publish.mockImplementation(() => {});

      jest.advanceTimersByTime(1000);
      expect(publisher.publish).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(1000);
      expect(publisher.publish).toHaveBeenCalledTimes(2);

      jest.advanceTimersByTime(1000);
      expect(publisher.publish).toHaveBeenCalledTimes(3);
    });

    it('cleans up on stop', async () => {
      await service.stop();

      expect(sensors.stop).toHaveBeenCalled();

      // Timer should be cleared, advancing time shouldn't call predict again
      ekf.predict.mockClear();
      jest.advanceTimersByTime(1000);
      expect(ekf.predict).not.toHaveBeenCalled();
    });
  });
});
