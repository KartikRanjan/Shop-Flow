/**
 * AuthController
 * @module auth/controllers
 * @description This file defines the AuthController class, which handles authentication-related operations.
 */

import type { Request, Response } from 'express';
import { AUTH_COOKIE_PATH, ERROR_CODE, HTTP_STATUS } from '@constants';
import { successResponse } from '@utils';
import { toAuthUserDto } from '../dto';
import type { registerRequestSchema, loginRequestSchema } from '../validations';
import type { IAuthService } from '../types';
import type { TypedRequest } from '@types';
import { AppError } from '@errors';
import { env } from '@config/env';

export default class AuthController {
    constructor(private readonly authService: IAuthService) {}

    register = async (req: TypedRequest<typeof registerRequestSchema>, res: Response) => {
        const newUser = await this.authService.registerUser(req.body);

        const userDto = toAuthUserDto(newUser);
        return res
            .status(HTTP_STATUS.CREATED)
            .json(successResponse(userDto, 'User registered successfully'));
    };

    login = async (req: TypedRequest<typeof loginRequestSchema>, res: Response) => {
        const ip =
            (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip;
        const userAgent = req.headers['user-agent'];

        const { user, accessToken, refreshToken } = await this.authService.loginUser({
            ...req.body,
            ip,
            userAgent,
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: AUTH_COOKIE_PATH,
            maxAge: Number(env.REFRESH_TOKEN_EXPIRES_IN_DAYS) * 24 * 60 * 60 * 1000,
        });

        return res
            .status(HTTP_STATUS.OK)
            .json(successResponse({ user: toAuthUserDto(user), accessToken }, 'Login successful'));
    };

    refresh = async (req: Request, res: Response) => {
        const refreshToken = req.cookies?.refreshToken as string | undefined;

        if (!refreshToken) {
            throw new AppError({
                message: 'Refresh token not found',
                statusCode: HTTP_STATUS.UNAUTHORIZED,
                errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
            });
        }

        const { accessToken, refreshToken: newRefreshToken } =
            await this.authService.refreshTokens(refreshToken);

        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: AUTH_COOKIE_PATH,
            maxAge: Number(env.REFRESH_TOKEN_EXPIRES_IN_DAYS) * 24 * 60 * 60 * 1000,
        });

        return res
            .status(HTTP_STATUS.OK)
            .json(successResponse({ accessToken }, 'Tokens refreshed successfully'));
    };

    logout = async (req: Request, res: Response) => {
        const refreshToken = req.cookies?.refreshToken as string | undefined;

        if (!refreshToken) {
            throw new AppError({
                message: 'Refresh token not found',
                statusCode: HTTP_STATUS.UNAUTHORIZED,
                errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
            });
        }

        await this.authService.logout(req.user!.id, refreshToken);

        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: AUTH_COOKIE_PATH,
        });
        return res.status(HTTP_STATUS.OK).json(successResponse(null, 'Logout successful'));
    };

    logoutAll = async (req: Request, res: Response) => {
        await this.authService.logoutAll(req.user!.id);

        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: AUTH_COOKIE_PATH,
        });

        return res.status(HTTP_STATUS.OK).json(successResponse(null, 'All sessions logged out'));
    };

    getActiveSessions = async (req: Request, res: Response) => {
        const sessions = await this.authService.getActiveSessions(req.user!.id);
        return res
            .status(HTTP_STATUS.OK)
            .json(successResponse(sessions, 'Active sessions retrieved successfully'));
    };
}
