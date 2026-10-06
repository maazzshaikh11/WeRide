// react-native-geolocation-service: always answers with the rider's position (globalThis.__POS__ or Bandra Fort).
const pos = () => globalThis.__POS__ || { latitude: 19.0419, longitude: 72.8188, accuracy: 5 };
const Geo = {
  getCurrentPosition: (ok) => setTimeout(() => ok({ coords: pos(), timestamp: Date.now() }), 30),
  watchPosition: () => 1, clearWatch() {}, stopObserving() {}, requestAuthorization: async () => 'granted',
};
module.exports = Geo; module.exports.default = Geo; module.exports.__esModule = true;
