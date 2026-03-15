/**
 * Centralized route definitions for the application.
 * @module routes
 * @description This file imports and aggregates all module-specific routes, providing a single
 * entry point for route management. As new modules are developed, their routes
 * should be added here to maintain a clean and organized structure.
 */

import { Router } from 'express';
import { authRoutes } from '@modules/auth';

const router = Router();

// Register module routes
router.use('/auth', authRoutes);

// Add more modules here as they are developed
// router.use('/products', productRoutes);

export default router;
