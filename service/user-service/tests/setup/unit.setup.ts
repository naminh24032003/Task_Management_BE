/**
 * Unit Test Setup
 * This file runs before each unit test file
 */

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
