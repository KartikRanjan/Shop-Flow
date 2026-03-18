/**
 * Auth Integration Tests
 * @description Tests the full HTTP pipeline (routing → validation → controller → mocked service).
 * The AuthService is mocked so no real DB connection is needed.
 * The authenticate middleware is also mocked for protected routes.
 */

import request from 'supertest';
import type { Express } from 'express';
import createApp from '../../../../app';
import { HTTP_STATUS, USER_ROLES } from '@constants';
import { AppError } from '@errors';

// ─── Mock AuthService ─────────────────────────────────────────────────────────
// jest.mock is hoisted so the mock factory cannot close over variables defined
// in the same file. We create the mock service inside the factory and expose it
// on the module so the tests can import it.

jest.mock('../../auth.module', () => {
    const service = {
        registerUser: jest.fn(),
        loginUser: jest.fn(),
        refreshTokens: jest.fn(),
        logout: jest.fn(),
        logoutAll: jest.fn(),
        getActiveSessions: jest.fn(),
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AuthController = (require('../../controllers/auth.controller') as { default: new (s: unknown) => unknown })
        .default;
    const controller = new AuthController(service);
    return { authController: controller, _mockService: service };
});

// ─── Mock DB ───────────────────────────────────────────────────────────────────

jest.mock('@infrastructure/database', () => ({
    db: {},
}));

// ─── Mock authenticate middleware ─────────────────────────────────────────────

jest.mock('@middlewares', () => {
    const original = jest.requireActual<typeof import('@middlewares')>('@middlewares');
    const mockMiddleware = (req: Record<string, unknown>, _res: unknown, next: () => void) => {
        req['user'] = { id: 'user-id', email: 'test@example.com', roles: [USER_ROLES.USER] };
        next();
    };
    return {
        ...original,
        authenticate: {
            all: mockMiddleware,
            user: mockMiddleware,
            admin: mockMiddleware,
            seller: mockMiddleware,
            userAndAdmin: mockMiddleware,
            userAndSeller: mockMiddleware,
            adminAndSeller: mockMiddleware,
            hasRoles: () => mockMiddleware,
        },
    };
});

// ─── Mock env ─────────────────────────────────────────────────────────────────
jest.mock('@config/env', () => ({
    env: {
        REFRESH_TOKEN_EXPIRES_IN_DAYS: '30',
        ACCESS_TOKEN_EXPIRES_IN: '15m',
        NODE_ENV: 'test',
        PORT: '3000',
        JWT_ACCESS_SECRET: 'test-secret',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
    },
}));

// ─── Grab the mock service reference ─────────────────────────────────────────

type MockAuthModule = { _mockService: Record<string, jest.Mock> };
const mockAuthService = jest.requireMock<MockAuthModule>('../../auth.module')._mockService;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockUser = {
    id: 'user-id',
    email: 'test@example.com',
    name: 'Test User',
    roles: [USER_ROLES.USER],
    isActive: true,
    isEmailVerified: false,
    isPhoneVerified: false,
    phoneNumber: null,
    passwordHash: 'hashed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
};

const mockSessions = [
    { id: 'session-1', userId: 'user-id', device: 'Chrome', ip: '127.0.0.1', expiresAt: new Date().toISOString() },
    { id: 'session-2', userId: 'user-id', device: 'Firefox', ip: '127.0.0.1', expiresAt: new Date().toISOString() },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Auth Integration Tests', () => {
    let app: Express;

    beforeAll(() => {
        app = createApp();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ── POST /api/v1/auth/register ──────────────────────────────────────────

    describe('POST /api/v1/auth/register', () => {
        const validPayload = { email: 'test@example.com', name: 'Test User', password: 'password123' };

        it('should return 201 and user dto on successful registration', async () => {
            mockAuthService['registerUser'].mockResolvedValue(mockUser);

            const res = await request(app).post('/api/v1/auth/register').send(validPayload);

            expect(res.status).toBe(HTTP_STATUS.CREATED);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(res.body.success).toBe(true);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(res.body.data.email).toBe(validPayload.email);
            // passwordHash must NOT be exposed in the response
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(res.body.data.passwordHash).toBeUndefined();
        });

        it('should return 400 when required fields are missing', async () => {
            const res = await request(app).post('/api/v1/auth/register').send({ email: 'test@example.com' });

            expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
            expect(mockAuthService['registerUser']).not.toHaveBeenCalled();
        });

        it('should return 400 when email is invalid', async () => {
            const res = await request(app)
                .post('/api/v1/auth/register')
                .send({ ...validPayload, email: 'not-an-email' });

            expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
        });

        it('should return 400 when password is too short (< 8 chars)', async () => {
            const res = await request(app)
                .post('/api/v1/auth/register')
                .send({ ...validPayload, password: 'short' });

            expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
        });

        it('should return 409 when user already exists', async () => {
            mockAuthService['registerUser'].mockRejectedValue(
                new AppError({ message: 'User already exists', statusCode: HTTP_STATUS.CONFLICT }),
            );

            const res = await request(app).post('/api/v1/auth/register').send(validPayload);

            expect(res.status).toBe(HTTP_STATUS.CONFLICT);
        });
    });

    // ── POST /api/v1/auth/login ─────────────────────────────────────────────

    describe('POST /api/v1/auth/login', () => {
        const validPayload = { email: 'test@example.com', password: 'password123' };

        it('should return 200, set refreshToken cookie, and return accessToken on success', async () => {
            mockAuthService['loginUser'].mockResolvedValue({
                user: mockUser,
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
            });

            const res = await request(app).post('/api/v1/auth/login').send(validPayload);

            expect(res.status).toBe(HTTP_STATUS.OK);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(res.body.data.accessToken).toBe('access-token');
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(res.body.data.user.email).toBe(validPayload.email);
            // refreshToken should be in HttpOnly cookie, not in response body
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(res.body.data.refreshToken).toBeUndefined();
            expect(res.headers['set-cookie']).toBeDefined();
        });

        it('should return 400 when email is missing', async () => {
            const res = await request(app).post('/api/v1/auth/login').send({ password: 'password123' });

            expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
            expect(mockAuthService['loginUser']).not.toHaveBeenCalled();
        });

        it('should return 401 for invalid credentials', async () => {
            mockAuthService['loginUser'].mockRejectedValue(
                new AppError({ message: 'Invalid email or password', statusCode: HTTP_STATUS.UNAUTHORIZED }),
            );

            const res = await request(app).post('/api/v1/auth/login').send(validPayload);

            expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
        });

        it('should return 403 when account is inactive', async () => {
            mockAuthService['loginUser'].mockRejectedValue(
                new AppError({ message: 'User account is inactive', statusCode: HTTP_STATUS.FORBIDDEN }),
            );

            const res = await request(app).post('/api/v1/auth/login').send(validPayload);

            expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
        });
    });

    // ── POST /api/v1/auth/refresh ───────────────────────────────────────────

    describe('POST /api/v1/auth/refresh', () => {
        it('should return 200 and a new accessToken when refresh cookie is present', async () => {
            mockAuthService['refreshTokens'].mockResolvedValue({
                accessToken: 'new-access-token',
                refreshToken: 'new-refresh-token',
            });

            const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', 'refreshToken=old-refresh-token');

            expect(res.status).toBe(HTTP_STATUS.OK);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(res.body.data.accessToken).toBe('new-access-token');
            expect(res.headers['set-cookie']).toBeDefined();
        });

        it('should return 401 when refresh cookie is missing', async () => {
            const res = await request(app).post('/api/v1/auth/refresh');

            expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
            expect(mockAuthService['refreshTokens']).not.toHaveBeenCalled();
        });

        it('should return 401 when refresh token is invalid or revoked', async () => {
            mockAuthService['refreshTokens'].mockRejectedValue(
                new AppError({
                    message: 'Refresh token is invalid or has been revoked',
                    statusCode: HTTP_STATUS.UNAUTHORIZED,
                }),
            );

            const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', 'refreshToken=bad-token');

            expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
        });
    });

    // ── DELETE /api/v1/auth/logout ──────────────────────────────────────────

    describe('DELETE /api/v1/auth/logout', () => {
        it('should return 200 and clear the refresh cookie on successful logout', async () => {
            mockAuthService['logout'].mockResolvedValue(undefined);

            const res = await request(app)
                .delete('/api/v1/auth/logout')
                .set('Cookie', 'refreshToken=valid-refresh-token');

            expect(res.status).toBe(HTTP_STATUS.OK);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(res.body.success).toBe(true);
            // Cookie should be cleared (value emptied)
            const rawCookies = res.headers['set-cookie'] as string | string[] | undefined;
            const cookieArr = rawCookies ? (Array.isArray(rawCookies) ? rawCookies : [rawCookies]) : [];
            expect(cookieArr.some((c) => c.startsWith('refreshToken=;'))).toBe(true);
        });

        it('should return 401 when refresh cookie is missing', async () => {
            const res = await request(app).delete('/api/v1/auth/logout');

            expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
            expect(mockAuthService['logout']).not.toHaveBeenCalled();
        });
    });

    // ── DELETE /api/v1/auth/logout-all ─────────────────────────────────────

    describe('DELETE /api/v1/auth/logout-all', () => {
        it('should return 200 and revoke all sessions for the authenticated user', async () => {
            mockAuthService['logoutAll'].mockResolvedValue(undefined);

            const res = await request(app).delete('/api/v1/auth/logout-all');

            expect(res.status).toBe(HTTP_STATUS.OK);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(res.body.success).toBe(true);
            expect(mockAuthService['logoutAll']).toHaveBeenCalledWith('user-id');
        });
    });

    // ── GET /api/v1/auth/active-sessions ───────────────────────────────────

    describe('GET /api/v1/auth/active-sessions', () => {
        it('should return 200 and list of active sessions', async () => {
            mockAuthService['getActiveSessions'].mockResolvedValue(mockSessions);

            const res = await request(app).get('/api/v1/auth/active-sessions');

            expect(res.status).toBe(HTTP_STATUS.OK);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(res.body.data).toHaveLength(2);
            expect(mockAuthService['getActiveSessions']).toHaveBeenCalledWith('user-id');
        });

        it('should return 200 with empty array when no active sessions exist', async () => {
            mockAuthService['getActiveSessions'].mockResolvedValue([]);

            const res = await request(app).get('/api/v1/auth/active-sessions');

            expect(res.status).toBe(HTTP_STATUS.OK);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(res.body.data).toHaveLength(0);
        });
    });
});
