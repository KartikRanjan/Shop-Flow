/**
 * Auth Repository Types
 * @module auth/types
 * @description Type definitions and interface contract for the AuthRepository.
 * Kept inside the auth module — these types are not shared with other modules.
 */

import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type { users } from '@infrastructure/database/schema';

/** Shape of a full User row as returned from the database */
export type User = InferSelectModel<typeof users>;

/** Minimal fields required to register a new user */
export type RegisterInput = Pick<InferInsertModel<typeof users>, 'email' | 'name' | 'passwordHash'>;

/** Contract that the AuthRepository must satisfy */
export interface IAuthRepository {
    register(data: RegisterInput): Promise<User>;
    findByEmail(email: string): Promise<User | null>;
}
