/**
 * UserCache
 * @module auth/cache
 * @description Domain-specific Redis cache layer for user status and roles.
 * Caches the minimal user state required by the authentication middleware
 * so that every authenticated request avoids an extra DB query.
 *
 * TTL is intentionally short (15 minutes) so role/status changes are
 * reflected quickly without needing explicit invalidation on every write.
 * Explicit `invalidate()` should still be called after role changes or
 * account deactivation for immediate effect.
 *
 * All methods fail gracefully: a Redis error is caught here, logged, and
 * null/false is returned so the caller can fall back to the database.
 */

import { redisService } from '@infrastructure/redis/redis.service';
import { logger } from '@infrastructure/logger';
import type { UserRole } from '@constants';

/** Minimal user state needed by the authentication middleware. */
export type CachedUser = {
    id: string;
    email: string;
    roles: UserRole[];
    isActive: boolean;
};

/** User state cache TTL — short enough for role changes to take effect quickly. */
const USER_CACHE_TTL_SECONDS = 15 * 60; // 15 minutes

/** `user:{userId}` — stores the cached user status / roles */
const buildUserKey = (userId: string): string => `user:${userId}`;

export const userCache = {
    /**
     * Stores the user's status and roles in Redis.
     * Called after a successful DB fetch inside the middleware fallback path.
     */
    async set(user: CachedUser): Promise<boolean> {
        try {
            return await redisService.setJSON({
                key: buildUserKey(user.id),
                value: user,
                expiryInSeconds: USER_CACHE_TTL_SECONDS,
            });
        } catch (err) {
            logger.error(err, `UserCache: set failed for user "${user.id}"`);
            return false;
        }
    },

    /**
     * Returns the cached user state, or `null` on miss or Redis error.
     * The middleware should fall back to a DB query on `null`.
     */
    async get(userId: string): Promise<CachedUser | null> {
        try {
            return await redisService.getJSON<CachedUser>(buildUserKey(userId));
        } catch (err) {
            logger.error(err, `UserCache: get failed for user "${userId}"`);
            return null;
        }
    },

    /**
     * Removes the user's cached state.
     * Call this whenever a user's roles or `isActive` status changes
     * so that the next request re-fetches fresh data from the DB.
     */
    async invalidate(userId: string): Promise<boolean> {
        try {
            return await redisService.delete(buildUserKey(userId));
        } catch (err) {
            logger.error(err, `UserCache: invalidate failed for user "${userId}"`);
            return false;
        }
    },
} as const;
