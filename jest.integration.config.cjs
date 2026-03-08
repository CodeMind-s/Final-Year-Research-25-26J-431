const path = require('path');

module.exports = {
  rootDir: path.resolve(__dirname),
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  testMatch: ['**/apps/api-gateway/src/app/waste-valorization-service/tests/integration/**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  moduleDirectories: ['node_modules', 'src'],
  setupFiles: ['reflect-metadata'],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
  collectCoverage: false,
  coverageDirectory: '<rootDir>/coverage/waste-valorization/integration',
  coveragePathIgnorePatterns: ['/node_modules/'],
};
