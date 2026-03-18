/**
 * AuthService Unit Tests
 * @description Unit tests for the AuthService class.
 */

import AuthService from '../../services/auth.service';
import type { IAuthRepository, User, RefreshToken } from '../../types';
import argon2 from 'argon2';
import { HTTP_STATUS, USER_ROLES, ERROR_CODE } from '@constants';
import * as jwtUtils from '@utils/jwt.util';

// Mock dependencies
jest.mock('argon2');
jest.mock('@utils/jwt.util');
jest.mock('@config/env', () => ({
    env: {
        REFRESH_TOKEN_EXPIRES_IN_DAYS: '30',
        ACCESS_TOKEN_EXPIRES_IN: '15m',
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
        isActive: true,
        isEmailVerified: false,
        isPhoneVerified: false,
        phoneNumber: null,
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
            findByEmail: jest.fn(),
            findById: jest.fn(),
            createRefreshSession: jest.fn(),
            findRefreshSession: jest.fn(),
            consumeRefreshSession: jest.fn(),
            revokeRefreshSession: jest.fn(),
            revokeAllUserSessions: jest.fn(),
            findActiveSessionsByUser: jest.fn(),
        } as jest.Mocked<IAuthRepository>;

        authService = new AuthService(mockAuthRepository);
    });

    // ─── registerUser ─────────────────────────────────────────────────────────

    describe('registerUser', () => {
        const registerData = { email: 'test@example.com', name: 'Test User', password: 'password123' };

        it('should register a new user successfully', async () => {
            mockAuthRepository.findByEmail.mockResolvedValue(null);
            (argon2.hash as jest.Mock).mockResolvedValue('hashed-password');
            mockAuthRepository.register.mockResolvedValue(mockUser);

            const result = await authService.registerUser(registerData);

            expect(result).toEqual(mockUser);
            expect(mockAuthRepository.findByEmail).toHaveBeenCalledWith(registerData.email);
            expect(argon2.hash).toHaveBeenCalledWith(registerData.password);
            expect(mockAuthRepository.register).toHaveBeenCalledWith(
                expect.objectContaining({ passwordHash: 'hashed-password', email: registerData.email }),
            );
        });

        it('should throw CONFLICT AppError if user already exists', async () => {
            mockAuthRepository.findByEmail.mockResolvedValue(mockUser);

            await expect(authService.registerUser(registerData)).rejects.toMatchObject({
                statusCode: HTTP_STATUS.CONFLICT,
                errorCode: ERROR_CODE.RESOURCE_ALREADY_EXISTS,
            });

            expect(argon2.hash).not.toHaveBeenCalled();
            expect(mockAuthRepository.register).not.toHaveBeenCalled();
        });
    });

    // ─── loginUser ────────────────────────────────────────────────────────────

    describe('loginUser', () => {
        const loginData = { email: 'test@example.com', password: 'password123' };

        it('should login user and return tokens', async () => {
            mockAuthRepository.findByEmail.mockResolvedValue(mockUser);
            (argon2.verify as jest.Mock).mockResolvedValue(true);
            mockAuthRepository.createRefreshSession.mockResolvedValue(mockSession);
            mockAuthRepository.findActiveSessionsByUser.mockResolvedValue([mockSession]);
            (jwtUtils.generateAccessToken as jest.Mock).mockReturnValue('access-token');
            (jwtUtils.generateRefreshToken as jest.Mock).mockReturnValue('refresh-token');

            const result = await authService.loginUser(loginData);

            expect(result.accessToken).toBe('access-token');
            expect(result.refreshToken).toBe('refresh-token');
            expect(result.user).toEqual(mockUser);
            expect(mockAuthRepository.createRefreshSession).toHaveBeenCalledWith(
                expect.objectContaining({ userId: mockUser.id }),
            );
        });

        it('should throw UNAUTHORIZED when user is not found', async () => {
            mockAuthRepository.findByEmail.mockResolvedValue(null);

            await expect(authService.loginUser(loginData)).rejects.toMatchObject({
                statusCode: HTTP_STATUS.UNAUTHORIZED,
                errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
            });
        });

        it('should throw FORBIDDEN when user account is inactive', async () => {
            mockAuthRepository.findByEmail.mockResolvedValue({ ...mockUser, isActive: false });

            await expect(authService.loginUser(loginData)).rejects.toMatchObject({
                statusCode: HTTP_STATUS.FORBIDDEN,
                errorCode: ERROR_CODE.AUTHORIZATION_ERROR,
            });
        });

        it('should throw FORBIDDEN when user account is deleted', async () => {
            mockAuthRepository.findByEmail.mockResolvedValue({ ...mockUser, deletedAt: new Date() });

            await expect(authService.loginUser(loginData)).rejects.toMatchObject({
                statusCode: HTTP_STATUS.FORBIDDEN,
                errorCode: ERROR_CODE.AUTHORIZATION_ERROR,
            });
        });

        it('should throw UNAUTHORIZED for invalid password', async () => {
            mockAuthRepository.findByEmail.mockResolvedValue(mockUser);
            (argon2.verify as jest.Mock).mockResolvedValue(false);

            await expect(authService.loginUser(loginData)).rejects.toMatchObject({
                statusCode: HTTP_STATUS.UNAUTHORIZED,
                errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
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

            mockAuthRepository.findByEmail.mockResolvedValue(mockUser);
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
            mockAuthRepository.findByEmail.mockResolvedValue(mockUser);
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
            mockAuthRepository.findById.mockResolvedValue(mockUser);
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
            mockAuthRepository.findById.mockResolvedValue(null);

            await expect(authService.refreshTokens('old-token')).rejects.toMatchObject({
                statusCode: HTTP_STATUS.UNAUTHORIZED,
                errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
            });
        });

        it('should throw FORBIDDEN when user is inactive', async () => {
            (jwtUtils.verifyRefreshToken as jest.Mock).mockReturnValue({ sub: 'user-id', jti: 'session-id' });
            mockAuthRepository.consumeRefreshSession.mockResolvedValue(mockSession);
            mockAuthRepository.findById.mockResolvedValue({ ...mockUser, isActive: false });

            await expect(authService.refreshTokens('old-token')).rejects.toMatchObject({
                statusCode: HTTP_STATUS.FORBIDDEN,
                errorCode: ERROR_CODE.AUTHORIZATION_ERROR,
            });
        });

        it('should throw FORBIDDEN when user is deleted', async () => {
            (jwtUtils.verifyRefreshToken as jest.Mock).mockReturnValue({ sub: 'user-id', jti: 'session-id' });
            mockAuthRepository.consumeRefreshSession.mockResolvedValue(mockSession);
            mockAuthRepository.findById.mockResolvedValue({ ...mockUser, deletedAt: new Date() });

            await expect(authService.refreshTokens('old-token')).rejects.toMatchObject({
                statusCode: HTTP_STATUS.FORBIDDEN,
                errorCode: ERROR_CODE.AUTHORIZATION_ERROR,
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
});
