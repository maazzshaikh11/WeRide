/** @type {import('jest').Config} */
module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Polyfills (Animated combinators, Easing) must run AFTER the RN preset's
  // own setup, which re-mocks react-native modules.
  setupFilesAfterEnv: ['<rootDir>/jest.polyfills.js'],
  testMatch: ['<rootDir>/__tests__/**/*.test.ts', '<rootDir>/__tests__/**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(js|ts|tsx)$': 'babel-jest',
    '^.+\\.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp)$': 'react-native/jest/assetFileTransformer.js',
  },
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/src/$1',
    '^@contracts/(.*)$': '<rootDir>/../contracts/$1',
    '^@tracking/(.*)$': '<rootDir>/../modules/tracking/src/$1',
    '^@hazard/(.*)$': '<rootDir>/../modules/hazard-sos/src/$1',
    '^@routing/(.*)$': '<rootDir>/../modules/routing-eta/src/$1',
    '^@flvoice/(.*)$': '<rootDir>/../modules/fl-voice/src/$1',
    '^@env$': '<rootDir>/env.d.ts',
    // Share the app's react/zustand across module node_modules to avoid
    // duplicate React instances (hooks "useRef of null" errors in tests).
    '^@babel/runtime/(.*)$': '<rootDir>/node_modules/@babel/runtime/$1',
    '^react$': '<rootDir>/node_modules/react',
    '^react-native$': '<rootDir>/node_modules/react-native',
    '^zustand$': '<rootDir>/node_modules/zustand',
    '^zustand/(.*)$': '<rootDir>/node_modules/zustand/$1',
  },
  testEnvironment: 'node',
};