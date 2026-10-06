// react-native for the browser: react-native-web plus the few native-only exports the app touches at import time.
export * from 'react-native-web';
import { Platform } from 'react-native-web';
// The app is built for phones; render its iOS branches.
Platform.OS = 'ios';
Platform.Version = '17.0';
Platform.select = (o) => (o && (o.ios !== undefined ? o.ios : o.native !== undefined ? o.native : o.default));
export const PermissionsAndroid = {
  PERMISSIONS: {},
  RESULTS: { GRANTED: 'granted', DENIED: 'denied', NEVER_ASK_AGAIN: 'never_ask_again' },
  check: async () => false,
  request: async () => 'denied',
  requestMultiple: async () => ({}),
};
export const ToastAndroid = { show() {}, SHORT: 0, LONG: 1 };
export const BackHandler = { addEventListener: () => ({ remove() {} }), removeEventListener() {}, exitApp() {} };
