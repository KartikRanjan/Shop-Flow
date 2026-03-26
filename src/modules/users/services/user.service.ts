/**
 ** UserService
 * @module user/services
 * @description Service layer for user-related operations.
 */

import { NotFoundError, ValidationError } from '@errors';
import type { UserRepository } from '../repositories';
import type { UpdateProfileInput } from '../types';
import type { PaginationOptions } from '@types';
import { toUserDetailsDto } from '../dto';
import { userCache } from '@modules/auth/cache/user.cache';

export default class UserService {
    constructor(private readonly userRepository: UserRepository) {}

    /** Retrieves user by ID and throws NotFoundError if not found */
    async getUserById(id: string) {
        const user = await this.userRepository.findById(id);
        if (!user) {
            throw new NotFoundError('User not found');
        }
        return user;
    }

    async getUserByEmail(email: string) {
        return await this.userRepository.findByEmail(email);
    }

    async updateProfileById(id: string, data: UpdateProfileInput) {
        if (!data || Object.keys(data).length === 0) {
            throw new ValidationError('No fields provided to update');
        }
        const updatedUser = await this.userRepository.updateById(id, data);
        if (!updatedUser) {
            throw new NotFoundError('User not found');
        }
        await userCache.invalidate(id);
        return updatedUser;
    }

    async deleteAccountById(id: string): Promise<void> {
        const user = await this.userRepository.deleteById(id);
        if (!user) {
            throw new NotFoundError('User not found');
        }
        await userCache.invalidate(id);
    }

    /** Retrieves paginated users and transforms to DTOs */
    async findAllUsers(options: PaginationOptions) {
        const result = await this.userRepository.findMany(options);
        return {
            ...result,
            data: result.data.map(toUserDetailsDto),
        };
    }
}
