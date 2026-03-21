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
import { boolean, pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

// Inline schema to avoid TypeScript path alias resolution issues outside the app build pipeline
const userRoleEnum = pgEnum('user_roles', ['user', 'admin', 'super_admin', 'seller']);

const usersTable = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    phoneNumber: varchar('phone_number', { length: 20 }).unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    roles: userRoleEnum('roles').array().notNull().default(['user']),
    isActive: boolean('is_active').notNull().default(true),
    isEmailVerified: boolean('is_email_verified').notNull().default(false),
    isPhoneVerified: boolean('is_phone_verified').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

async function seedAdmin() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });

    const db = drizzle(pool);

    console.log('🔐 Hashing password...');
    const passwordHash = await argon2.hash('qwerty123');

    console.log('📦 Inserting admin user...');
    const [user] = await db
        .insert(usersTable)
        .values({
            name: 'Kartik',
            email: 'kkrbglr@admin.com',
            passwordHash,
            roles: ['super_admin', 'admin'],
            isActive: true,
            isEmailVerified: true,
        })
        .onConflictDoNothing({ target: usersTable.email })
        .returning();

    if (user) {
        console.log('✅ Admin user seeded successfully!');
        console.log(`   ID:    ${user.id}`);
        console.log(`   Name:  ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Roles: ${user.roles.join(', ')}`);
    } else {
        console.log('⚠️  Admin user with this email already exists — skipping.');
    }

    await pool.end();
}

seedAdmin().catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
});
