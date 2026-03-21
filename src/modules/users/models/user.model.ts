import { boolean, pgEnum, pgTable, timestamp, uuid, varchar, uniqueIndex } from 'drizzle-orm/pg-core';
import { USER_ROLES } from '@constants';
import { sql } from 'drizzle-orm';

/**
 * User Schema
 * @module users/models
 * @table users
 * @description This schema defines the structure of the users table in the database.
 * It includes fields for id, name, email, phone number, password hash, role, created at, and updated at timestamps.
 */

export const userRoleEnum = pgEnum('user_roles', USER_ROLES);

export const usersTable = pgTable(
    'users',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        name: varchar('name', { length: 255 }).notNull(),
        email: varchar('email', { length: 255 }).notNull(),
        phoneNumber: varchar('phone_number', { length: 20 }),
        passwordHash: varchar('password_hash', { length: 255 }).notNull(),
        roles: userRoleEnum('roles').array().notNull().default([USER_ROLES.USER]),
        isActive: boolean('is_active').notNull().default(true),
        isEmailVerified: boolean('is_email_verified').notNull().default(false),
        isPhoneVerified: boolean('is_phone_verified').notNull().default(false),
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
