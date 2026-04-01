/**
 * UserController
 * @module users/controllers
 * @description Handles HTTP request/response for user-related operations.
 */

import type { Request, Response } from 'express';
import type { z } from 'zod';
import { HTTP_STATUS } from '@constants';
import { successResponse } from '@utils';
import type { UserService } from '../services';
import { toUserDetailsDto, toUserProfileDto } from '../dto';
import type { TypedRequest } from '@types';
import type {
    updateUserRequestSchema,
    updateMeRequestSchema,
    userIdParamsSchema,
    baseRequestSchema,
    getUsersRequestSchema,
} from '../validations';

export default class UserController {
    constructor(private readonly userService: UserService) {}

    /** Retrieve paginated list of users (Admin only) — returns full admin details */
    getUsers = async (req: Request & { query: z.infer<typeof getUsersRequestSchema>['query'] }, res: Response) => {
        // After validation middleware, query params are properly typed
        const { page, limit } = req.query;
        const result = await this.userService.findAllUsers({ page, limit });
        return res.status(HTTP_STATUS.OK).json(successResponse(result, 'Users retrieved successfully'));
    };

    /** Retrieve own profile — safe shape without internal moderation fields */
    getMe = async (req: TypedRequest<typeof baseRequestSchema>, res: Response) => {
        const user = await this.userService.getUserById(req.user!.id);
        return res.status(HTTP_STATUS.OK).json(successResponse(toUserProfileDto(user), 'User retrieved successfully'));
    };

    /** Retrieve user by ID (Admin/Seller) — full admin details shape */
    getUserById = async (req: TypedRequest<typeof userIdParamsSchema>, res: Response) => {
        const user = await this.userService.getUserById(req.params.id);
        return res.status(HTTP_STATUS.OK).json(successResponse(toUserDetailsDto(user), 'User retrieved successfully'));
    };

    /** Update own profile — safe shape without internal moderation fields */
    updateMe = async (req: TypedRequest<typeof updateMeRequestSchema>, res: Response) => {
        const user = await this.userService.updateProfileById(req.user!.id, req.body);
        return res.status(HTTP_STATUS.OK).json(successResponse(toUserProfileDto(user), 'User updated successfully'));
    };

    /** Update user by ID (Admin) — full admin details shape */
    updateUser = async (req: TypedRequest<typeof updateUserRequestSchema>, res: Response) => {
        const user = await this.userService.updateProfileById(req.params.id, req.body);
        return res.status(HTTP_STATUS.OK).json(successResponse(toUserDetailsDto(user), 'User updated successfully'));
    };

    /** Soft delete user account */
    deleteUser = async (req: TypedRequest<typeof userIdParamsSchema | typeof baseRequestSchema>, res: Response) => {
        const userId = req.params?.id ?? req.user!.id;
        await this.userService.deleteAccountById(userId);
        return res.status(HTTP_STATUS.OK).json(successResponse(null, 'User deleted successfully'));
    };
}
