/**
 * Database Connection and Drizzle ORM Setup
 * @module database/index
 * @description This file establishes the connection to the PostgreSQL database using the 'pg' library and sets up Drizzle ORM for database interactions.
 * It imports the database schema from the 'schema.ts' file and initializes the Drizzle ORM instance with the connection pool and schema.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../../config/env';
import { logger } from '../logger';
import * as schema from './schema';

const pool = new Pool({
    connectionString: env.DATABASE_URL,
});

// Test connection at startup
pool.query('SELECT 1')
    .then(() => {
        logger.info('Database connection established');
    })
    .catch((err) => {
        logger.error({ err }, 'Database connection failed');
    });

pool.on('error', (err) => {
    logger.error({ err }, 'Database pool error');
});

export const db = drizzle(pool, { schema });
export type Database = typeof db;
