/**
 * Validation Error Class
 * @module ValidationError
 * @description Custom error class for validation errors.
 */

import AppError from './app.error';
import { ERROR_CODE, HTTP_STATUS } from '../constants';

export default class ValidationError extends AppError {
    constructor(message: string = 'Validation error', details?: unknown) {
        super({
            message,
            statusCode: HTTP_STATUS.BAD_REQUEST,
            errorCode: ERROR_CODE.VALIDATION_ERROR,
            isOperational: true,
            details,
        });
    }
}
