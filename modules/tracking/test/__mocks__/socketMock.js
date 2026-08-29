const _handlers = {};

const mockSocket = {
  emit: jest.fn(),
  on: jest.fn().mockImplementation((event, cb) => {
    _handlers[event] = cb;
  }),
  off: jest.fn(),
  connected: true,
  _fireConnect: () => {
    const call = mockSocket.on.mock.calls.find(c => c[0] === 'connect');
    if (call) call[1]();
  },
  _fireDisconnect: () => {
    mockSocket.connected = false;
    const call = mockSocket.on.mock.calls.find(c => c[0] === 'disconnect');
    if (call) call[1]();
  },
  _handlers,
};

module.exports = {
  io: jest.fn(() => mockSocket),
  _mockSocket: mockSocket,
};
