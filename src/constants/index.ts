/**
 * Global constants used across the application
 * @module constants
 * @description This module defines global constants such as HTTP status codes, error codes,
 * and pagination defaults. These constants are used throughout the application to ensure
 * consistency in responses, error handling, and pagination logic.
 */

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 10;
export const DEFAULT_PAGE = 1;

export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    REQUEST_ENTITY_TOO_LARGE: 413,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
};

export const ERROR_CODE = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
    RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
    DATABASE_ERROR: 'DATABASE_ERROR',
    DATABASE_CONNECTION_ERROR: 'DATABASE_CONNECTION_ERROR',
    INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    AUTHENTICATION_RATE_LIMIT_EXCEEDED: 'AUTHENTICATION_RATE_LIMIT_EXCEEDED',
    REQUEST_TOO_LARGE: 'REQUEST_TOO_LARGE',
};
