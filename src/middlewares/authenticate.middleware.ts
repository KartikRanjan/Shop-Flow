/**
 * Authentication Middleware
 * @module middlewares
 * @description This middleware module provides authentication and authorization checks for the application.
 * It verifies access tokens in the Authorization header and validates user roles.
 */

import { extractAndVerifyAccessToken } from '@utils/jwt.util';
import { AppError } from '@errors';
import { ERROR_CODE, HTTP_STATUS, USER_ROLES, type UserRole } from '@constants';
import { db } from '@infrastructure/database';
import { refreshSessions } from '@modules/auth/models/auth.model';
import { usersTable } from '@modules/users/models/user.model';
import { eq, and, isNull, gt } from 'drizzle-orm';
import type { Request, Response, NextFunction } from 'express';

/**
 * Helper to handle the core authentication logic
 * @throws {AppError} if authentication or authorization fails
 */
const handleAuth = async (req: Request, roles: UserRole[]) => {
    const authHeader = req.headers.authorization;
    const payload = extractAndVerifyAccessToken(authHeader);

    // Defensive check on payload
    if (!payload?.sub || !payload.email || !payload.sid || !Array.isArray(payload.roles)) {
        throw new AppError({
            message: 'Invalid or malformed token payload',
            statusCode: HTTP_STATUS.UNAUTHORIZED,
            errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
        });
    }

    // INNER JOIN ensures the query returns nothing if user is missing, inactive, or soft-deleted
    // (equivalent to MongoDB's $lookup + $unwind without preserveNullAndEmptyArrays)
    const result = await db
        .select({
            user: {
                id: usersTable.id,
                email: usersTable.email,
                roles: usersTable.roles,
            },
            session: refreshSessions,
        })
        .from(refreshSessions)
        .innerJoin(
            usersTable,
            and(eq(refreshSessions.userId, usersTable.id), eq(usersTable.isActive, true), isNull(usersTable.deletedAt)),
        )
        .where(
            and(
                eq(refreshSessions.id, payload.sid),
                eq(refreshSessions.userId, payload.sub),
                gt(refreshSessions.expiresAt, new Date()),
            ),
        )
        .limit(1);

    if (result.length === 0) {
        throw new AppError({
            message: 'Invalid or expired access token',
            statusCode: HTTP_STATUS.UNAUTHORIZED,
            errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
        });
    }

    const session = result[0].session;

    // Implement a 30-second grace period for revoked sessions
    // to allow in-flight requests during token refresh to complete
    if (session.revokedAt) {
        const GRACE_PERIOD_MS = 30 * 1000;
        const revokedTime = new Date(session.revokedAt).getTime();
        const now = Date.now();

        if (now - revokedTime > GRACE_PERIOD_MS) {
            throw new AppError({
                message: 'Invalid or expired access token',
                statusCode: HTTP_STATUS.UNAUTHORIZED,
                errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
            });
        }
    }

    const user = result[0].user;

    if (user.email !== payload.email) {
        throw new AppError({
            message: 'Invalid or malformed token payload',
            statusCode: HTTP_STATUS.UNAUTHORIZED,
            errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
        });
    }

    // Use roles from database for more robust authorization (syncs immediately with role changes)
    const userRoles = user.roles as UserRole[];

    // If roles are provided, check if the user has at least one of them
    if (!roles || roles.length === 0) {
        throw new AppError({
            message: 'Access denied: No roles specified for authorization',
            statusCode: HTTP_STATUS.FORBIDDEN,
            errorCode: ERROR_CODE.AUTHORIZATION_ERROR,
        });
    }

    const hasRole = roles.some((role) => userRoles.includes(role));

    if (!hasRole) {
        throw new AppError({
            message: 'Access denied: Insufficient permissions',
            statusCode: HTTP_STATUS.FORBIDDEN,
            errorCode: ERROR_CODE.AUTHORIZATION_ERROR,
        });
    }

    // Attach fresh user info from DB to request object
    req.user = {
        id: user.id,
        email: user.email,
        roles: userRoles,
    };
};

export const authenticate = {
    /**
     * Middleware to require specific roles for authorization
     * @param {UserRole[]} allowedRoles - Array of roles allowed to access the route
     */
    hasRoles: (allowedRoles: UserRole[]) => async (req: Request, _res: Response, next: NextFunction) => {
        try {
            await handleAuth(req, allowedRoles);
            next();
        } catch (error) {
            next(error);
        }
    },

    all: async (req: Request, res: Response, next: NextFunction) => {
        await authenticate.hasRoles(Object.values(USER_ROLES) as UserRole[])(req, res, next);
    },

    user: async (req: Request, res: Response, next: NextFunction) => {
        await authenticate.hasRoles([USER_ROLES.USER])(req, res, next);
    },

    admin: async (req: Request, res: Response, next: NextFunction) => {
        await authenticate.hasRoles([USER_ROLES.ADMIN])(req, res, next);
    },

    seller: async (req: Request, res: Response, next: NextFunction) => {
        await authenticate.hasRoles([USER_ROLES.SELLER])(req, res, next);
    },

    userAndAdmin: async (req: Request, res: Response, next: NextFunction) => {
        await authenticate.hasRoles([USER_ROLES.USER, USER_ROLES.ADMIN])(req, res, next);
    },

    userAndSeller: async (req: Request, res: Response, next: NextFunction) => {
        await authenticate.hasRoles([USER_ROLES.USER, USER_ROLES.SELLER])(req, res, next);
    },

    adminAndSeller: async (req: Request, res: Response, next: NextFunction) => {
        await authenticate.hasRoles([USER_ROLES.ADMIN, USER_ROLES.SELLER])(req, res, next);
    },
};
