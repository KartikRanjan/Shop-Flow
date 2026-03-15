/**
 * AuthController
 * @module auth/controllers
 * @description This file defines the AuthController class, which handles authentication-related operations.
 */

import type { Request, Response } from 'express';
import { HTTP_STATUS } from '@constants';
import { successResponse } from '@utils';
import { toAuthUserDto } from '../dto';
import type { registerRequestSchema, loginRequestSchema } from '../validations';
import type { IAuthService } from '../types';
import type { TypedRequest } from '@types';

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
        const user = await this.authService.loginUser(req.body);
        const userDto = toAuthUserDto(user);

        return res.status(HTTP_STATUS.OK).json(successResponse(userDto, 'Login successful'));
    };

    logout = (_req: Request, res: Response) => {
        return res.status(HTTP_STATUS.OK).json(successResponse(null, 'Logout successful'));
    };
}
