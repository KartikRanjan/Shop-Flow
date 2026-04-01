/**
 * AuthController
 * @module auth/controllers
 * @description This file defines the AuthController class, which handles authentication-related operations.
 */

import type { Request, Response } from 'express';
import { AUTH_COOKIE_PATH, ERROR_CODE, HTTP_STATUS } from '@constants';
import { successResponse } from '@utils';
import { toAuthUserDto, toSessionDto } from '../dto';
import type {
    registerRequestSchema,
    loginRequestSchema,
    resendVerificationEmailRequestSchema,
    forgotPasswordRequestSchema,
    resetPasswordRequestSchema,
} from '../validations';
import type { IAuthService } from '../types';
import type { TypedRequest } from '@types';
import { AppError } from '@errors';
import { env } from '@config/env';
import { EMAIL_TEMPLATE } from '@infrastructure/email/email.constants';
import { renderTemplate } from '@infrastructure/email/template.engine';

export default class AuthController {
    constructor(private readonly authService: IAuthService) {}

    /** Register a new user */
    register = async (req: TypedRequest<typeof registerRequestSchema>, res: Response) => {
        const newUser = await this.authService.registerUser(req.body);
        return res
            .status(HTTP_STATUS.CREATED)
            .json(successResponse(toAuthUserDto(newUser), 'User registered successfully'));
    };

    /** Resend email verification instructions */
    resendVerificationEmail = async (req: TypedRequest<typeof resendVerificationEmailRequestSchema>, res: Response) => {
        await this.authService.resendVerificationEmail(req.body.email);
        return res
            .status(HTTP_STATUS.OK)
            .json(successResponse(null, 'If an account exists, a verification email will be sent'));
    };

    /** Request a password reset link */
    forgotPassword = async (req: TypedRequest<typeof forgotPasswordRequestSchema>, res: Response) => {
        await this.authService.forgotPassword(req.body);
        return res
            .status(HTTP_STATUS.OK)
            .json(successResponse(null, 'If an account exists, a password reset email will be sent'));
    };

    /** Reset password using a valid token */
    resetPassword = async (req: TypedRequest<typeof resetPasswordRequestSchema>, res: Response) => {
        await this.authService.resetPassword(req.body);
        return res.status(HTTP_STATUS.OK).json(successResponse(null, 'Password has been reset successfully'));
    };

    /** Verify if a password reset token is still valid */
    verifyResetToken = async (req: Request, res: Response) => {
        const { token } = req.query;

        if (typeof token !== 'string') {
            throw new AppError({
                message: 'Invalid reset token',
                statusCode: HTTP_STATUS.BAD_REQUEST,
                errorCode: ERROR_CODE.VALIDATION_ERROR,
            });
        }

        await this.authService.verifyResetToken(token);

        return res.status(HTTP_STATUS.OK).json(successResponse(null, 'Token is valid'));
    };

    /** Authenticate user and issue tokens */
    login = async (req: TypedRequest<typeof loginRequestSchema>, res: Response) => {
        const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip;
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

    /** Refresh access and refresh tokens */
    refresh = async (req: Request, res: Response) => {
        const refreshToken = req.cookies?.refreshToken as string | undefined;

        if (!refreshToken) {
            throw new AppError({
                message: 'Refresh token not found',
                statusCode: HTTP_STATUS.UNAUTHORIZED,
                errorCode: ERROR_CODE.AUTHENTICATION_ERROR,
            });
        }

        const { accessToken, refreshToken: newRefreshToken } = await this.authService.refreshTokens(refreshToken);

        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: AUTH_COOKIE_PATH,
            maxAge: Number(env.REFRESH_TOKEN_EXPIRES_IN_DAYS) * 24 * 60 * 60 * 1000,
        });

        return res.status(HTTP_STATUS.OK).json(successResponse({ accessToken }, 'Tokens refreshed successfully'));
    };

    /** Revoke current session and clear cookies */
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

    /** Revoke all active sessions for the user */
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

    /** Retrieve all active sessions for the user */
    getActiveSessions = async (req: Request, res: Response) => {
        const sessions = await this.authService.getActiveSessions(req.user!.id);
        return res
            .status(HTTP_STATUS.OK)
            .json(successResponse(sessions.map(toSessionDto), 'Active sessions retrieved successfully'));
    };

    /** Verify user email address */
    verifyEmail = async (req: Request, res: Response) => {
        const { token } = req.query;

        try {
            if (typeof token !== 'string') {
                const { html } = renderTemplate(EMAIL_TEMPLATE.VERIFICATION_RESULT, {
                    clientUrl: env.CLIENT_URL,
                    success: false,
                    message: 'Invalid verification token',
                });
                return res.status(HTTP_STATUS.BAD_REQUEST).send(html);
            }

            await this.authService.verifyEmail(token);
            const { html } = renderTemplate(EMAIL_TEMPLATE.VERIFICATION_RESULT, {
                clientUrl: env.CLIENT_URL,
                success: true,
            });
            return res.status(HTTP_STATUS.OK).send(html);
        } catch (error) {
            const message =
                error instanceof AppError ? error.message : 'An unexpected error occurred during verification';
            const { html } = renderTemplate(EMAIL_TEMPLATE.VERIFICATION_RESULT, {
                clientUrl: env.CLIENT_URL,
                success: false,
                message,
            });
            return res.status(HTTP_STATUS.BAD_REQUEST).send(html);
        }
    };
}
