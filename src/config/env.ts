/**
 * Environment Configuration
 * @module config
 * @description Parses and validates environment variables using Zod.
 */
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),

    DATABASE_URL: z.string().url(),

    CLIENT_URL: z.string().url().default('http://localhost:3000'),

    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().default(6379),

    JWT_ACCESS_SECRET: z.string().min(16),
    JWT_REFRESH_SECRET: z.string().min(16),
    ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
    REFRESH_TOKEN_EXPIRES_IN_DAYS: z.string().default('7'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten());
    process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
