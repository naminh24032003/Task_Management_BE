/**
 * Integration Test Setup
 * This file runs before each integration test file
 */

// Increase timeout for integration tests
jest.setTimeout(30000);

// Environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_ACCESS_EXPIRES_IN = '3600';
process.env.JWT_REFRESH_EXPIRES_IN = '604800';

// Mock console.error and console.warn to keep test output clean
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
    console.error = jest.fn();
    console.warn = jest.fn();
});

afterAll(() => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
});

// Clear all mocks between tests
afterEach(() => {
    jest.clearAllMocks();
});
