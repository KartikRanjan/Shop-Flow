/**
 * AuthRepository
 * @module auth/repositories
 * @description Handles all database operations for the authentication module — user registration and lookups.
 */

import type { Database } from '@infrastructure/database';
import { refreshSessions, users } from '@infrastructure/database/schema';
import { and, eq, isNull, isNotNull, gt } from 'drizzle-orm';
import { BaseRepository } from '@infrastructure/database/repositories/base.repository';
import { ACCOUNT_STATUS } from '@constants';
import type { IAuthRepository, RefreshToken, RefreshTokenInput, RegisterInput, User } from '../types';

export default class AuthRepository extends BaseRepository implements IAuthRepository {
    constructor(private readonly db: Database) {
        super();
    }

    async register(data: RegisterInput): Promise<User> {
        return this.execute({
            context: 'AuthRepository.register',
            operation: async () => {
                const newUser = await this.db.insert(users).values(data).returning();

                if (!newUser[0]) {
                    throw new Error('Failed to register user');
                }

                return newUser[0];
            },
        });
    }

    async setEmailVerificationToken(userId: string, token: string, expiresAt: Date): Promise<boolean> {
        return this.execute({
            context: 'AuthRepository.setEmailVerificationToken',
            operation: async () => {
                const result = await this.db
                    .update(users)
                    .set({
                        emailVerificationToken: token,
                        emailVerificationTokenExpiresAt: expiresAt,
                    })
                    .where(and(eq(users.id, userId), isNull(users.deletedAt), isNull(users.emailVerifiedAt)))
                    .returning();

                return result.length > 0;
            },
        });
    }

    async verifyEmail(token: string): Promise<boolean> {
        return this.execute({
            context: 'AuthRepository.verifyEmail',
            operation: async () => {
                const result = await this.db
                    .update(users)
                    .set({
                        emailVerifiedAt: new Date(),
                        accountStatus: ACCOUNT_STATUS.ACTIVE,
                        statusUpdatedAt: new Date(),
                        emailVerificationToken: null,
                        emailVerificationTokenExpiresAt: null,
                    })
                    .where(
                        and(
                            eq(users.emailVerificationToken, token),
                            eq(users.accountStatus, ACCOUNT_STATUS.PENDING_VERIFICATION),
                            isNull(users.deletedAt),
                            isNotNull(users.emailVerificationTokenExpiresAt),
                            gt(users.emailVerificationTokenExpiresAt, new Date()),
                        ),
                    )
                    .returning();

                return result.length > 0;
            },
        });
    }

    async findUserByEmail(email: string): Promise<User | null> {
        return this.execute({
            context: 'AuthRepository.findUserByEmail',
            operation: async () => {
                const user = await this.db.query.users.findFirst({
                    where: (users, { and, eq, isNull }) => and(eq(users.email, email), isNull(users.deletedAt)),
                });

                return user ?? null;
            },
        });
    }

    async findUserById(id: string): Promise<User | null> {
        return this.execute({
            context: 'AuthRepository.findUserById',
            operation: async () => {
                const user = await this.db.query.users.findFirst({
                    where: (users, { and, eq, isNull }) => and(eq(users.id, id), isNull(users.deletedAt)),
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
