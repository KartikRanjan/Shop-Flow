/**
 * AuthService Unit Tests
 * @description Unit tests for the AuthService class.
 */

import AuthService from '../../services/auth.service';
import type { IAuthRepository, User, RefreshToken } from '../../types';
import argon2 from 'argon2';
import { ACCOUNT_STATUS, HTTP_STATUS, USER_ROLES, ERROR_CODE } from '@constants';
import * as jwtUtils from '@utils';
import { DatabaseError } from '@errors';
import { emailService } from '@infrastructure/email/email.service';

// Mock dependencies
jest.mock('argon2');
jest.mock('@utils/jwt.util');
jest.mock('@infrastructure/email/email.service', () => ({
    emailService: {
        enqueueVerificationEmail: jest.fn().mockResolvedValue('job-id'),
    },
}));
jest.mock('../../cache/session.cache', () => ({
    sessionCache: {
        set: jest.fn().mockResolvedValue(true),
        delete: jest.fn().mockResolvedValue(true),
        deleteAllForUser: jest.fn().mockResolvedValue(true),
    },
}));
jest.mock('../../cache/user.cache', () => ({
    userCache: {
        set: jest.fn().mockResolvedValue(true),
        invalidate: jest.fn().mockResolvedValue(true),
    },
}));
jest.mock('@config/env', () => ({
    env: {
        REFRESH_TOKEN_EXPIRES_IN_DAYS: '30',
        ACCESS_TOKEN_EXPIRES_IN: '15m',
        APP_URL: 'http://localhost:3000',
        NODE_ENV: 'test',
    },
}));

