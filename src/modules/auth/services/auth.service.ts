/**
 * AuthService
 * @module auth/services
 * @description Service layer for authentication-related operations. Handles the business logic for user registration and login.
 */

import argon2 from 'argon2';
import { AppError } from '@errors';
import { DAY_MS, ERROR_CODE, HTTP_STATUS } from '@constants';
import type {
    IAuthRepository,
    IAuthService,
    LoginResult,
    LoginUserInput,
    RefreshResult,
    RefreshToken,
    RegisterUserInput,
    User,
} from '../types';
import { env } from '@config/env';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '@utils/jwt.util';

export default class AuthService implements IAuthService {
    constructor(private readonly authRepository: IAuthRepository) {}

    /** Ensures email uniqueness and hashes password before user creation */
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

    /** Validates credentials/status and enforces a 5-session limit per user */
    async loginUser(data: LoginUserInput): Promise<LoginResult> {
        const user = await this.authRepository.findByEmail(data.email);

        if (!user) {
            throw new AppError({
                message: 'Invalid email or password',
                statusCode: HTTP_STATUS.UNAUTHORIZED,
                errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
            });
        }

        if (!user.isActive || user.deletedAt) {
            throw new AppError({
                message: `User account is ${user.deletedAt ? 'has been deleted' : 'inactive'}`,
                statusCode: HTTP_STATUS.FORBIDDEN,
                errorCode: ERROR_CODE.AUTHORIZATION_ERROR,
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

        const refreshExpiryDays = Number(env.REFRESH_TOKEN_EXPIRES_IN_DAYS);

        const newRefreshSession = await this.authRepository.createRefreshSession({
            userId: user.id,
            expiresAt: new Date(Date.now() + refreshExpiryDays * DAY_MS),
            device: data.device,
            ip: data.ip,
            userAgent: data.userAgent,
        });

        // Enforce a maximum number of active sessions to prevent database bloat
        const MAX_ACTIVE_SESSIONS = 5;
        const activeSessions = await this.authRepository.findActiveSessionsByUser(user.id);

        if (activeSessions.length > MAX_ACTIVE_SESSIONS) {
            // Sort by expiration date ascending (oldest expiring first)
            activeSessions.sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
            const sessionsToRevoke = activeSessions.slice(
                0,
                activeSessions.length - MAX_ACTIVE_SESSIONS,
            );

            await Promise.all(
                sessionsToRevoke.map((session) =>
                    this.authRepository.revokeRefreshSession(session.id),
                ),
            );
        }

        const refreshToken = generateRefreshToken(
            { sub: user.id, jti: newRefreshSession.id },
            `${refreshExpiryDays}d`,
        );

        const accessToken = generateAccessToken(
            { sub: user.id, email: user.email, roles: user.roles, sid: newRefreshSession.id },
            env.ACCESS_TOKEN_EXPIRES_IN,
        );

        return { user, accessToken, refreshToken } satisfies LoginResult;
    }

    /** Rotates tokens by atomically consuming the old session and creating a new one */
    async refreshTokens(refreshToken: string): Promise<RefreshResult> {
        const payload = verifyRefreshToken(refreshToken);

        // Atomically check AND revoke the session in a single database operation
        const session = await this.authRepository.consumeRefreshSession(payload.jti);

        if (!session || session.expiresAt < new Date()) {
            throw new AppError({
                message: 'Refresh token is invalid or has been revoked',
                statusCode: HTTP_STATUS.UNAUTHORIZED,
                errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
            });
        }

        const user = await this.authRepository.findById(session.userId);

        if (!user) {
            throw new AppError({
                message: 'User associated with refresh token not found',
                statusCode: HTTP_STATUS.UNAUTHORIZED,
                errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
            });
        }

        if (!user.isActive || user.deletedAt) {
            throw new AppError({
                message: `User account is ${user?.deletedAt ? 'has been deleted' : 'inactive'}`,
                statusCode: HTTP_STATUS.FORBIDDEN,
                errorCode: ERROR_CODE.AUTHORIZATION_ERROR,
            });
        }

        const refreshExpiryDays = Number(env.REFRESH_TOKEN_EXPIRES_IN_DAYS);

        const newRefreshSession = await this.authRepository.createRefreshSession({
            userId: user.id,
            expiresAt: new Date(Date.now() + refreshExpiryDays * DAY_MS),
            device: session.device,
            ip: session.ip,
            userAgent: session.userAgent,
        });

        const newRefreshToken = generateRefreshToken(
            { sub: user.id, jti: newRefreshSession.id },
            `${refreshExpiryDays}d`,
        );

        const accessToken = generateAccessToken(
            { sub: user.id, email: user.email, roles: user.roles, sid: newRefreshSession.id },
            env.ACCESS_TOKEN_EXPIRES_IN,
        );

        return { accessToken, refreshToken: newRefreshToken } satisfies RefreshResult;
    }

    /** Revokes a session after verifying it belongs to the authenticated user */
    async logout(userId: string, refreshToken: string): Promise<void> {
        const payload = verifyRefreshToken(refreshToken);
        const session = await this.authRepository.findRefreshSession(payload.jti);

        if (session?.userId !== userId) {
            throw new AppError({
                message: 'Refresh token is invalid or does not belong to the authenticated user',
                statusCode: HTTP_STATUS.UNAUTHORIZED,
                errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
            });
        }

        await this.authRepository.revokeRefreshSession(payload.jti);
    }

    async logoutAll(userId: string): Promise<void> {
        await this.authRepository.revokeAllUserSessions(userId);
    }

    async getActiveSessions(userId: string): Promise<RefreshToken[]> {
        return this.authRepository.findActiveSessionsByUser(userId);
    }
}
