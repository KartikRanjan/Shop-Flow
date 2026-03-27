/**
 * Authentication Middleware
 * @module middlewares
 * @description This middleware module provides authentication and authorization checks for the application.
 * It verifies access tokens in the Authorization header and validates user roles.
 *
 * Validation flow:
 *   1. Verify JWT signature + extract payload (sub, sid, type)
 *   2. Validate token type === 'access'
 *   3. Validate session via Redis (session:{sid})  →  fallback to DB
 *   4. Validate user via Redis (user:{userId})     →  fallback to DB
 *   5. Authorize roles
 */

import { extractAndVerifyAccessToken } from '@utils';
import { AppError } from '@errors';
import { ACCOUNT_STATUS, ERROR_CODE, HTTP_STATUS, USER_ROLES, type UserRole } from '@constants';
import { db } from '@infrastructure/database';
import { refreshSessions } from '@modules/auth/models/auth.model';
import { usersTable } from '@modules/users/models/user.model';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { sessionCache } from '@modules/auth/cache/session.cache';
import { userCache, type CachedUser } from '@modules/auth/cache/user.cache';
import { logger } from '@infrastructure/logger';
import type { Request, Response, NextFunction } from 'express';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Throws if the session is revoked (outside the 30-second grace period). */
const assertSessionNotRevoked = (revokedAt: string | null | Date | undefined): void => {
    if (!revokedAt) return;

    const GRACE_PERIOD_MS = 30 * 1000;
    const revokedTime = new Date(revokedAt).getTime();

    if (Date.now() - revokedTime > GRACE_PERIOD_MS) {
        throw new AppError({
            message: 'Invalid or expired access token',
            statusCode: HTTP_STATUS.UNAUTHORIZED,
            errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
        });
    }
};

/**
 * Resolves the session for `sessionId` owned by `userId`.
 * Tries Redis first; falls back to DB and repopulates the cache on a miss.
 */
const resolveSession = async (sessionId: string, userId: string) => {
    // ── 1. Redis hit ──────────────────────────────────────────────────────────
    const cached = await sessionCache.get(sessionId);
    if (cached !== null) {
        logger.debug(`Auth: session cache HIT for sid="${sessionId}"`);
        // Verify the cached session belongs to the claimed user (prevents cross-user session attacks)
        if (cached.userId !== userId) return null;
        assertSessionNotRevoked(cached.revokedAt);
        return cached;
    }

    // ── 2. DB fallback ────────────────────────────────────────────────────────
    logger.debug(`Auth: session cache MISS for sid="${sessionId}" — falling back to DB`);

    const rows = await db
        .select()
        .from(refreshSessions)
        .where(
            and(
                eq(refreshSessions.id, sessionId),
                eq(refreshSessions.userId, userId),
                gt(refreshSessions.expiresAt, new Date()),
            ),
        )
        .limit(1);

    const session = rows[0];

    if (!session) return null;

    assertSessionNotRevoked(session.revokedAt);

    // ── 3. Repopulate Redis ───────────────────────────────────────────────────
    void sessionCache.set({
        id: session.id,
        userId: session.userId,
        expiresAt: session.expiresAt.toISOString(),
        revokedAt: session.revokedAt ? session.revokedAt.toISOString() : null,
    });

    return session;
};

/**
 * Resolves the user for `userId`.
 * Tries Redis first; falls back to DB and repopulates the cache on a miss.
 */
const resolveUser = async (userId: string): Promise<CachedUser | null> => {
    // ── 1. Redis hit ──────────────────────────────────────────────────────────
    const cached = await userCache.get(userId);
    if (cached !== null) {
        logger.debug(`Auth: user cache HIT for userId="${userId}"`);
        return cached;
    }

    // ── 2. DB fallback ────────────────────────────────────────────────────────
    logger.debug(`Auth: user cache MISS for userId="${userId}" — falling back to DB`);

    const rows = await db
        .select({
            id: usersTable.id,
            email: usersTable.email,
            roles: usersTable.roles,
            accountStatus: usersTable.accountStatus,
        })
        .from(usersTable)
        .where(and(eq(usersTable.id, userId), isNull(usersTable.deletedAt)))
        .limit(1);

    const user = rows[0];
    if (!user) return null;

    const cachedUser: CachedUser = {
        id: user.id,
        email: user.email,
        roles: user.roles as UserRole[],
        accountStatus: user.accountStatus,
    };

    // ── 3. Repopulate Redis ───────────────────────────────────────────────────
    void userCache.set(cachedUser);

    return cachedUser;
};

