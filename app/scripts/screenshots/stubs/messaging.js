const inst = {
  getToken: async () => 'tok', onTokenRefresh: () => () => {}, onMessage: () => () => {}, requestPermission: async () => 1,
  hasPermission: async () => (globalThis.__NOTIF__ !== undefined ? globalThis.__NOTIF__ : -1), setBackgroundMessageHandler: () => {}, registerDeviceForRemoteMessages: async () => {},
  getAPNSToken: async () => 'apns', subscribeToTopic: async () => {}, unsubscribeFromTopic: async () => {},
  onNotificationOpenedApp: () => () => {}, getInitialNotification: async () => null, isDeviceRegisteredForRemoteMessages: true,
};
const messaging = () => inst;
messaging.AuthorizationStatus = { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 };
export default messaging;
