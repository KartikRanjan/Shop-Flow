/**
 * User Service Types
 * @module user/types
 * @description
 */

import type { User } from './user.repository.types';
import type { PaginatedResult, PaginationOptions } from '@types';

/** Fields a user is allowed to update on their own profile. */
export type UpdateProfileInput = Partial<Pick<User, 'name' | 'phoneNumber'>>;

export interface IUserService {
    getById(id: string): Promise<User>;
    getByEmail(email: string): Promise<User>;
    updateById(id: string, data: UpdateProfileInput): Promise<User>;
    deleteById(id: string): Promise<void>;
    findAllUsers(options: PaginationOptions): Promise<PaginatedResult<User>>;
}
