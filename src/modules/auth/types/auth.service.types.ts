/**
 * Auth Service Types
 * @module auth/types
 * @description Type definitions and interface contract for the AuthService.
 */

import type { UserEntity } from '../../users/entities';
import type { RefreshSessionEntity } from '../entities';
import type { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from '../dto';

export type RegisterUserInput = RegisterDto;
export type LoginUserInput = LoginDto & {
    ip?: string;
    userAgent?: string;
};
export type ForgotPasswordInput = ForgotPasswordDto;
export type ResetPasswordInput = ResetPasswordDto;

export type LoginResult = {
    user: UserEntity;
    accessToken: string;
    refreshToken: string;
};

export type RefreshResult = {
    accessToken: string;
    refreshToken: string;
};

export interface IAuthService {
    registerUser(data: RegisterUserInput): Promise<UserEntity>;
    resendVerificationEmail(email: string): Promise<void>;
    loginUser(data: LoginUserInput): Promise<LoginResult>;
    refreshTokens(refreshToken: string): Promise<RefreshResult>;
    logout(userId: string, refreshToken: string): Promise<void>;
    logoutAll(userId: string): Promise<void>;
    getActiveSessions(userId: string): Promise<RefreshSessionEntity[]>;
    verifyEmail(token: string): Promise<void>;
    verifyResetToken(token: string): Promise<void>;
    forgotPassword(data: ForgotPasswordInput): Promise<void>;
    resetPassword(data: ResetPasswordInput): Promise<void>;
}
