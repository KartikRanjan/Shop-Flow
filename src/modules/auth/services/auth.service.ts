import argon2 from 'argon2';
import { AppError, ValidationError } from '@errors';
import { ACCOUNT_STATUS, DAY_MS, ERROR_CODE, HTTP_STATUS } from '@constants';
import type {
    ForgotPasswordInput,
    IAuthRepository,
    IAuthService,
    LoginResult,
    LoginUserInput,
    RefreshResult,
    RegisterUserInput,
    ResetPasswordInput,
} from '../types';
import { env } from '@config/env';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '@utils';
import { sessionCache } from '../cache/session.cache';
import { userCache } from '../cache/user.cache';
import type { UserRole } from '@constants';
import crypto from 'crypto';
import { emailService } from '@infrastructure/email/email.service';
import { logger } from '@infrastructure/logger';
import type { UserEntity } from '@modules/users';
import type { RefreshSessionEntity } from '../entities';

export default class AuthService implements IAuthService {
    constructor(private readonly authRepository: IAuthRepository) {}

    private createEmailVerificationToken(): { token: string; expiresAt: Date } {
        return {
            token: crypto.randomBytes(32).toString('hex'),
            expiresAt: new Date(Date.now() + DAY_MS),
        };
    }

    private createPasswordResetToken(): { token: string; expiresAt: Date } {
        return {
            token: crypto.randomBytes(32).toString('hex'),
            expiresAt: new Date(Date.now() + DAY_MS),
        };
    }

    private async sendVerificationEmail(params: { email: string; name: string; token: string }): Promise<void> {
        const { email, name, token } = params;

        await emailService.enqueueVerificationEmail({
            to: email,
            name,
            verificationUrl: `${env.APP_URL}/api/v1/auth/verify-email?token=${token}`,
        });
    }

    private async sendResetPasswordEmail(params: { email: string; name: string; token: string }): Promise<void> {
        const { email, name, token } = params;

        await emailService.enqueueResetPasswordEmail({
            to: email,
            name,
            resetUrl: `${env.APP_URL}/reset-password.html?token=${token}`,
        });
    }

    /** Ensures email uniqueness and hashes password before user creation */
    async registerUser(data: RegisterUserInput): Promise<UserEntity> {
        const existingUser = await this.authRepository.findUserByEmail(data.email);

        if (existingUser) {
            throw new AppError({
                message: 'User already exists',
                statusCode: HTTP_STATUS.CONFLICT,
                errorCode: ERROR_CODE.RESOURCE_ALREADY_EXISTS,
            });
        }

        const passwordHash = await argon2.hash(data.password);
        const { token: emailVerificationToken, expiresAt: emailVerificationTokenExpiresAt } =
            this.createEmailVerificationToken();

        const newUser = await this.authRepository.register({
            ...data,
            passwordHash,
            emailVerificationToken,
            emailVerificationTokenExpiresAt,
        });

        void this.sendVerificationEmail({
            email: newUser.email,
            name: newUser.name,
            token: emailVerificationToken,
        }).catch((error: unknown) => {
            logger.error(
                {
                    error,
                    userId: newUser.id,
                    email: newUser.email,
                },
                'Failed to enqueue verification email after registration',
            );
        });

        return newUser;
    }

    async resendVerificationEmail(email: string): Promise<void> {
        try {
            const user = await this.authRepository.findUserByEmail(email);

            // Silent return for non-existent or already verified users to prevent enumeration
            if (!user || user.isEmailVerified()) {
                return;
            }

            const reusableToken = user.getReusableVerificationToken();
            let tokenToSend = reusableToken?.token;

            if (!tokenToSend) {
                const { token, expiresAt } = this.createEmailVerificationToken();

                // Persist a new token only when there is no valid stored token to reuse.
                const tokenUpdated = await this.authRepository.setEmailVerificationToken(user.id, token, expiresAt);

                if (!tokenUpdated) {
                    logger.warn(
                        { userId: user.id, email: user.email },
                        'Verification email token update failed (user may have been verified or deleted)',
                    );
                    return;
                }

                tokenToSend = token;
            }

            await this.sendVerificationEmail({
                email: user.email,
                name: user.name,
                token: tokenToSend,
            });
        } catch (error: unknown) {
            logger.error(
                {
                    error,
                    email,
                },
                'Failed to resend verification email',
            );
            // Always return normally to the controller to preserve anti-enumeration behavior.
            return;
        }
    }

    async verifyEmail(token: string): Promise<void> {
        const isVerified = await this.authRepository.verifyEmail(token);

        if (!isVerified) {
            throw new ValidationError('Invalid or expired verification token');
        }
    }

    async verifyResetToken(token: string): Promise<void> {
        const user = await this.authRepository.findUserByResetToken(token);

        if (!user) {
            throw new ValidationError('Invalid or expired password reset token');
        }
    }

    async forgotPassword(data: ForgotPasswordInput): Promise<void> {
        try {
            const user = await this.authRepository.findUserByEmail(data.email);

            // Silent return for non-existent users to prevent enumeration
            if (!user) {
                return;
            }

            const reusableToken = user.getReusableResetToken();
            let tokenToSend = reusableToken?.token;

            if (!tokenToSend) {
                const { token, expiresAt } = this.createPasswordResetToken();

                const tokenUpdated = await this.authRepository.setPasswordResetToken(user.id, token, expiresAt);

                if (!tokenUpdated) {
                    logger.warn(
                        { userId: user.id, email: user.email },
                        'Password reset token update failed (user may have been deleted)',
                    );
                    return;
                }

                tokenToSend = token;
            }

            await this.sendResetPasswordEmail({
                email: user.email,
                name: user.name,
                token: tokenToSend,
            });
        } catch (error: unknown) {
            logger.error(
                {
                    error,
                    email: data.email,
                },
                'Failed to handle forgot password request',
            );
            // Always return normally to preserve anti-enumeration behavior.
            return;
        }
    }

