/**
 * Jest configuration – TypeScript via ts-jest.
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/server.ts'],
  moduleNameMapper: {
    // Mock the Copilot SDK for CI (no CLI required)
    '^@github/copilot-sdk$': '<rootDir>/src/__tests__/__mocks__/@github/copilot-sdk.ts',
  },
};
