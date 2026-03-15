/**
 * AuthRepository
 * @module auth/repositories
 * @description Handles all database operations for the authentication module — user registration and lookups.
 */

import { BaseRepository } from '@infrastructure/database/repositories/base.repository';
import type { Database } from '@infrastructure/database';
import { users } from '@infrastructure/database/schema';
import type { IAuthRepository, RegisterInput, User } from '../types';

export default class AuthRepository extends BaseRepository implements IAuthRepository {
    constructor(private readonly db: Database) {
        super();
    }

    async register({ email, name, passwordHash }: RegisterInput): Promise<User> {
        const newUser = await this.db
            .insert(users)
            .values({
                email,
                name,
                passwordHash,
            })
            .returning();

        return newUser[0];
    }

    async findByEmail(email: string): Promise<User | null> {
        const user = await this.db.query.users.findFirst({
            where: (users, { eq, and, isNull }) =>
                and(eq(users.email, email), isNull(users.deletedAt)),
        });

        return user ?? null;
    }

    async findById(id: string): Promise<User | null> {
        const user = await this.db.query.users.findFirst({
            where: (users, { eq, and, isNull }) => and(eq(users.id, id), isNull(users.deletedAt)),
        });

        return user ?? null;
    }
}
