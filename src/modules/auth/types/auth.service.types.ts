/**
 * Auth Service Types
 * @module auth/types
 * @description Type definitions and interface contract for the AuthService.
 */

import type { LoginDto, RegisterDto } from '../dto';
import type { RefreshToken, User } from './auth.repository.types';

export type RegisterUserInput = RegisterDto;
export type LoginUserInput = LoginDto & {
    ip?: string;
    userAgent?: string;
};

export type LoginResult = {
    user: User;
    accessToken: string;
    refreshToken: string;
};

export type RefreshResult = {
    accessToken: string;
    refreshToken: string;
};

export interface IAuthService {
    registerUser(data: RegisterUserInput): Promise<User>;
    loginUser(data: LoginUserInput): Promise<LoginResult>;
    refreshTokens(refreshToken: string): Promise<RefreshResult>;
    logout(jti: string): Promise<void>;
    logoutAll(userId: string): Promise<void>;
    getActiveSessions(userId: string): Promise<RefreshToken[]>;
}
