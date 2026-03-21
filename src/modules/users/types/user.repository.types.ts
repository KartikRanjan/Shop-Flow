/**
 * User Repository Types
 * @module users/types
 * @description Type definitions and interface contract for the UserRepository.
 * Kept inside the users module — these types are not shared with other modules.
 */

import type { InferSelectModel } from 'drizzle-orm';
import type { users } from '@infrastructure/database/schema';
import type { PaginatedResult, PaginationOptions } from '@types';

export type User = InferSelectModel<typeof users>;

export interface IUserRepository {
    findById(id: string): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
    updateById(id: string, data: Partial<User>): Promise<User | null>;
    deleteById(id: string): Promise<User | null>;
    findMany(options: PaginationOptions): Promise<PaginatedResult<User>>;
}
