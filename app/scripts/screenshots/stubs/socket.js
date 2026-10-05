const sock = { on() {}, off() {}, emit() {}, connected: true };
export const getLocationSocket = () => sock;
export const getVoxSocket = () => sock;
export const sendSignal = () => {};
export const disconnectSockets = () => {};
