/**
 * Auth Repository Types
 * @module auth/types
 * @description Type definitions and interface contract for the AuthRepository.
 * Kept inside the auth module — these types are not shared with other modules.
 */

import type { InferSelectModel } from 'drizzle-orm';
import type { refreshSessions, users } from '@infrastructure/database/schema';
import type { ITransactionalRepository } from '@infrastructure/database/repositories/repository.types';
import type { UserEntity } from '../../users/entities';
import type { RefreshSessionEntity } from '../entities';

export type User = InferSelectModel<typeof users>;
export type RefreshToken = InferSelectModel<typeof refreshSessions>;

export type RefreshTokenInput = {
    userId: string;
    device?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    expiresAt: Date;
};
export type RegisterInput = {
    email: string;
    name: string;
    passwordHash: string;
    phoneNumber?: string | null;
    emailVerificationToken?: string | null;
    emailVerificationTokenExpiresAt?: Date | null;
    passwordResetToken?: string | null;
    passwordResetTokenExpiresAt?: Date | null;
};

/** Contract that the AuthRepository must satisfy */
export interface IAuthRepository extends ITransactionalRepository<IAuthRepository> {
    register(data: RegisterInput): Promise<UserEntity>;
    findUserByEmail(email: string): Promise<UserEntity | null>;
    findUserById(id: string): Promise<UserEntity | null>;
    setEmailVerificationToken(userId: string, token: string, expiresAt: Date): Promise<boolean>;
    setPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<boolean>;
    findUserByResetToken(token: string): Promise<UserEntity | null>;
    resetPassword(userId: string, passwordHash: string): Promise<boolean>;
    createRefreshSession(data: RefreshTokenInput): Promise<RefreshSessionEntity>;
    findRefreshSession(jti: string): Promise<RefreshSessionEntity | null>;
    consumeRefreshSession(jti: string): Promise<RefreshSessionEntity | null>;
    revokeRefreshSession(jti: string): Promise<void>;
    revokeAllUserSessions(userId: string): Promise<void>;
    findActiveSessionsByUser(userId: string): Promise<RefreshSessionEntity[]>;
    verifyEmail(token: string): Promise<boolean>;
}
