/**
 * Admin Seed Script
 * @description Seeds an admin user into the database. Safe to run multiple times (idempotent).
 *
 * Usage: npm run seed:admin
 */

import 'dotenv/config';
import argon2 from 'argon2';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

// Inline schema to avoid TypeScript path alias resolution issues outside the app build pipeline
const userRoleEnum = pgEnum('user_roles', ['user', 'admin', 'super_admin', 'seller']);
const accountStatusEnum = pgEnum('account_status', ['pending_verification', 'active', 'suspended', 'banned']);

const usersTable = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    phoneNumber: varchar('phone_number', { length: 20 }),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    roles: userRoleEnum('roles').array().notNull().default(['user']),
    accountStatus: accountStatusEnum('account_status').notNull().default('pending_verification'),
    statusUpdatedAt: timestamp('status_updated_at', { withTimezone: true }).defaultNow().notNull(),
    statusReason: varchar('status_reason', { length: 500 }),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    emailVerificationToken: varchar('email_verification_token', { length: 255 }),
    emailVerificationTokenExpiresAt: timestamp('email_verification_token_expires_at', { withTimezone: true }),
});

import { eq } from 'drizzle-orm';

async function seedAdmin() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });

    const db = drizzle(pool);

    console.log('🔐 Hashing password...');
    const passwordHash = await argon2.hash('qwerty123');

    console.log('🔍 Checking if user exists...');
    const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.email, 'kkrbglr@gmail.com'));

    if (existingUser) {
        console.log('⚠️  Admin user with this email already exists — skipping.');
        await pool.end();
        return;
    }

    console.log('📦 Inserting admin user...');
    const now = new Date();
    const [user] = await db
        .insert(usersTable)
        .values({
            name: 'Kartik',
            email: 'kkrbglr@gmail.com',
            passwordHash,
            roles: ['super_admin', 'admin'],
            accountStatus: 'active',
            statusUpdatedAt: now,
            emailVerifiedAt: now,
        })
        .returning();

    if (user) {
        console.log('✅ Admin user seeded successfully!');
        console.log(`   ID:    ${user.id}`);
        console.log(`   Name:  ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Roles: ${user.roles.join(', ')}`);
    }

    await pool.end();
}

seedAdmin().catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
});
