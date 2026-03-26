/**
 * Queue Configuration
 * @module infrastructure/queue
 * @description Shared BullMQ queue settings.
 */

import type { ConnectionOptions } from 'bullmq';
import { env } from '@config/env';

const normalizedRedisPrefix = (env.REDIS_KEY_PREFIX ?? '').replace(/:+$/, '');

export const bullMqConnection: ConnectionOptions = {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
};

export const bullMqPrefix = normalizedRedisPrefix ? `${normalizedRedisPrefix}:queue` : 'queue';
