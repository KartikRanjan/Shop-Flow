/**
 * Auth Module
 * @module auth
 * @description Composes and exports authentication module dependencies.
 * Wires AuthRepository → AuthService → AuthController.
 */

import { db } from '@infrastructure/database';
import { AuthController } from './controllers';
import { AuthService } from './services';
import { AuthRepository } from './repositories';

const authRepository = new AuthRepository(db);
const authService = new AuthService(authRepository);

export const authController = new AuthController(authService);
