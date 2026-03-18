import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    moduleNameMapper: {
        '^@modules/(.*)$': '<rootDir>/src/modules/$1',
        '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
        '^@config/(.*)$': '<rootDir>/src/config/$1',
        '^@constants/(.*)$': '<rootDir>/src/constants/$1',
        '^@errors/(.*)$': '<rootDir>/src/errors/$1',
        '^@middlewares/(.*)$': '<rootDir>/src/middlewares/$1',
        '^@routes/(.*)$': '<rootDir>/src/routes/$1',
        '^@types/(.*)$': '<rootDir>/src/types/$1',
        '^@utils/(.*)$': '<rootDir>/src/utils/$1',
        '^@constants$': '<rootDir>/src/constants',
        '^@errors$': '<rootDir>/src/errors',
        '^@middlewares$': '<rootDir>/src/middlewares',
        '^@routes$': '<rootDir>/src/routes',
        '^@types$': '<rootDir>/src/types',
        '^@utils$': '<rootDir>/src/utils',
    },
    testMatch: ['**/?(*.)+(spec|test).ts'],
    verbose: true,
    forceExit: true,
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
};

export default config;
