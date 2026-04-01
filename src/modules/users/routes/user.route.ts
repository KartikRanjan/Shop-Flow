/**
 * User Routes
 * @module users/routes
 * @description Defines routes for user-related operations. Delegates to the userController. Testing clean restart.
 */

import { Router } from 'express';
import { userController } from '../users.module';
import { authenticate, validateRequest } from '@middlewares';
import {
    updateMeRequestSchema,
    updateUserRequestSchema,
    userIdParamsSchema,
    getUsersRequestSchema,
} from '../validations/user.validation';

const router = Router();

// "Me" routes (Authenticated user's own profile — returns UserProfileDto)
router.get('/me', authenticate.all, userController.getMe);
router.put('/me', authenticate.all, validateRequest(updateMeRequestSchema), userController.updateMe);
router.delete('/me', authenticate.all, userController.deleteUser);

// Admin/Seller routes (Operations by ID — returns UserDetailsDto)
router.get('/', authenticate.admin, validateRequest(getUsersRequestSchema), userController.getUsers);
router.get('/:id', authenticate.adminAndSeller, validateRequest(userIdParamsSchema), userController.getUserById);
router.put('/:id', authenticate.admin, validateRequest(updateUserRequestSchema), userController.updateUser);
router.delete('/:id', authenticate.admin, validateRequest(userIdParamsSchema), userController.deleteUser);

export default router;
