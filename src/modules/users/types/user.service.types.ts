/**
 * User Service Types
 * @module user/types
 * @description
 */

import type { PaginatedResult, PaginationOptions } from '@types';
import type { UserEntity } from '../entities';

/** Fields a user is allowed to update on their own profile. */
export type UpdateProfileInput = Partial<Pick<UserEntity, 'name' | 'phoneNumber'>>;

export interface IUserService {
    getById(id: string): Promise<UserEntity>;
    getByEmail(email: string): Promise<UserEntity>;
    updateById(id: string, data: UpdateProfileInput): Promise<UserEntity>;
    deleteById(id: string): Promise<void>;
    findAllUsers(options: PaginationOptions): Promise<PaginatedResult<UserEntity>>;
}
