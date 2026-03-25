/**
 * AuthRepository
 * @module auth/repositories
 * @description Handles all database operations for the authentication module — user registration and lookups.
 */

import type { Database } from '@infrastructure/database';
import { refreshSessions, users } from '@infrastructure/database/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { BaseRepository } from '@infrastructure/database/repositories/base.repository';
import type { IAuthRepository, RefreshToken, RefreshTokenInput, RegisterInput, User } from '../types';

export default class AuthRepository extends BaseRepository implements IAuthRepository {
    constructor(private readonly db: Database) {
        super();
    }

    async register({ email, name, passwordHash }: RegisterInput): Promise<User> {
        return this.execute({
            context: 'AuthRepository.register',
            operation: async () => {
                const newUser = await this.db
                    .insert(users)
                    .values({
                        email,
                        name,
                        passwordHash,
                    })
                    .returning();

                if (!newUser[0]) {
                    throw new Error('Failed to register user');
                }

                return newUser[0];
            },
        });
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.execute({
            context: 'AuthRepository.findByEmail',
            operation: async () => {
                const user = await this.db.query.users.findFirst({
                    where: (users, { eq }) => eq(users.email, email),
                    orderBy: (users, { desc }) => [desc(users.createdAt)],
                });

                return user ?? null;
            },
        });
    }

    async findById(id: string): Promise<User | null> {
        return this.execute({
            context: 'AuthRepository.findById',
            operation: async () => {
                const user = await this.db.query.users.findFirst({
                    where: (users, { eq }) => eq(users.id, id),
                });

                return user ?? null;
            },
        });
    }

    async createRefreshSession({ userId, device, ip, userAgent, expiresAt }: RefreshTokenInput): Promise<RefreshToken> {
        return this.execute({
            context: 'AuthRepository.createRefreshSession',
            operation: async () => {
                const newRefreshToken = await this.db
                    .insert(refreshSessions)
                    .values({
                        userId,
                        expiresAt,
                        device,
                        ip,
                        userAgent,
                    })
                    .returning();

                if (!newRefreshToken[0]) {
                    throw new Error('Failed to create refresh session');
                }

                return newRefreshToken[0];
            },
        });
    }

    async findRefreshSession(jti: string): Promise<RefreshToken | null> {
        return this.execute({
            context: 'AuthRepository.findRefreshSession',
            operation: async () => {
                const session = await this.db.query.refreshSessions.findFirst({
                    where: (refreshSessions, { eq }) => eq(refreshSessions.id, jti),
                });

                return session ?? null;
            },
        });
    }

    /** Atomically marks session as revoked and returns it if it was active */
    async consumeRefreshSession(jti: string): Promise<RefreshToken | null> {
        return this.execute({
            context: 'AuthRepository.consumeRefreshSession',
            operation: async () => {
                const result = await this.db
                    .update(refreshSessions)
                    .set({ revokedAt: new Date() })
                    .where(and(eq(refreshSessions.id, jti), isNull(refreshSessions.revokedAt)))
                    .returning();

                return result[0] ?? null;
            },
        });
    }

    async revokeRefreshSession(jti: string): Promise<void> {
        return this.execute({
            context: 'AuthRepository.revokeRefreshSession',
            operation: async () => {
                await this.db.update(refreshSessions).set({ revokedAt: new Date() }).where(eq(refreshSessions.id, jti));
            },
        });
    }

    async revokeAllUserSessions(userId: string): Promise<void> {
        return this.execute({
            context: 'AuthRepository.revokeAllUserSessions',
            operation: async () => {
                await this.db
                    .update(refreshSessions)
                    .set({ revokedAt: new Date() })
                    .where(and(eq(refreshSessions.userId, userId), isNull(refreshSessions.revokedAt)));
            },
        });
    }

    async findActiveSessionsByUser(userId: string): Promise<RefreshToken[]> {
        return this.execute({
            context: 'AuthRepository.findActiveSessionsByUser',
            operation: async () => {
                return this.db.query.refreshSessions.findMany({
                    where: (refreshSessions, { eq, and, isNull, gt }) =>
                        and(
                            eq(refreshSessions.userId, userId),
                            isNull(refreshSessions.revokedAt),
                            gt(refreshSessions.expiresAt, new Date()),
                        ),
                });
            },
        });
    }
}
