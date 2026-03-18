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
import { toUserDetailsDto } from '../dto';
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

    /** Retrieve paginated list of users (Admin only) */
    getUsers = async (req: Request & { query: z.infer<typeof getUsersRequestSchema>['query'] }, res: Response) => {
        // After validation middleware, query params are properly typed
        const { page, limit } = req.query;
        const result = await this.userService.findAllUsers({ page, limit });
        return res.status(HTTP_STATUS.OK).json(successResponse(result, 'Users retrieved successfully'));
    };

    /** Retrieve user details by ID */
    getUserById = async (req: TypedRequest<typeof userIdParamsSchema | typeof baseRequestSchema>, res: Response) => {
        const userId = req.params?.id ?? req.user!.id;
        const user = await this.userService.getUserById(userId);

        return res.status(HTTP_STATUS.OK).json(successResponse(toUserDetailsDto(user), 'User retrieved successfully'));
    };

    /** Update user profile information */
    updateUser = async (
        req: TypedRequest<typeof updateUserRequestSchema | typeof updateMeRequestSchema>,
        res: Response,
    ) => {
        const userId = req.params?.id ?? req.user!.id;
        console.log({ userId, body: req.body });

        const user = await this.userService.updateProfileById(userId, req.body);
        return res.status(HTTP_STATUS.OK).json(successResponse(toUserDetailsDto(user), 'User updated successfully'));
    };

    /** Soft delete user account */
    deleteUser = async (req: TypedRequest<typeof userIdParamsSchema | typeof baseRequestSchema>, res: Response) => {
        const userId = req.params?.id ?? req.user!.id;
        await this.userService.deleteAccountById(userId);
        return res.status(HTTP_STATUS.OK).json(successResponse(null, 'User deleted successfully'));
    };
}
