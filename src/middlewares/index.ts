/**
 * Middlewares Index
 * @module middlewares
 * @description Centralized export of all middleware functions for easy import throughout the application.
 */

export { validateRequest } from './validate-request.middleware';
export { errorHandler } from './error-handler.middleware';
export { notFound } from './not-found.middleware';
export { authenticate } from './authenticate.middleware';
