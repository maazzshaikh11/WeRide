module.exports = {
  MMKV: jest.fn().mockImplementation(() => {
    const store = {};
    return {
      getString: jest.fn((key) => store[key] ?? undefined),
      set: jest.fn((key, val) => {
        store[key] = val;
      }),
      delete: jest.fn((key) => {
        delete store[key];
      }),
      _store: store,
    };
  }),
};