describe('AuthService', () => {
    let authService: AuthService;
    let mockAuthRepository: jest.Mocked<IAuthRepository>;

    const mockUser: User = {
        id: 'user-id',
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: 'hashed-password',
        roles: [USER_ROLES.USER],
        accountStatus: ACCOUNT_STATUS.PENDING_VERIFICATION,
        statusUpdatedAt: new Date(),
        statusReason: null,
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
        phoneNumber: null,
        emailVerificationToken: null,
        emailVerificationTokenExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
    };

    const mockSession: RefreshToken = {
        id: 'session-id',
        userId: 'user-id',
        expiresAt: new Date(Date.now() + 100_000),
        revokedAt: null,
        device: 'device',
        ip: '127.0.0.1',
        userAgent: 'ua',
        createdAt: new Date(),
    };

    beforeEach(() => {
        jest.clearAllMocks();

        mockAuthRepository = {
            register: jest.fn(),
            findUserByEmail: jest.fn(),
            findUserById: jest.fn(),
            setEmailVerificationToken: jest.fn(),
            createRefreshSession: jest.fn(),
            findRefreshSession: jest.fn(),
            consumeRefreshSession: jest.fn(),
            revokeRefreshSession: jest.fn(),
            revokeAllUserSessions: jest.fn(),
            findActiveSessionsByUser: jest.fn(),
            verifyEmail: jest.fn(),
        } as jest.Mocked<IAuthRepository>;

        authService = new AuthService(mockAuthRepository);
    });

    // ─── registerUser ─────────────────────────────────────────────────────────

    describe('registerUser', () => {
        const registerData = { email: 'test@example.com', name: 'Test User', password: 'password123' };

        it('should register a new user successfully', async () => {
            mockAuthRepository.findUserByEmail.mockResolvedValue(null);
            (argon2.hash as jest.Mock).mockResolvedValue('hashed-password');
            mockAuthRepository.register.mockResolvedValue(mockUser);

            const result = await authService.registerUser(registerData);

            expect(result).toEqual(mockUser);
            expect(mockAuthRepository.findUserByEmail).toHaveBeenCalledWith(registerData.email);
            expect(argon2.hash).toHaveBeenCalledWith(registerData.password);
            expect(mockAuthRepository.register).toHaveBeenCalledWith(
                expect.objectContaining({ passwordHash: 'hashed-password', email: registerData.email }),
            );
            const registrationEmailCall: Parameters<typeof emailService.enqueueVerificationEmail>[0] | undefined =
                jest.mocked(emailService.enqueueVerificationEmail).mock.calls[0]?.[0];

            expect(registrationEmailCall).toEqual(
                expect.objectContaining({
                    to: mockUser.email,
                    name: mockUser.name,
                    verificationUrl: expect.stringContaining('/api/v1/auth/verify-email?token=') as string,
                }),
            );
        });

        it('should throw CONFLICT AppError if user already exists', async () => {
            mockAuthRepository.findUserByEmail.mockResolvedValue(mockUser);

            await expect(authService.registerUser(registerData)).rejects.toMatchObject({
                statusCode: HTTP_STATUS.CONFLICT,
                errorCode: ERROR_CODE.RESOURCE_ALREADY_EXISTS,
            });

            expect(argon2.hash).not.toHaveBeenCalled();
            expect(mockAuthRepository.register).not.toHaveBeenCalled();
        });

        it('should still register the user when verification email queueing fails', async () => {
            mockAuthRepository.findUserByEmail.mockResolvedValue(null);
            (argon2.hash as jest.Mock).mockResolvedValue('hashed-password');
            mockAuthRepository.register.mockResolvedValue(mockUser);
            (emailService.enqueueVerificationEmail as jest.Mock).mockRejectedValueOnce(new Error('queue unavailable'));

            await expect(authService.registerUser(registerData)).resolves.toEqual(mockUser);
        });
    });

    // ─── resendVerificationEmail ──────────────────────────────────────────────

    describe('resendVerificationEmail', () => {
        it('should do nothing when the user does not exist', async () => {
            mockAuthRepository.findUserByEmail.mockResolvedValue(null);

            await expect(authService.resendVerificationEmail('missing@example.com')).resolves.not.toThrow();

            expect(mockAuthRepository.setEmailVerificationToken).not.toHaveBeenCalled();
            expect(emailService.enqueueVerificationEmail).not.toHaveBeenCalled();
        });

        it('should do nothing when the user is already verified', async () => {
            mockAuthRepository.findUserByEmail.mockResolvedValue({ ...mockUser, emailVerifiedAt: new Date() });

            await expect(authService.resendVerificationEmail(mockUser.email)).resolves.not.toThrow();

            expect(mockAuthRepository.setEmailVerificationToken).not.toHaveBeenCalled();
            expect(emailService.enqueueVerificationEmail).not.toHaveBeenCalled();
        });

        it('should refresh the verification token and enqueue an email for an unverified user', async () => {
            mockAuthRepository.findUserByEmail.mockResolvedValue(mockUser);
            mockAuthRepository.setEmailVerificationToken.mockResolvedValue(true);

            await expect(authService.resendVerificationEmail(mockUser.email)).resolves.not.toThrow();

            expect(mockAuthRepository.setEmailVerificationToken).toHaveBeenCalledWith(
                mockUser.id,
                expect.any(String),
                expect.any(Date),
            );
            const resendEmailCall: Parameters<typeof emailService.enqueueVerificationEmail>[0] | undefined =
                jest.mocked(emailService.enqueueVerificationEmail).mock.calls[0]?.[0];

            expect(resendEmailCall).toEqual(
                expect.objectContaining({
                    to: mockUser.email,
                    name: mockUser.name,
                    verificationUrl: expect.stringContaining('/api/v1/auth/verify-email?token=') as string,
                }),
            );
        });

        it('should return successfully when the verification token cannot be updated', async () => {
            mockAuthRepository.findUserByEmail.mockResolvedValue(mockUser);
            mockAuthRepository.setEmailVerificationToken.mockResolvedValue(false);

            await expect(authService.resendVerificationEmail(mockUser.email)).resolves.not.toThrow();

            expect(emailService.enqueueVerificationEmail).not.toHaveBeenCalled();
        });

        it('should return a service unavailable error when the resend enqueue fails', async () => {
            mockAuthRepository.findUserByEmail.mockResolvedValue(mockUser);
            mockAuthRepository.setEmailVerificationToken.mockResolvedValue(true);
            (emailService.enqueueVerificationEmail as jest.Mock).mockRejectedValueOnce(new Error('queue unavailable'));

            await expect(authService.resendVerificationEmail(mockUser.email)).rejects.toMatchObject({
                statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
                errorCode: ERROR_CODE.INTERNAL_SERVER_ERROR,
                message: 'Verification email could not be sent. Please try again.',
            });
        });
    });

    // ─── loginUser ────────────────────────────────────────────────────────────

    describe('loginUser', () => {
        const loginData = { email: 'test@example.com', password: 'password123' };

        it('should login user and return tokens', async () => {
            const verifiedUser = {
                ...mockUser,
                accountStatus: ACCOUNT_STATUS.ACTIVE,
                emailVerifiedAt: new Date(),
            };
            mockAuthRepository.findUserByEmail.mockResolvedValue(verifiedUser);
            (argon2.verify as jest.Mock).mockResolvedValue(true);
            mockAuthRepository.createRefreshSession.mockResolvedValue(mockSession);
            mockAuthRepository.findActiveSessionsByUser.mockResolvedValue([mockSession]);
            (jwtUtils.generateAccessToken as jest.Mock).mockReturnValue('access-token');
            (jwtUtils.generateRefreshToken as jest.Mock).mockReturnValue('refresh-token');

            const result = await authService.loginUser(loginData);

            expect(result.accessToken).toBe('access-token');
            expect(result.refreshToken).toBe('refresh-token');
            expect(result.user).toEqual(verifiedUser);
            expect(mockAuthRepository.createRefreshSession).toHaveBeenCalledWith(
                expect.objectContaining({ userId: mockUser.id }),
            );
        });

        it('should throw UNAUTHORIZED when user is not found', async () => {
            mockAuthRepository.findUserByEmail.mockResolvedValue(null);

            await expect(authService.loginUser(loginData)).rejects.toMatchObject({
                statusCode: HTTP_STATUS.UNAUTHORIZED,
                errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
            });
        });

        it('should throw FORBIDDEN when user account is suspended', async () => {
            mockAuthRepository.findUserByEmail.mockResolvedValue({
                ...mockUser,
                accountStatus: ACCOUNT_STATUS.SUSPENDED,
                emailVerifiedAt: new Date(),
            });
            (argon2.verify as jest.Mock).mockResolvedValue(true);

            await expect(authService.loginUser(loginData)).rejects.toMatchObject({
                statusCode: HTTP_STATUS.FORBIDDEN,
                errorCode: ERROR_CODE.AUTHORIZATION_ERROR,
                message: 'User account is suspended',
            });
        });

        it('should throw FORBIDDEN when user account is banned', async () => {
            mockAuthRepository.findUserByEmail.mockResolvedValue({
                ...mockUser,
                accountStatus: ACCOUNT_STATUS.BANNED,
                emailVerifiedAt: new Date(),
            });
            (argon2.verify as jest.Mock).mockResolvedValue(true);

            await expect(authService.loginUser(loginData)).rejects.toMatchObject({
                statusCode: HTTP_STATUS.FORBIDDEN,
                errorCode: ERROR_CODE.AUTHORIZATION_ERROR,
                message: 'User account is banned',
            });
        });

        it('should throw UNAUTHORIZED for invalid password', async () => {
            mockAuthRepository.findUserByEmail.mockResolvedValue(mockUser);
            (argon2.verify as jest.Mock).mockResolvedValue(false);

            await expect(authService.loginUser(loginData)).rejects.toMatchObject({
                statusCode: HTTP_STATUS.UNAUTHORIZED,
                errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
            });
        });

        it('should throw FORBIDDEN when credentials are valid but email is not verified', async () => {
            mockAuthRepository.findUserByEmail.mockResolvedValue(mockUser);
            (argon2.verify as jest.Mock).mockResolvedValue(true);

            await expect(authService.loginUser(loginData)).rejects.toMatchObject({
                statusCode: HTTP_STATUS.FORBIDDEN,
                errorCode: ERROR_CODE.AUTHORIZATION_ERROR,
                message: 'Please verify your email before logging in',
            });
        });

        it('should revoke oldest sessions when active session count exceeds limit', async () => {
            const MAX = 5;
            const makeSession = (i: number): RefreshToken => ({
                ...mockSession,
                id: `session-${i}`,
                expiresAt: new Date(Date.now() + i * 1000),
            });
            // 6 active sessions — one over the limit
            const activeSessions = Array.from({ length: MAX + 1 }, (_, i) => makeSession(i));

            mockAuthRepository.findUserByEmail.mockResolvedValue({
                ...mockUser,
                accountStatus: ACCOUNT_STATUS.ACTIVE,
                emailVerifiedAt: new Date(),
            });
            (argon2.verify as jest.Mock).mockResolvedValue(true);
            mockAuthRepository.createRefreshSession.mockResolvedValue(mockSession);
            mockAuthRepository.findActiveSessionsByUser.mockResolvedValue(activeSessions);
            (jwtUtils.generateAccessToken as jest.Mock).mockReturnValue('access-token');
            (jwtUtils.generateRefreshToken as jest.Mock).mockReturnValue('refresh-token');

            await authService.loginUser(loginData);

            // Should revoke exactly 1 session (the oldest, session-0)
            expect(mockAuthRepository.revokeRefreshSession).toHaveBeenCalledTimes(1);
            expect(mockAuthRepository.revokeRefreshSession).toHaveBeenCalledWith('session-0');
        });

        it('should not revoke sessions when active session count is within limit', async () => {
            mockAuthRepository.findUserByEmail.mockResolvedValue({
                ...mockUser,
                accountStatus: ACCOUNT_STATUS.ACTIVE,
                emailVerifiedAt: new Date(),
            });
            (argon2.verify as jest.Mock).mockResolvedValue(true);
            mockAuthRepository.createRefreshSession.mockResolvedValue(mockSession);
            mockAuthRepository.findActiveSessionsByUser.mockResolvedValue([mockSession]);
            (jwtUtils.generateAccessToken as jest.Mock).mockReturnValue('access-token');
            (jwtUtils.generateRefreshToken as jest.Mock).mockReturnValue('refresh-token');

            await authService.loginUser(loginData);

            expect(mockAuthRepository.revokeRefreshSession).not.toHaveBeenCalled();
        });
    });

    // ─── refreshTokens ────────────────────────────────────────────────────────

    describe('refreshTokens', () => {
        it('should rotate tokens successfully', async () => {
            (jwtUtils.verifyRefreshToken as jest.Mock).mockReturnValue({ sub: 'user-id', jti: 'session-id' });
            mockAuthRepository.consumeRefreshSession.mockResolvedValue(mockSession);
            mockAuthRepository.findUserById.mockResolvedValue({
                ...mockUser,
                accountStatus: ACCOUNT_STATUS.ACTIVE,
                emailVerifiedAt: new Date(),
            });
            mockAuthRepository.createRefreshSession.mockResolvedValue({ ...mockSession, id: 'new-session-id' });
            (jwtUtils.generateAccessToken as jest.Mock).mockReturnValue('new-access-token');
            (jwtUtils.generateRefreshToken as jest.Mock).mockReturnValue('new-refresh-token');

            const result = await authService.refreshTokens('old-refresh-token');

            expect(result.accessToken).toBe('new-access-token');
            expect(result.refreshToken).toBe('new-refresh-token');
            expect(mockAuthRepository.consumeRefreshSession).toHaveBeenCalledWith('session-id');
        });

        it('should throw UNAUTHORIZED when session is not found (consumed or revoked)', async () => {
            (jwtUtils.verifyRefreshToken as jest.Mock).mockReturnValue({ sub: 'user-id', jti: 'session-id' });
            mockAuthRepository.consumeRefreshSession.mockResolvedValue(null);

            await expect(authService.refreshTokens('old-token')).rejects.toMatchObject({
                statusCode: HTTP_STATUS.UNAUTHORIZED,
                errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
            });
        });

        it('should throw UNAUTHORIZED when session is expired', async () => {
            (jwtUtils.verifyRefreshToken as jest.Mock).mockReturnValue({ sub: 'user-id', jti: 'session-id' });
            mockAuthRepository.consumeRefreshSession.mockResolvedValue({
                ...mockSession,
                expiresAt: new Date(Date.now() - 1000),
            });

            await expect(authService.refreshTokens('old-token')).rejects.toMatchObject({
                statusCode: HTTP_STATUS.UNAUTHORIZED,
                errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
            });
        });

        it('should throw UNAUTHORIZED when user is not found', async () => {
            (jwtUtils.verifyRefreshToken as jest.Mock).mockReturnValue({ sub: 'user-id', jti: 'session-id' });
            mockAuthRepository.consumeRefreshSession.mockResolvedValue(mockSession);
            mockAuthRepository.findUserById.mockResolvedValue(null);

            await expect(authService.refreshTokens('old-token')).rejects.toMatchObject({
                statusCode: HTTP_STATUS.UNAUTHORIZED,
                errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
            });
        });

        it('should throw UNAUTHORIZED when user is suspended', async () => {
            (jwtUtils.verifyRefreshToken as jest.Mock).mockReturnValue({ sub: 'user-id', jti: 'session-id' });
            mockAuthRepository.consumeRefreshSession.mockResolvedValue(mockSession);
            mockAuthRepository.findUserById.mockResolvedValue({
                ...mockUser,
                accountStatus: ACCOUNT_STATUS.SUSPENDED,
                emailVerifiedAt: new Date(),
            });

            await expect(authService.refreshTokens('old-token')).rejects.toMatchObject({
                statusCode: HTTP_STATUS.UNAUTHORIZED,
                errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
            });
        });
    });

    // ─── logout ───────────────────────────────────────────────────────────────

    describe('logout', () => {
        it('should revoke the session for the authenticated user', async () => {
            (jwtUtils.verifyRefreshToken as jest.Mock).mockReturnValue({ sub: 'user-id', jti: 'session-id' });
            mockAuthRepository.findRefreshSession.mockResolvedValue(mockSession);

            await authService.logout('user-id', 'refresh-token');

            expect(mockAuthRepository.revokeRefreshSession).toHaveBeenCalledWith('session-id');
        });

        it('should throw UNAUTHORIZED when session belongs to a different user', async () => {
            (jwtUtils.verifyRefreshToken as jest.Mock).mockReturnValue({ sub: 'other-user-id', jti: 'session-id' });
            mockAuthRepository.findRefreshSession.mockResolvedValue({ ...mockSession, userId: 'other-user-id' });

            await expect(authService.logout('user-id', 'refresh-token')).rejects.toMatchObject({
                statusCode: HTTP_STATUS.UNAUTHORIZED,
                errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
            });

            expect(mockAuthRepository.revokeRefreshSession).not.toHaveBeenCalled();
        });

        it('should throw UNAUTHORIZED when session is not found', async () => {
            (jwtUtils.verifyRefreshToken as jest.Mock).mockReturnValue({ sub: 'user-id', jti: 'session-id' });
            mockAuthRepository.findRefreshSession.mockResolvedValue(null);

            await expect(authService.logout('user-id', 'refresh-token')).rejects.toMatchObject({
                statusCode: HTTP_STATUS.UNAUTHORIZED,
                errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
            });
        });
    });

    // ─── logoutAll ────────────────────────────────────────────────────────────

    describe('logoutAll', () => {
        it('should revoke all sessions for the user', async () => {
            await authService.logoutAll('user-id');

            expect(mockAuthRepository.revokeAllUserSessions).toHaveBeenCalledWith('user-id');
        });
    });

    // ─── getActiveSessions ────────────────────────────────────────────────────

    describe('getActiveSessions', () => {
        it('should return active sessions for the user', async () => {
            const sessions = [mockSession, { ...mockSession, id: 'session-2' }];
            mockAuthRepository.findActiveSessionsByUser.mockResolvedValue(sessions);

            const result = await authService.getActiveSessions('user-id');

            expect(result).toEqual(sessions);
            expect(mockAuthRepository.findActiveSessionsByUser).toHaveBeenCalledWith('user-id');
        });

        it('should return an empty array when no active sessions exist', async () => {
            mockAuthRepository.findActiveSessionsByUser.mockResolvedValue([]);

            const result = await authService.getActiveSessions('user-id');

            expect(result).toEqual([]);
        });
    });

    // ─── verifyEmail ──────────────────────────────────────────────────────────

    describe('verifyEmail', () => {
        it('should verify email successfully', async () => {
            mockAuthRepository.verifyEmail.mockResolvedValue(true);

            await expect(authService.verifyEmail('valid-token')).resolves.not.toThrow();
            expect(mockAuthRepository.verifyEmail).toHaveBeenCalledWith('valid-token');
        });

        it('should throw a validation error when the token is invalid or expired', async () => {
            mockAuthRepository.verifyEmail.mockResolvedValue(false);

            await expect(authService.verifyEmail('invalid-token')).rejects.toMatchObject({
                statusCode: HTTP_STATUS.BAD_REQUEST,
                errorCode: ERROR_CODE.VALIDATION_ERROR,
                message: 'Invalid or expired verification token',
            });
        });

        it('should preserve repository failures as server-side errors', async () => {
            const repositoryError = new DatabaseError('[AuthRepository.verifyEmail] connection lost');
            mockAuthRepository.verifyEmail.mockRejectedValue(repositoryError);

            await expect(authService.verifyEmail('valid-token')).rejects.toBe(repositoryError);
        });
    });
});
