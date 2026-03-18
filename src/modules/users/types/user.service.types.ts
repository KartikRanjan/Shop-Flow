/**
 * User Service Types
 * @module user/types
 * @description
 */

import type { User } from './user.repository.types';
import type { PaginatedResult, PaginationOptions } from '@types';

export interface IUserService {
    getById(id: string): Promise<User>;
    getByEmail(email: string): Promise<User>;
    updateById(id: string, data: Partial<User>): Promise<User>;
    deleteById(id: string): Promise<void>;
    findAllUsers(options: PaginationOptions): Promise<PaginatedResult<User>>;
}