// ─── Core auth logic ──────────────────────────────────────────────────────────

/**
 * Helper to handle the core authentication logic
 * @throws {AppError} if authentication or authorization fails
 */
const handleAuth = async (req: Request, roles: UserRole[]) => {
    const authHeader = req.headers.authorization;
    const payload = extractAndVerifyAccessToken(authHeader);

    // Defensive check: only trust sub + sid from JWT; email/roles are metadata validated via DB/cache
    if (!payload?.sub || !payload.sid) {
        throw new AppError({
            message: 'Invalid or malformed token payload',
            statusCode: HTTP_STATUS.UNAUTHORIZED,
            errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
        });
    }

    // ── Step 2: Validate session (Redis → DB) ─────────────────────────────────
    const session = await resolveSession(payload.sid, payload.sub);

    if (!session) {
        throw new AppError({
            message: 'Invalid or expired access token',
            statusCode: HTTP_STATUS.UNAUTHORIZED,
            errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
        });
    }

    // ── Step 3: Validate user (Redis → DB) ───────────────────────────────────
    const user = await resolveUser(payload.sub);

    if (!user) {
        throw new AppError({
            message: 'Invalid or expired access token',
            statusCode: HTTP_STATUS.UNAUTHORIZED,
            errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
        });
    }

    if (user.accountStatus !== ACCOUNT_STATUS.ACTIVE) {
        const statusMessages = {
            [ACCOUNT_STATUS.PENDING_VERIFICATION]: 'Please verify your email', // Defense-in-depth check: re-validate user verification at middleware level.
            [ACCOUNT_STATUS.SUSPENDED]: 'User account is suspended',
            [ACCOUNT_STATUS.BANNED]: 'User account is banned',
        } as const;

        throw new AppError({
            message: statusMessages[user.accountStatus] ?? 'Access denied',
            statusCode: HTTP_STATUS.FORBIDDEN,
            errorCode: ERROR_CODE.AUTHORIZATION_ERROR,
        });
    }

    // ── Step 4: Authorize roles ───────────────────────────────────────────────
    if (!roles || roles.length === 0) {
        throw new AppError({
            message: 'Access denied: No roles specified for authorization',
            statusCode: HTTP_STATUS.FORBIDDEN,
            errorCode: ERROR_CODE.AUTHORIZATION_ERROR,
        });
    }

    const hasRole = roles.some((role) => user.roles.includes(role));

    if (!hasRole) {
        throw new AppError({
            message: 'Access denied: Insufficient permissions',
            statusCode: HTTP_STATUS.FORBIDDEN,
            errorCode: ERROR_CODE.AUTHORIZATION_ERROR,
        });
    }

    // Attach fresh user info to request object
    req.user = {
        id: user.id,
        email: user.email,
        roles: user.roles,
    };
};

/**
 * Middleware factory to require specific roles for authorization
 * @param { UserRole[]} allowedRoles - Array of roles allowed to access the route
 */

const hasRoles = (allowedRoles: UserRole[]) => async (req: Request, _res: Response, next: NextFunction) => {
    try {
        await handleAuth(req, allowedRoles);
        next();
    } catch (error) {
        next(error);
    }
};

// ─── Exported Middleware Object ───────────────────────────────────────────────

export const authenticate = {
    hasRoles,
    all: hasRoles(Object.values(USER_ROLES) as UserRole[]),
    user: hasRoles([USER_ROLES.USER]),
    admin: hasRoles([USER_ROLES.ADMIN]),
    seller: hasRoles([USER_ROLES.SELLER]),
    userAndAdmin: hasRoles([USER_ROLES.USER, USER_ROLES.ADMIN]),
    userAndSeller: hasRoles([USER_ROLES.USER, USER_ROLES.SELLER]),
    adminAndSeller: hasRoles([USER_ROLES.ADMIN, USER_ROLES.SELLER]),
};