    async resetPassword(data: ResetPasswordInput): Promise<void> {
        const user = await this.authRepository.findUserByResetToken(data.token);

        if (!user) {
            throw new ValidationError('Invalid or expired password reset token');
        }

        const passwordHash = await argon2.hash(data.password);
        const updated = await this.authRepository.resetPassword(user.id, passwordHash);

        if (!updated) {
            throw new AppError({
                message: 'Failed to reset password',
                statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
                errorCode: ERROR_CODE.DATABASE_ERROR,
            });
        }

        // Security best practice: Revoke all active sessions when password is reset
        await this.logoutAll(user.id);
    }

    /** Validates credentials/status and enforces a 5-session limit per user */
    async loginUser(data: LoginUserInput): Promise<LoginResult> {
        const user = await this.authRepository.findUserByEmail(data.email);

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

        if (!user.isActive()) {
            const statusMessages = {
                [ACCOUNT_STATUS.PENDING_VERIFICATION]: 'Please verify your email before logging in',
                [ACCOUNT_STATUS.SUSPENDED]: 'User account is suspended',
                [ACCOUNT_STATUS.BANNED]: 'User account is banned',
            } as const;

            throw new AppError({
                message: statusMessages[user.accountStatus as keyof typeof statusMessages] ?? 'Access denied',
                statusCode: HTTP_STATUS.FORBIDDEN,
                errorCode: ERROR_CODE.AUTHORIZATION_ERROR,
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
            const sessionsToRevoke = activeSessions.slice(0, activeSessions.length - MAX_ACTIVE_SESSIONS);

            await Promise.all(
                sessionsToRevoke.map(async (session) => {
                    await this.authRepository.revokeRefreshSession(session.id);
                    // Remove evicted sessions from Redis
                    void sessionCache.delete(user.id, session.id);
                }),
            );
        }

        const refreshToken = generateRefreshToken({ sub: user.id, jti: newRefreshSession.id }, `${refreshExpiryDays}d`);

        const accessToken = generateAccessToken(
            { sub: user.id, sid: newRefreshSession.id, email: user.email, roles: user.roles },
            env.ACCESS_TOKEN_EXPIRES_IN,
        );

        // ── Cache new session + user (fire-and-forget; non-critical) ──────────
        void sessionCache.set({
            id: newRefreshSession.id,
            userId: user.id,
            expiresAt: newRefreshSession.expiresAt.toISOString(),
            revokedAt: null,
        });

        void userCache.set({
            id: user.id,
            email: user.email,
            roles: user.roles as UserRole[],
            accountStatus: user.accountStatus,
        });

        return { user, accessToken, refreshToken } satisfies LoginResult;
    }

    /** Rotates tokens by atomically consuming the old session and creating a new one */
    async refreshTokens(refreshToken: string): Promise<RefreshResult> {
        const payload = verifyRefreshToken(refreshToken);

        // Atomically check AND revoke the session in a single database operation
        const session = await this.authRepository.consumeRefreshSession(payload.jti);

        if (!session || session.isInvalid()) {
            throw new AppError({
                message: 'Refresh token is invalid or has been revoked',
                statusCode: HTTP_STATUS.UNAUTHORIZED,
                errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
            });
        }

        // ── Remove old session from Redis ─────────────────────────────────────
        void sessionCache.delete(session.userId, session.id);

        const user = await this.authRepository.findUserById(session.userId);

        if (!user?.isActive()) {
            throw new AppError({
                message: 'Refresh token is invalid or has been revoked',
                statusCode: HTTP_STATUS.UNAUTHORIZED,
                errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
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
            { sub: user.id, sid: newRefreshSession.id, email: user.email, roles: user.roles },
            env.ACCESS_TOKEN_EXPIRES_IN,
        );

        // ── Cache rotated session (fire-and-forget) ───────────────────────────
        void sessionCache.set({
            id: newRefreshSession.id,
            userId: user.id,
            expiresAt: newRefreshSession.expiresAt.toISOString(),
            revokedAt: null,
        });

        return { accessToken, refreshToken: newRefreshToken } satisfies RefreshResult;
    }

    /** Revokes a session after verifying it belongs to the authenticated user */
    async logout(userId: string, refreshToken: string): Promise<void> {
        const payload = verifyRefreshToken(refreshToken);
        const session = await this.authRepository.findRefreshSession(payload.jti);

        if (!session || !session.belongsTo(userId) || session.isRevoked()) {
            throw new AppError({
                message: 'Refresh token is invalid or has already been revoked',
                statusCode: HTTP_STATUS.UNAUTHORIZED,
                errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
            });
        }

        await this.authRepository.revokeRefreshSession(payload.jti);

        // ── Remove session from Redis (fire-and-forget) ───────────────────────
        void sessionCache.delete(userId, payload.jti);
    }

    async logoutAll(userId: string): Promise<void> {
        await this.authRepository.revokeAllUserSessions(userId);

        // ── Remove all sessions + user cache from Redis (fire-and-forget) ─────
        void sessionCache.deleteAllForUser(userId);
        void userCache.invalidate(userId);
    }

    async getActiveSessions(userId: string): Promise<RefreshSessionEntity[]> {
        return this.authRepository.findActiveSessionsByUser(userId);
    }
}
