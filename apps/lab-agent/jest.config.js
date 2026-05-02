/* eslint-disable */
const { readFileSync } = require('fs');
const { join } = require('path');

const swcJestConfig = JSON.parse(
  readFileSync(join(__dirname, '.spec.swcrc'), 'utf-8')
);

swcJestConfig.swcrc = false;

module.exports = {
  displayName: 'lab-agent',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  rootDir: __dirname,
  roots: ['<rootDir>/tests'],
  testMatch: [
    '<rootDir>/tests/**/*.spec.ts',
    '<rootDir>/tests/**/*.test.ts',
  ],
  testPathIgnorePatterns: ['/node_modules/'],
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  transformIgnorePatterns: ['node_modules/(?!(uuid)/)'],
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/main.ts',
  ],
};
