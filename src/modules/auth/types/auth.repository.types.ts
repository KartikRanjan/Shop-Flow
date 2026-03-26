/**
 * Auth Repository Types
 * @module auth/types
 * @description Type definitions and interface contract for the AuthRepository.
 * Kept inside the auth module — these types are not shared with other modules.
 */

import type { InferSelectModel } from 'drizzle-orm';
import type { refreshSessions, users } from '@infrastructure/database/schema';

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
};

/** Contract that the AuthRepository must satisfy */
export interface IAuthRepository {
    register(data: RegisterInput): Promise<User>;
    findUserByEmail(email: string): Promise<User | null>;
    findUserById(id: string): Promise<User | null>;
    setEmailVerificationToken(userId: string, token: string, expiresAt: Date): Promise<boolean>;
    createRefreshSession(data: RefreshTokenInput): Promise<RefreshToken>;
    findRefreshSession(jti: string): Promise<RefreshToken | null>;
    consumeRefreshSession(jti: string): Promise<RefreshToken | null>;
    revokeRefreshSession(jti: string): Promise<void>;
    revokeAllUserSessions(userId: string): Promise<void>;
    findActiveSessionsByUser(userId: string): Promise<RefreshToken[]>;
    verifyEmail(token: string): Promise<boolean>;
}
