/**
 * Not Found Middleware
 * @description Catch-all middleware to handle requests to undefined routes,
 * responding with a 404 NotFoundError.
 */

import type { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../errors';

export const notFound = (req: Request, _res: Response, next: NextFunction): void => {
    next(new NotFoundError(`Can't find ${req.originalUrl} on this server`));
};
