/**
 * Auth Service Types
 * @module auth/types
 * @description Type definitions and interface contract for the AuthService.
 */

import type { LoginDto, RegisterDto } from '../dto';
import type { User } from './auth.repository.types';

export type RegisterUserInput = RegisterDto;
export type LoginUserInput = LoginDto;

export interface IAuthService {
    registerUser(data: RegisterUserInput): Promise<User>;
    loginUser(data: LoginUserInput): Promise<User>;
}
