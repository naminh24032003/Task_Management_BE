/** @type {import('jest').Config} */
module.exports = {
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '.',
    testEnvironment: 'node',
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                tsconfig: 'tsconfig.json',
            },
        ],
    },
    moduleNameMapper: {
        '^@domain/(.*)$': '<rootDir>/src/domain/$1',
        '^@application/(.*)$': '<rootDir>/src/application/$1',
        '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
        '^@ports/(.*)$': '<rootDir>/src/ports/$1',
        '^@src/(.*)$': '<rootDir>/src/$1',
    },
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.spec.ts',
        '!src/**/*.module.ts',
        '!src/main.ts',
        '!src/generated/**',
    ],
    coverageDirectory: './coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    // Separate configurations for different test types
    projects: [
        {
            displayName: 'unit',
            testMatch: ['<rootDir>/tests/unit/**/*.spec.ts'],
            testEnvironment: 'node',
            setupFilesAfterEnv: ['<rootDir>/tests/setup/unit.setup.ts'],
            moduleFileExtensions: ['js', 'json', 'ts'],
            transform: {
                '^.+\\.tsx?$': [
                    'ts-jest',
                    {
                        tsconfig: '<rootDir>/tsconfig.json',
                    },
                ],
            },
            moduleNameMapper: {
                '^@domain/(.*)$': '<rootDir>/src/domain/$1',
                '^@application/(.*)$': '<rootDir>/src/application/$1',
                '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
                '^@ports/(.*)$': '<rootDir>/src/ports/$1',
                '^@src/(.*)$': '<rootDir>/src/$1',
            },
            transformIgnorePatterns: [
                '[/\\\\]node_modules[/\\\\](?!uuid)[/\\\\].+\\.(js|jsx|mjs|cjs|ts|tsx)$',
            ],
        },
        {
            displayName: 'integration',
            testMatch: ['<rootDir>/tests/integration/**/*.spec.ts'],
            testEnvironment: 'node',
            setupFilesAfterEnv: ['<rootDir>/tests/setup/integration.setup.ts'],
            moduleFileExtensions: ['js', 'json', 'ts'],
            transform: {
                '^.+\\.tsx?$': [
                    'ts-jest',
                    {
                        tsconfig: '<rootDir>/tsconfig.json',
                    },
                ],
            },
            moduleNameMapper: {
                '^@domain/(.*)$': '<rootDir>/src/domain/$1',
                '^@application/(.*)$': '<rootDir>/src/application/$1',
                '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
                '^@ports/(.*)$': '<rootDir>/src/ports/$1',
                '^@src/(.*)$': '<rootDir>/src/$1',
            },
            transformIgnorePatterns: [
                '[/\\\\]node_modules[/\\\\](?!uuid)[/\\\\].+\\.(js|jsx|mjs|cjs|ts|tsx)$',
            ],
        },
        {
            displayName: 'contract',
            testMatch: ['<rootDir>/tests/contract/**/*.spec.ts'],
            testEnvironment: 'node',
            setupFilesAfterEnv: ['<rootDir>/tests/setup/contract.setup.ts'],
            moduleFileExtensions: ['js', 'json', 'ts'],
            transform: {
                '^.+\\.tsx?$': [
                    'ts-jest',
                    {
                        tsconfig: '<rootDir>/tsconfig.json',
                    },
                ],
            },
            moduleNameMapper: {
                '^@domain/(.*)$': '<rootDir>/src/domain/$1',
                '^@application/(.*)$': '<rootDir>/src/application/$1',
                '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
                '^@ports/(.*)$': '<rootDir>/src/ports/$1',
                '^@src/(.*)$': '<rootDir>/src/$1',
            },
            transformIgnorePatterns: [
                '[/\\\\]node_modules[/\\\\](?!uuid)[/\\\\].+\\.(js|jsx|mjs|cjs|ts|tsx)$',
            ],
        },
        {
            displayName: 'architecture',
            testMatch: ['<rootDir>/tests/architecture/**/*.spec.ts'],
            testEnvironment: 'node',
            moduleFileExtensions: ['js', 'json', 'ts'],
            transform: {
                '^.+\\.tsx?$': [
                    'ts-jest',
                    {
                        tsconfig: '<rootDir>/tsconfig.json',
                    },
                ],
            },
        },
    ],
    // Global settings
    verbose: true,
    testTimeout: 30000,
    clearMocks: true,
    restoreMocks: true,
};
