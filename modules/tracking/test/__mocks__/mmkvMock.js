/**
 * Functional in-memory MMKV mock.
 * Each `new MMKV()` call returns a fresh independent store,
 * so test isolation holds without manual reset.
 *
 * For hlcStore tests: hlcStore owns a module-level singleton `_mmkv`.
 * Tests must call `_resetMmkvForTest()` to drop the singleton,
 * then control the mock state through the NEXT `new MMKV()` call.
 */
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
      // Expose store for direct inspection in tests
      _store: store,
    };
  }),
};
