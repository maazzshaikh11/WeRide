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
  MarkerView: 'MarkerView',
  UserLocation: 'UserLocation',
  UserTrackingMode: {
    Follow: 'normal',
    FollowWithHeading: 'compass',
    FollowWithCourse: 'course',
  },
  StyleURL: { Dark: 'mapbox://styles/mapbox/dark-v11' },
  setAccessToken: jest.fn(),
}));

jest.mock('@env', () => ({
  MAPBOX_TOKEN: 'pk.test-mapbox-token-placeholder',
  SOCKET_URL: 'http://localhost:3000',
  ROUTING_URL: 'http://localhost:3000',
}));

// Firebase's native packages are ESM and need a device. Suites that exercise them mock them (or the
// service on top of them) explicitly; this default only makes importing a service safe in any suite.
jest.mock('@react-native-firebase/firestore', () => {
  const docRef = () => ({ get: jest.fn(), set: jest.fn(), update: jest.fn(), delete: jest.fn(), onSnapshot: jest.fn(() => jest.fn()), collection: jest.fn(() => collectionRef()) });
  const collectionRef = () => ({ doc: jest.fn(docRef), where: jest.fn(() => collectionRef()), limit: jest.fn(() => collectionRef()), orderBy: jest.fn(() => collectionRef()), get: jest.fn(), onSnapshot: jest.fn(() => jest.fn()), add: jest.fn() });
  const firestore: any = jest.fn(() => ({ doc: jest.fn(docRef), collection: jest.fn(collectionRef), batch: jest.fn(() => ({ set: jest.fn(), update: jest.fn(), delete: jest.fn(), commit: jest.fn() })), runTransaction: jest.fn() }));
  firestore.FieldValue = { serverTimestamp: jest.fn(() => 'ts'), increment: jest.fn((n: number) => ({ inc: n })), arrayUnion: jest.fn((...a: unknown[]) => ({ union: a })), arrayRemove: jest.fn((...a: unknown[]) => ({ remove: a })), delete: jest.fn() };
  firestore.FieldPath = { documentId: jest.fn(() => '__name__') };
  firestore.Timestamp = { fromMillis: jest.fn((ms: number) => ({ toMillis: () => ms })), now: jest.fn(() => ({ toMillis: () => Date.now() })) };
  return { __esModule: true, default: firestore };
});
jest.mock('@react-native-firebase/auth', () => {
  const auth: any = jest.fn(() => ({ currentUser: null, onAuthStateChanged: jest.fn(() => jest.fn()), signOut: jest.fn(), signInWithPhoneNumber: jest.fn(), signInWithEmailAndPassword: jest.fn(), createUserWithEmailAndPassword: jest.fn() }));
  return { __esModule: true, default: auth };
});
jest.mock('@react-native-firebase/messaging', () => {
  const messaging: any = jest.fn(() => ({ requestPermission: jest.fn(), getToken: jest.fn(), onTokenRefresh: jest.fn(), hasPermission: jest.fn() }));
  return { __esModule: true, default: messaging };
});
