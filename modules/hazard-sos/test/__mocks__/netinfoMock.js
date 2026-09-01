// NetInfo mock for testing
let mockNetworkState = { isConnected: true };
let listeners = [];

const NetInfo = {
  addEventListener: jest.fn((callback) => {
    listeners.push(callback);
    // Return unsubscribe function
    return () => {
      listeners = listeners.filter(l => l !== callback);
    };
  }),
  fetch: jest.fn(async () => mockNetworkState),
  
  // Test helpers
  _setNetworkState: (state) => {
    mockNetworkState = state;
  },
  _triggerStateChange: (state) => {
    mockNetworkState = state;
    listeners.forEach(callback => callback(state));
  },
  _clearListeners: () => {
    listeners = [];
  }
};

module.exports = {
  __esModule: true,
  default: NetInfo,
};
