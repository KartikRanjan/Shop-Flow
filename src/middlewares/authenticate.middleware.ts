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
import type { Request, Response, NextFunction } from 'express';

/**
 * Helper to handle the core authentication logic
 * @throws {AppError} if authentication or authorization fails
 */
const handleAuth = async (req: Request, roles: UserRole[]) => {
    const authHeader = req.headers.authorization;
    const payload = extractAndVerifyAccessToken(authHeader);

    // Defensive check on payload
    if (!payload?.sub || !payload.email || !Array.isArray(payload.roles)) {
        throw new AppError({
            message: 'Invalid or malformed token payload',
            statusCode: HTTP_STATUS.UNAUTHORIZED,
            errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
        });
    }

    const session = await db.query.refreshSessions.findFirst({
        where: (refreshSessions, { eq, and, isNull, gt }) =>
            and(
                eq(refreshSessions.id, payload.sid),
                isNull(refreshSessions.revokedAt),
                gt(refreshSessions.expiresAt, new Date()),
            ),
    });

    if (!session) {
        throw new AppError({
            message: 'Invalid or expired access token',
            statusCode: HTTP_STATUS.UNAUTHORIZED,
            errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
        });
    }

    // Database check to ensure user still exists and is active
    // This provides robustness against deleted or deactivated accounts even if the token is still valid
    const user = await db.query.users.findFirst({
        where: (users, { eq, and, isNull }) =>
            and(eq(users.id, payload.sub), eq(users.isActive, true), isNull(users.deletedAt)),
    });

    if (!user) {
        throw new AppError({
            message: 'User not found or account is inactive',
            statusCode: HTTP_STATUS.UNAUTHORIZED,
            errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
        });
    }

    if (!user.isActive || user.deletedAt) {
        throw new AppError({
            message: `User account is ${user?.deletedAt ? 'has been deleted' : 'inactive'}`,
            statusCode: HTTP_STATUS.FORBIDDEN,
            errorCode: ERROR_CODE.AUTHORIZATION_ERROR,
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
    hasRoles:
        (allowedRoles: UserRole[]) => async (req: Request, _res: Response, next: NextFunction) => {
            try {
                await handleAuth(req, allowedRoles);
                next();
            } catch (error) {
                next(error);
            }
        },

    /**
     * Middleware to allow any authenticated user regardless of role
     */

    all: async (req: Request, res: Response, next: NextFunction) => {
        await authenticate.hasRoles(Object.values(USER_ROLES) as UserRole[])(req, res, next);
    },

    /**
     * Convenience middleware for USER role
     */
    user: async (req: Request, res: Response, next: NextFunction) => {
        await authenticate.hasRoles([USER_ROLES.USER])(req, res, next);
    },

    /**
     * Convenience middleware for ADMIN role
     */
    admin: async (req: Request, res: Response, next: NextFunction) => {
        await authenticate.hasRoles([USER_ROLES.ADMIN])(req, res, next);
    },

    /**
     * Convenience middleware for SELLER role
     */
    seller: async (req: Request, res: Response, next: NextFunction) => {
        await authenticate.hasRoles([USER_ROLES.SELLER])(req, res, next);
    },
    /**
     * Convenience middleware for USER and ADMIN roles
     */
    userAndAdmin: async (req: Request, res: Response, next: NextFunction) => {
        await authenticate.hasRoles([USER_ROLES.USER, USER_ROLES.ADMIN])(req, res, next);
    },

    /**
     * Convenience middleware for USER and SELLER roles
     */
    userAndSeller: async (req: Request, res: Response, next: NextFunction) => {
        await authenticate.hasRoles([USER_ROLES.USER, USER_ROLES.SELLER])(req, res, next);
    },
    /**
     * Convenience middleware for ADMIN and SELLER roles
     */
    adminAndSeller: async (req: Request, res: Response, next: NextFunction) => {
        await authenticate.hasRoles([USER_ROLES.ADMIN, USER_ROLES.SELLER])(req, res, next);
    },
};
