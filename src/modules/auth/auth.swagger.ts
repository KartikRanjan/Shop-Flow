/**
 * Auth Module Swagger Documentation
 * @module auth/swagger
 * @description This file contains Swagger documentation for the Auth module.
 */

import { registerRoute, registerSchema } from '../../infrastructure/swagger';
import { loginBodySchema, registerBodySchema } from './validations/auth.validation';

// Register Schemas
registerSchema('LoginBody', loginBodySchema);
registerSchema('RegisterBody', registerBodySchema);

// Register Routes
registerRoute({
    method: 'post',
    path: '/api/v1/auth/login',
    summary: 'Login user',
    description: 'Authenticates a user and returns an access token.',
    tags: ['Auth'],
    request: {
        body: loginBodySchema,
    },
    responses: {
        200: {
            description: 'Successfully logged in',
        },
        401: {
            description: 'Invalid credentials',
        },
    },
});

registerRoute({
    method: 'post',
    path: '/api/v1/auth/register',
    summary: 'Register user',
    description: 'Creates a new user account.',
    tags: ['Auth'],
    request: {
        body: registerBodySchema,
    },
    responses: {
        201: {
            description: 'Successfully registered',
        },
        400: {
            description: 'Validation error',
        },
    },
});

registerRoute({
    method: 'post',
    path: '/api/v1/auth/refresh',
    summary: 'Refresh token',
    description: 'Refreshes the access token using a refresh token from cookies.',
    tags: ['Auth'],
    responses: {
        200: {
            description: 'Successfully refreshed token',
        },
        401: {
            description: 'Invalid or expired refresh token',
        },
    },
});

registerRoute({
    method: 'delete',
    path: '/api/v1/auth/logout',
    summary: 'Logout user',
    description: 'Revokes the current refresh token.',
    tags: ['Auth'],
    responses: {
        204: {
            description: 'Successfully logged out',
        },
        401: {
            description: 'Unauthorized',
        },
    },
});

registerRoute({
    method: 'delete',
    path: '/api/v1/auth/logout-all',
    summary: 'Logout from all devices',
    description: 'Revokes all refresh tokens for the user.',
    tags: ['Auth'],
    responses: {
        204: {
            description: 'Successfully logged out from all devices',
        },
        401: {
            description: 'Unauthorized',
        },
    },
});

registerRoute({
    method: 'get',
    path: '/api/v1/auth/active-sessions',
    summary: 'Get active sessions',
    description: 'Returns a list of active refresh token sessions for the user.',
    tags: ['Auth'],
    responses: {
        200: {
            description: 'Successfully retrieved active sessions',
        },
        401: {
            description: 'Unauthorized',
        },
    },
});
