/**
 * RedisService
 * @module infrastructure/redis
 * @description Low-level Redis client singleton with JSON support, TTL handling,
 * Set operations, bulk pipeline utilities, and pattern scanning.
 *
 * Responsibilities:
 *   - Generic key/value operations (get, set, delete, exists, expire, ttl)
 *   - JSON serialization helpers (getJSON, setJSON, getOrSet cache-aside)
 *   - Redis Set operations for user-session tracking (sAdd, sRem, sMembers)
 *   - Bulk delete helpers (deleteMany via pipeline, deleteByPattern via SCAN)
 *   - Health probes (ping, isConnected)
 *   - Lifecycle management (disconnect, getClient)
 *
 * Error philosophy:
 *   This class does NOT swallow errors — it lets them propagate so callers
 *   (cache layer, services, middleware) can make informed fallback decisions.
 *   The only exception is JSON deserialization inside `getJSON`, which handles
 *   corrupt cache data gracefully since that is not a system failure.
 */

import { env } from '@config/env';
import { logger } from '@infrastructure/logger';
import Redis from 'ioredis';

export type SetOptions = {
    key: string;
    value: unknown;
    expiryInSeconds?: number;
};

class RedisService {
    private static instance: RedisService;
    private readonly redis: Redis;

    private constructor() {
        this.redis = new Redis({
            host: env.REDIS_HOST,
            port: env.REDIS_PORT,
            password: env.REDIS_PASSWORD,
            keyPrefix: env.REDIS_KEY_PREFIX,
            retryStrategy(times) {
                // Exponential back-off: 50 ms → 100 ms → … → 2 000 ms
                return Math.min(times * 50, 2_000);
            },
            // Prevents commands from throwing "Max retries per request reached"
            // during transient network blips — ioredis will retry instead.
            maxRetriesPerRequest: null,
        });

        this.redis.on('connect', () => logger.info('Redis: TCP connection established'));
        this.redis.on('ready', () => logger.info('Redis: Ready to accept commands'));
        this.redis.on('error', (err) => logger.error(err, 'Redis: Connection error'));
    }

    static getInstance(): RedisService {
        if (!RedisService.instance) {
            RedisService.instance = new RedisService();
        }
        return RedisService.instance;
    }

    // ---------- Core Methods ----------

    async get(key: string): Promise<string | null> {
        return this.redis.get(key);
    }

    async set({ key, value, expiryInSeconds }: SetOptions): Promise<boolean> {
        const serialized = this.serialize(value);
        const result = expiryInSeconds
            ? await this.redis.set(key, serialized, 'EX', expiryInSeconds)
            : await this.redis.set(key, serialized);
        return result === 'OK';
    }

    async delete(key: string): Promise<boolean> {
        const result = await this.redis.del(key);
        return result > 0;
    }

    async exists(key: string): Promise<boolean> {
        return (await this.redis.exists(key)) === 1;
    }

    async expire(key: string, ttlSeconds: number): Promise<boolean> {
        return (await this.redis.expire(key, ttlSeconds)) === 1;
    }

    async ttl(key: string): Promise<number> {
        return this.redis.ttl(key);
    }

    // ---------- JSON Helpers ----------

    async getJSON<T>(key: string): Promise<T | null> {
        const raw = await this.get(key);
        if (!raw) return null;
        try {
            // JSON.parse can throw on corrupt cache data — that is not a system
            // failure, so we handle it here and return null to signal a cache miss.
            return this.deserialize<T>(raw);
        } catch (err) {
            logger.error(err, `Redis: JSON parse failed for key "${key}"`);
            return null;
        }
    }

    async setJSON({ key, value, expiryInSeconds }: SetOptions): Promise<boolean> {
        return this.set({ key, value, expiryInSeconds });
    }

    /**
     * Cache-aside helper.
     * Returns the cached value if present; otherwise calls `fetcher`, caches
     * the result with `expiryInSeconds`, and returns it.
     */
    async getOrSet<T>(key: string, fetcher: () => Promise<T>, expiryInSeconds: number): Promise<T | null> {
        const cached = await this.getJSON<T>(key);
        if (cached !== null) return cached;

        const fresh = await fetcher();
        if (fresh !== null && fresh !== undefined) {
            await this.setJSON({ key, value: fresh, expiryInSeconds });
        }
        return fresh ?? null;
    }

    // ---------- Set Operations ----------

    /** Adds a member to a Redis Set and refreshes the SET's TTL. */
    async sAdd(key: string, member: string, ttlSeconds: number): Promise<boolean> {
        await this.redis.sadd(key, member);
        await this.redis.expire(key, ttlSeconds);
        return true;
    }

    /** Removes a member from a Redis Set. */
    async sRem(key: string, member: string): Promise<boolean> {
        await this.redis.srem(key, member);
        return true;
    }

    /** Returns all members of a Redis Set. */
    async sMembers(key: string): Promise<string[]> {
        return this.redis.smembers(key);
    }

    // ---------- Pipeline Utilities ----------

    /** Deletes multiple keys in a single pipeline. */
    async deleteMany(keys: string[]): Promise<boolean> {
        const pipeline = this.redis.pipeline();
        for (const key of keys) {
            pipeline.del(key);
        }
        await pipeline.exec();
        return true;
    }

    // ---------- Pattern Utilities ----------

    /**
     * Deletes keys matching a glob `pattern` using `SCAN` (non-blocking).
     * Prefer Set-based operations for `logoutAll`; use this only when
     * no explicit key index is available.
     */
    async deleteByPattern(pattern: string): Promise<number> {
        let deleted = 0;
        const stream = this.redis.scanStream({ match: pattern });
        const pipeline = this.redis.pipeline();

        for await (const keys of stream as AsyncIterable<string[]>) {
            if (keys.length) {
                deleted += keys.length;
                keys.forEach((k) => pipeline.del(k));
            }
        }
        if (deleted > 0) await pipeline.exec();
        return deleted;
    }

    // ---------- Serialization (private) ----------

    private serialize(data: unknown): string {
        return typeof data === 'string' ? data : JSON.stringify(data);
    }

    private deserialize<T>(data: string): T {
        return JSON.parse(data) as T;
    }

    // ---------- Health & Monitoring ----------

    /** Sends a PING to Redis. Returns `true` if the server responds with PONG. */
    async ping(): Promise<boolean> {
        const result = await this.redis.ping();
        return result === 'PONG';
    }

    /**
     * Returns `true` when the ioredis client status is `"ready"`.
     * Use this for lightweight liveness checks (e.g. health-check endpoints).
     */
    isConnected(): boolean {
        return this.redis.status === 'ready';
    }

    // ---------- Lifecycle ----------

    async disconnect(): Promise<void> {
        await this.redis.quit();
        logger.info('Redis: Connection closed');
    }

    /** Expose the raw ioredis client for advanced use-cases (pipelines, Lua scripts, etc.) */
    getClient(): Redis {
        return this.redis;
    }
}

export const redisService = RedisService.getInstance();
