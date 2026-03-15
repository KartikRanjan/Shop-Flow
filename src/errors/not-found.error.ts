/**
 * Not Found Error Class
 * @module NotFoundError
 * @description Represents a 404 Not Found error, typically used when a requested resource cannot be found.
 */

import AppError from './app.error';
import { ERROR_CODE, HTTP_STATUS } from '../constants';

export default class NotFoundError extends AppError {
    constructor(message: string = 'Resource not found', details?: unknown) {
        super({
            message,
            statusCode: HTTP_STATUS.NOT_FOUND,
            errorCode: ERROR_CODE.RESOURCE_NOT_FOUND,
            isOperational: true,
            details,
        });
    }
}
