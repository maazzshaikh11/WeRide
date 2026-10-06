// Socket stand-in: records handlers so scenes can fire server events: __SOCK__.fire('signal:received', {...}).
const handlers = {};
const sock = {
  on(e, f) { (handlers[e] = handlers[e] || new Set()).add(f); }, off(e, f) { handlers[e]?.delete(f); },
  emit() {}, connected: true,
};
globalThis.__SOCK__ = { fire: (e, p) => handlers[e]?.forEach((f) => f(p)) };
export const getLocationSocket = () => sock;
export const getVoxSocket = () => sock;
export const sendSignal = () => {};
export const disconnectSockets = () => {};
