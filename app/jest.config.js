/** @type {import('jest').Config} */
module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: ['<rootDir>/__tests__/**/*.test.ts', '<rootDir>/__tests__/**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: { jsx: 'react', esModuleInterop: true } }],
  },
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/src/$1',
    '^@contracts/(.*)$': '<rootDir>/../contracts/$1',
    '^@tracking/(.*)$': '<rootDir>/../modules/tracking/src/$1',
    '^@hazard/(.*)$': '<rootDir>/../modules/hazard-sos/src/$1',
    '^@routing/(.*)$': '<rootDir>/../modules/routing-eta/src/$1',
    '^@flvoice/(.*)$': '<rootDir>/../modules/fl-voice/src/$1',
  },
  testEnvironment: 'node',
};