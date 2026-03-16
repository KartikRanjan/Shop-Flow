/**
 * Auth Model
 * @module auth/models
 * @description This file defines the database schema for the authentication module, specifically for managing refresh tokens
 *
 * This schema is essential for implementing secure authentication mechanisms, allowing the application to manage user sessions effectively. By storing refresh tokens in the database, the application can validate and revoke tokens as needed, enhancing security and user experience.
 *
 * Note: Ensure that the necessary indexes are created on the token field for efficient querying, especially when validating refresh tokens during authentication processes.
 *
 * Example usage:
 * import { refreshSessions } from './auth.model';
 *
 * This will allow you to access the 'refreshSessions' model defined in this file for performing database operations related to refresh sessions.
 *
 */

import { usersTable } from '@infrastructure/database/schema';
import { pgTable, uuid, varchar, timestamp, text } from 'drizzle-orm/pg-core';

export const refreshSessions = pgTable('refresh_sessions', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => usersTable.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    device: varchar('device', { length: 255 }),
    ip: varchar('ip', { length: 255 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
