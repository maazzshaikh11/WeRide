/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/../../app/src/$1',
    '^@contracts/(.*)$': '<rootDir>/../../contracts/$1',
    '^@tracking/(.*)$': '<rootDir>/../tracking/src/$1',
    '^@hazard/(.*)$': '<rootDir>/../hazard-sos/src/$1',
    '^@routing/(.*)$': '<rootDir>/../routing-eta/src/$1',
    '^@flvoice/(.*)$': '<rootDir>/../fl-voice/src/$1',
    'react-native-mmkv': '<rootDir>/test/__mocks__/mmkvMock.js',
    '@react-native-firebase/firestore': '<rootDir>/test/__mocks__/firebaseMock.js',
    '@react-native-firebase/auth': '<rootDir>/test/__mocks__/authMock.js',
    'react-native-webrtc': '<rootDir>/test/__mocks__/webrtcMock.js',
    'react-native-sensors': '<rootDir>/test/__mocks__/sensorsMock.js',
    'react-native-geolocation-service': '<rootDir>/test/__mocks__/geoMock.js',
    'socket.io-client': '<rootDir>/test/__mocks__/socketMock.js',
  },
};
