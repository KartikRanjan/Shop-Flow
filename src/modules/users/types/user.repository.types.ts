/**
 * User Repository Types
 * @module users/types
 * @description Type definitions and interface contract for the UserRepository.
 * Kept inside the users module — these types are not shared with other modules.
 */

import type { PaginatedResult, PaginationOptions } from '@types';
import type { ITransactionalRepository } from '@infrastructure/database/repositories/repository.types';
import type { UserEntity, UserRow } from '../entities';

/** Re-export for convenience within the users module. */
export type { UserRow };

export interface IUserRepository extends ITransactionalRepository<IUserRepository> {
    findById(id: string): Promise<UserEntity | null>;
    findByEmail(email: string): Promise<UserEntity | null>;
    updateById(id: string, data: Partial<UserRow>): Promise<UserEntity | null>;
    deleteById(id: string): Promise<UserEntity | null>;
    findMany(options: PaginationOptions): Promise<PaginatedResult<UserEntity>>;
}
