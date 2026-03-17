/**
 * Authentication Routes
 * @module auth/routes
 * @description Defines routes for authentication-related operations. Delegates to the authController.
 */

import { Router } from 'express';
import { authController } from '../auth.module';
import { loginRequestSchema, registerRequestSchema } from '../validations';
import { validateRequest, authenticate } from '@middlewares';

const router = Router();

router.post('/login', validateRequest(loginRequestSchema), authController.login);
router.post('/register', validateRequest(registerRequestSchema), authController.register);
router.post('/refresh', authController.refresh);
router.delete('/logout', authenticate.all, authController.logout);
router.delete('/logout-all', authenticate.all, authController.logoutAll);
router.get('/active-sessions', authenticate.all, authController.getActiveSessions);

export default router;
