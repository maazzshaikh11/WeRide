// Mock react-native-sensors for Jest (mirrored in every module's test/__mocks__).
const makeObservable = () => ({
  subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
});

const accelerometer = makeObservable();
const gyroscope = makeObservable();
const magnetometer = makeObservable();
const orientation = makeObservable();
const gravity = makeObservable();

const setUpdateIntervalForType = jest.fn();
const setLogLevelForType = jest.fn();

module.exports = {
  accelerometer,
  gyroscope,
  magnetometer,
  orientation,
  gravity,
  setUpdateIntervalForType,
  setLogLevelForType,
  SensorTypes: {
    accelerometer: 'accelerometer',
    gyroscope: 'gyroscope',
    magnetometer: 'magnetometer',
    orientation: 'orientation',
    gravity: 'gravity',
  },
};