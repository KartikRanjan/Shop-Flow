import { pgEnum, pgTable, timestamp, uuid, varchar, uniqueIndex } from 'drizzle-orm/pg-core';
import { ACCOUNT_STATUS, USER_ROLES } from '@constants';
import { sql } from 'drizzle-orm';

/**
 * User Schema
 * @module users/models
 * @table users
 * @description This schema defines the structure of the users table in the database.
 * It includes fields for id, name, email, phone number, password hash, role, created at, and updated at timestamps.
 */

export const userRoleEnum = pgEnum('user_roles', USER_ROLES);
export const accountStatusEnum = pgEnum('account_status', [
    ACCOUNT_STATUS.PENDING_VERIFICATION,
    ACCOUNT_STATUS.ACTIVE,
    ACCOUNT_STATUS.SUSPENDED,
    ACCOUNT_STATUS.BANNED,
]);

export const usersTable = pgTable(
    'users',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        name: varchar('name', { length: 255 }).notNull(),
        email: varchar('email', { length: 255 }).notNull(),
        phoneNumber: varchar('phone_number', { length: 20 }),
        passwordHash: varchar('password_hash', { length: 255 }).notNull(),
        roles: userRoleEnum('roles').array().notNull().default([USER_ROLES.USER]),
        accountStatus: accountStatusEnum('account_status').notNull().default(ACCOUNT_STATUS.PENDING_VERIFICATION),
        statusUpdatedAt: timestamp('status_updated_at', { withTimezone: true }).defaultNow().notNull(),
        statusReason: varchar('status_reason', { length: 500 }),
        emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
        emailVerificationToken: varchar('email_verification_token', { length: 255 }),
        emailVerificationTokenExpiresAt: timestamp('email_verification_token_expires_at', { withTimezone: true }),
        phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .defaultNow()
            .$onUpdate(() => new Date()),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
    },
    (table) => {
        return {
            emailIdx: uniqueIndex('unique_active_email_idx')
                .on(table.email)
                .where(sql`"deleted_at" IS NULL`),
            phoneIdx: uniqueIndex('unique_active_phone_idx')
                .on(table.phoneNumber)
                .where(sql`"deleted_at" IS NULL AND "phone_number" IS NOT NULL`),
        };
    },
);
// Maintain backward compatibility
export const users = usersTable;
