/**
 * AuthService
 * @module auth/services
 * @description Service layer for authentication-related operations. Handles the business logic for user registration and login.
 */

import argon2 from 'argon2';
import { AppError } from '@errors';
import { ERROR_CODE, HTTP_STATUS } from '@constants';
import type {
    IAuthRepository,
    IAuthService,
    LoginUserInput,
    RegisterUserInput,
    User,
} from '../types';

export default class AuthService implements IAuthService {
    constructor(private readonly authRepository: IAuthRepository) {}

    async registerUser(data: RegisterUserInput): Promise<User> {
        const existingUser = await this.authRepository.findByEmail(data.email);

        if (existingUser) {
            throw new AppError({
                message: 'User already exists',
                statusCode: HTTP_STATUS.CONFLICT,
                errorCode: ERROR_CODE.RESOURCE_ALREADY_EXISTS,
            });
        }

        const passwordHash = await argon2.hash(data.password);

        return this.authRepository.register({ ...data, passwordHash });
    }

    async loginUser(data: LoginUserInput): Promise<User> {
        const user = await this.authRepository.findByEmail(data.email);

        if (!user) {
            throw new AppError({
                message: 'Invalid email or password',
                statusCode: HTTP_STATUS.UNAUTHORIZED,
                errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
            });
        }

        const isPasswordValid = await argon2.verify(user.passwordHash, data.password);

        if (!isPasswordValid) {
            throw new AppError({
                message: 'Invalid email or password',
                statusCode: HTTP_STATUS.UNAUTHORIZED,
                errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
            });
        }

        return user;
    }
}
