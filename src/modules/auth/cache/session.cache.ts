/**
 * SessionCache
 * @module auth/cache
 * @description Domain-specific Redis cache layer for refresh sessions.
 * Owns session key building, TTL policy, and user-session Set operations
 * for efficient `logoutAll`.
 *
 * All methods fail gracefully: a Redis error is caught here, logged, and
 * null/false is returned so the caller can fall back to the database.
 */

import { redisService } from '@infrastructure/redis/redis.service';
import { logger } from '@infrastructure/logger';
import { env } from '@config/env';

/** Minimal session data stored in Redis to avoid a DB round-trip during auth. */
export type CachedSession = {
    /** The session's own ID (= jti / sid in the JWT) */
    id: string;
    userId: string;
    /** ISO string — avoids Date serialization issues in JSON */
    expiresAt: string;
    /** null if the session is still active */
    revokedAt: string | null;
};

const REFRESH_TTL_SECONDS = (): number => Number(env.REFRESH_TOKEN_EXPIRES_IN_DAYS) * 24 * 60 * 60;

/** `session:{sid}` — stores the cached session payload */
const buildSessionKey = (sessionId: string): string => `session:${sessionId}`;

/**
 * `user:sessions:{userId}` — a Redis Set whose members are all active
 * session IDs for the user. Used to avoid a `SCAN` during `logoutAll`.
 */
const buildUserSessionsSetKey = (userId: string): string => `user:sessions:${userId}`;

export const sessionCache = {
    /**
     * Persists a session in Redis and registers the session ID in the
     * per-user session Set (needed for efficient `logoutAll`).
     */
    async set(session: CachedSession): Promise<boolean> {
        try {
            const ttl = REFRESH_TTL_SECONDS();
            const key = buildSessionKey(session.id);
            const setKey = buildUserSessionsSetKey(session.userId);

            await Promise.all([
                redisService.setJSON({ key, value: session, expiryInSeconds: ttl }),
                redisService.sAdd(setKey, session.id, ttl),
            ]);
            return true;
        } catch (err) {
            logger.error(err, `SessionCache: set failed for session "${session.id}"`);
            return false;
        }
    },

    /**
     * Returns the cached session, or `null` on miss or Redis error.
     * Callers should fall back to the DB on `null`.
     */
    async get(sessionId: string): Promise<CachedSession | null> {
        try {
            return await redisService.getJSON<CachedSession>(buildSessionKey(sessionId));
        } catch (err) {
            logger.error(err, `SessionCache: get failed for session "${sessionId}"`);
            return null;
        }
    },

    /**
     * Removes a single session from Redis and from the user's session Set.
     * Called on single-device logout.
     */
    async delete(userId: string, sessionId: string): Promise<boolean> {
        try {
            const [deleted, untracked] = await Promise.all([
                redisService.delete(buildSessionKey(sessionId)),
                redisService.sRem(buildUserSessionsSetKey(userId), sessionId),
            ]);
            return deleted && untracked;
        } catch (err) {
            logger.error(err, `SessionCache: delete failed for session "${sessionId}"`);
            return false;
        }
    },

    /**
     * Invalidates every session for the given user in a single pipeline.
     * Called on `logoutAll`.
     */
    async deleteAllForUser(userId: string): Promise<boolean> {
        try {
            const setKey = buildUserSessionsSetKey(userId);
            const sessionIds = await redisService.sMembers(setKey);

            if (sessionIds.length === 0) {
                await redisService.delete(setKey);
                return true;
            }

            const keys = [...sessionIds.map((sid) => buildSessionKey(sid)), setKey];
            return redisService.deleteMany(keys);
        } catch (err) {
            logger.error(err, `SessionCache: deleteAllForUser failed for user "${userId}"`);
            return false;
        }
    },
} as const;
