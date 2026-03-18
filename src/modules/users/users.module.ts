/**
 * Users Module
 * @module users
 * @description Composes and exports user module dependencies.
 */

import { db } from '@infrastructure/database';
import UserController from './controllers/user.controller';
import { UserRepository } from './repositories';
import { UserService } from './services';

const userRepository = new UserRepository(db);
const userService = new UserService(userRepository);
export const userController = new UserController(userService);
