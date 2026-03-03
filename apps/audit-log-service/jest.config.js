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
  displayName: '@brinex-server/audit-log-service',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  rootDir: __dirname,
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    process.env.CI === 'true' && !process.env.MONGO_URI ? '<rootDir>/tests/e2e/' : null,
  ].filter(Boolean),
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
};
