// Jest setup for WeRide app.
// Mock native modules that have no JS implementation in the test environment.

jest.mock('react-native-mmkv', () => ({
  useMMKVString: jest.fn(() => ['', jest.fn()]),
  MMKV: jest.fn().mockImplementation(() => ({
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    getAllKeys: jest.fn(() => []),
    contains: jest.fn(() => false),
  })),
}));

jest.mock('react-native-geolocation-service', () => ({
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
  requestAuthorization: jest.fn(() => Promise.resolve('granted')),
}));

jest.mock('react-native-sensors', () => ({
  accelerometer: { subscribe: jest.fn() },
  gyroscope: { subscribe: jest.fn() },
}));

jest.mock('@rnmapbox/maps', () => ({
  MapView: 'MapView',
  Camera: 'Camera',
  ShapeSource: 'ShapeSource',
  CircleLayer: 'CircleLayer',
  LineLayer: 'LineLayer',
  SymbolLayer: 'SymbolLayer',
}));