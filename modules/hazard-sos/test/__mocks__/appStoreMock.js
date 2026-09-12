// Mock for @app/store/appStore — avoids loading the corrupted appStore.ts
// (which has a broken JSDoc /* ... modules/*/src ... */ that ts-jest can't parse)
module.exports = {
  __esModule: true,
  useAppStore: jest.fn(() => ({
    userId: 'test-user',
    groupId: 'test-group',
    setUserId: jest.fn(),
    setGroupId: jest.fn(),
  })),
};
