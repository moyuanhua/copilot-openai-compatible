/**
 * Jest configuration – TypeScript via ts-jest.
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/server.ts'],
  globals: {
    'ts-jest': {
      tsconfig: './tsconfig.test.json',
    },
  },
  moduleNameMapper: {
    // ts-jest runs .ts source directly in CJS mode; strip .js extensions that
    // are required by NodeNext TypeScript but don't exist at source resolution time.
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // Mock the Copilot SDK for CI (no CLI required)
    '^@github/copilot-sdk$': '<rootDir>/src/__tests__/__mocks__/@github/copilot-sdk.ts',
  },
};
