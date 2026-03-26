/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Global Error Handling Middleware
 * @module middlewares
 * @description Global error handling middleware for the Express application.
 * Handles both operational AppErrors (structured) and unexpected errors (generic 500).
 */

import type { Request, Response, NextFunction } from 'express';
import { AppError, DatabaseError } from '@errors';
import { errorResponse } from '@utils';
import { ERROR_CODE, HTTP_STATUS } from '@constants';
import { logger } from '@infrastructure/logger';
import { env } from '@config/env';

export const errorHandler = (err: Error | AppError, req: Request, res: Response, next: NextFunction) => {
    // Known operational error — use structured AppError fields
    if (err instanceof AppError) {
        return res
            .status(err.statusCode)
            .json(errorResponse(err.message, err.errorCode, err.details as unknown[] | undefined));
    }

    // Known infrastructure error — log internally, never expose SQL/internals to client
    if (err instanceof DatabaseError) {
        const stack = env.NODE_ENV === 'production' ? undefined : err.stack;
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            ...errorResponse('Internal Server Error', ERROR_CODE.INTERNAL_SERVER_ERROR),
            ...(stack && { stack }),
        });
    }

    // Unexpected / programming error — log full stack, return generic 500
    logger.error(
        {
            err,
            request: {
                method: req.method,
                url: req.originalUrl,
                params: req.params,
                query: req.query,
                user: req.user ? { id: req.user.id } : 'anonymous',
            },
        },
        'Unhandled error',
    );

    const message = env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message || 'Internal Server Error';

    const stack = env.NODE_ENV === 'production' ? undefined : err.stack;

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        ...errorResponse(message, ERROR_CODE.INTERNAL_SERVER_ERROR),
        ...(stack && { stack }),
    });
};
