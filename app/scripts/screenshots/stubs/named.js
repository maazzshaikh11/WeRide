const sock = { on() {}, off() {}, emit() {}, connect() {}, disconnect() {}, connected: true };
const nav = () => ({ Navigator: () => null, Screen: () => null });
export const CommonActions = { navigate: (x) => x };
export const createBottomTabNavigator = nav;
export const createStackNavigator = nav;
export const TransitionPresets = {};
export const NavigationContainer = ({ children }) => children;
export const io = () => sock;
export class MMKV { getString() {} set() {} delete() {} getAllKeys() { return []; } contains() { return false; } }
export const accelerometer = { subscribe() { return { unsubscribe() {} }; } };
export const gyroscope = accelerometer;
export const setUpdateIntervalForType = () => {};
export default {};
