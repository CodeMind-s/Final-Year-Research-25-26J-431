/* eslint-disable */
const { readFileSync } = require('fs');
const { join } = require('path');

// Reading the SWC compilation config for the spec files
const swcJestConfig = JSON.parse(
  readFileSync(join(__dirname, '.spec.swcrc'), 'utf-8')
);

// Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
swcJestConfig.swcrc = false;

module.exports = {
  displayName: 'compass-service-e2e',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  rootDir: __dirname,
  roots: ['<rootDir>/tests/e2e'],
  testMatch: [
    '<rootDir>/tests/e2e/**/*.spec.ts',
    '<rootDir>/tests/e2e/**/*.test.ts',
  ],
  testPathIgnorePatterns: ['/node_modules/'],
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  // E2E tests need more time for MongoDB/memory server setup
  testTimeout: 30000,
  forceExit: true,
};
