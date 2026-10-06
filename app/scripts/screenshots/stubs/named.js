const { withFallback } = require('./lib.js');
const sock = { on() {}, off() {}, emit() {}, connect() {}, disconnect() {}, connected: true };
const nav = () => ({ Navigator: () => null, Screen: () => null });
const mem = new Map();
class MMKV {
  getString(k) { return mem.get(k); } set(k, v) { mem.set(k, v); } delete(k) { mem.delete(k); }
  getAllKeys() { return [...mem.keys()]; } contains(k) { return mem.has(k); } getBoolean(k) { return mem.get(k); } getNumber(k) { return mem.get(k); }
}
const accelerometer = { subscribe() { return { unsubscribe() {} }; } };
module.exports = withFallback({
  CommonActions: { navigate: (x) => x, reset: (x) => x },
  createBottomTabNavigator: nav, createStackNavigator: nav, TransitionPresets: {},
  NavigationContainer: ({ children }) => children,
  createNavigationContainerRef: () => ({ isReady: () => false, navigate() {}, getCurrentRoute: () => undefined, dispatch() {}, resetRoot() {}, goBack() {}, canGoBack: () => false }),
  io: () => sock, MMKV,
  accelerometer, gyroscope: accelerometer, setUpdateIntervalForType: () => {},
  DarkTheme: { colors: {} }, DefaultTheme: { colors: {} },
});
