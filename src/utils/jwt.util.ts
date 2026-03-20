/**
 * JWT Utility Module
 * @module utils
 * @description Utility functions for handling JSON Web Tokens (JWTs) and refresh tokens.
 */

import { env } from '@config/env';
import { AppError } from '@errors';
import { ERROR_CODE, HTTP_STATUS } from '@constants';
import type { AccessTokenPayload, RefreshTokenPayload } from '@types';
import jwt from 'jsonwebtoken';

export const generateAccessToken = (payload: AccessTokenPayload, expiresIn: string | number): string => {
    const token = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
        expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
    });

    return token;
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
    try {
        return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    } catch {
        throw new AppError({
            message: 'Invalid or expired access token',
            statusCode: HTTP_STATUS.UNAUTHORIZED,
            errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
        });
    }
};

export const generateRefreshToken = (payload: RefreshTokenPayload, expiresIn: string | number): string => {
    const token = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
        expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
    });

    return token;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
    try {
        return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
    } catch {
        throw new AppError({
            message: 'Invalid or expired refresh token',
            statusCode: HTTP_STATUS.UNAUTHORIZED,
            errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
        });
    }
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
