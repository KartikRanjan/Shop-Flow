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
};

/** Contract that the AuthRepository must satisfy */
export interface IAuthRepository {
    register(data: RegisterInput): Promise<User>;
    findByEmail(email: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
    createRefreshSession(data: RefreshTokenInput): Promise<RefreshToken>;
    findRefreshSession(jti: string): Promise<RefreshToken | null>;
    consumeRefreshSession(jti: string): Promise<RefreshToken | null>;
    revokeRefreshSession(jti: string): Promise<void>;
    revokeAllUserSessions(userId: string): Promise<void>;
    findActiveSessionsByUser(userId: string): Promise<RefreshToken[]>;
}
