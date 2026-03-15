/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Global Error Handling Middleware
 * @module middlewares
 * @description Global error handling middleware for the Express application.
 * Handles both operational AppErrors (structured) and unexpected errors (generic 500).
 */

import type { Request, Response, NextFunction } from 'express';
import { AppError } from '@errors';
import { errorResponse } from '@utils';
import { ERROR_CODE, HTTP_STATUS } from '@constants';
import { logger } from '@infrastructure/logger';

export const errorHandler = (
    err: Error | AppError,
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    // Known operational error — use structured AppError fields
    if (err instanceof AppError) {
        return res
            .status(err.statusCode)
            .json(
                errorResponse(err.message, err.errorCode, err.details ? [err.details] : undefined),
            );
    }

    // Unexpected / programming error — log full stack, return generic 500
    logger.error({ err }, 'Unhandled error');

    return res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json(errorResponse('Internal Server Error', ERROR_CODE.INTERNAL_SERVER_ERROR));
};
