/**
 * JWT Utility Module
 * @module utils
 * @description Utility functions for handling JSON Web Tokens (JWTs) and refresh tokens.
 */

import { env } from '@config/env';
import { AppError } from '@errors';
import { ERROR_CODE, HTTP_STATUS } from '@constants';
import type { AccessTokenInput, AccessTokenPayload, RefreshTokenInput, RefreshTokenPayload } from '@types';
import jwt from 'jsonwebtoken';
import { logger } from '@infrastructure/logger';

/**
 * Generic authentication error — intentionally vague to avoid leaking
 * internal token structure details to callers.
 * Detailed context is always written to the logger before this is thrown.
 */
const authenticationError = () =>
    new AppError({
        message: 'Invalid or expired token',
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
    });

/**
 * Generates a signed access token.
 * The `type: 'access'` claim is always injected here — callers must NOT set it.
 */
export const generateAccessToken = (payload: AccessTokenInput, expiresIn: string | number): string => {
    const token = jwt.sign({ ...payload, type: 'access' } satisfies AccessTokenPayload, env.JWT_ACCESS_SECRET, {
        expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
    });

    return token;
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
    let payload: AccessTokenPayload;

    try {
        payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    } catch (err) {
        logger.error({ err }, 'Access token verification failed');
        throw authenticationError();
    }

    // Token type guard: enforced in the util so no middleware can bypass it
    if (payload.type !== 'access') {
        logger.warn({ payload }, 'Token type mismatch on access route');
        throw authenticationError();
    }

    return payload;
};

/**
 * Generates a signed refresh token.
 * The `type: 'refresh'` claim is always injected here — callers must NOT set it.
 */
export const generateRefreshToken = (payload: RefreshTokenInput, expiresIn: string | number): string => {
    const token = jwt.sign({ ...payload, type: 'refresh' } satisfies RefreshTokenPayload, env.JWT_REFRESH_SECRET, {
        expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
    });

    return token;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
    let payload: RefreshTokenPayload;

    try {
        payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
    } catch (err) {
        logger.error({ err }, 'Refresh token verification failed');
        throw authenticationError();
    }

    // Token type guard: enforced in the util so no consumer can bypass it
    if (payload.type !== 'refresh') {
        logger.warn({ payload }, 'Token type mismatch on refresh route');
        throw authenticationError();
    }

    return payload;
};

export const extractAndVerifyAccessToken = (authHeader: string | undefined): AccessTokenPayload => {
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!token) {
        throw new AppError({
            message: 'Authorization header missing or malformed',
            statusCode: HTTP_STATUS.UNAUTHORIZED,
            errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
        });
    }
    return verifyAccessToken(token);
};
