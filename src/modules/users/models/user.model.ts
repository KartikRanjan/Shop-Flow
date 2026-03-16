import { boolean, pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { USER_ROLES } from '@constants';

/**
 * User Schema
 * @module users/models
 * @table users
 * @description This schema defines the structure of the users table in the database.
 * It includes fields for id, name, email, phone number, password hash, role, created at, and updated at timestamps.
 */

export const userRoleEnum = pgEnum('user_roles', USER_ROLES);

export const usersTable = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    phoneNumber: varchar('phone_number', { length: 20 }).unique(),
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
});

// Maintain backward compatibility
export const users = usersTable;
