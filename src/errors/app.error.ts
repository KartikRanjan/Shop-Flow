import { ERROR_CODE, HTTP_STATUS } from '../constants';

/**
 * Base Application Error Class
 * @description Structured error handling following coding standards with object
 * parameters, proper error codes, HTTP status codes, and operational error classification.
 * This class serves as the base for all custom errors in the application, providing
 * a consistent format for error handling and logging.
 */

export interface AppErrorOptions {
    message: string;
    statusCode?: number;
    errorCode?: string;
    isOperational?: boolean;
    details?: unknown; /** Optional extra context (e.g. validation field errors, upstream response) */
}

export default class AppError extends Error {
    public readonly statusCode: number;
    public readonly errorCode: string;
    public readonly isOperational: boolean;
    public readonly details: unknown;

    constructor({
        message,
        statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
        errorCode = ERROR_CODE.INTERNAL_SERVER_ERROR,
        isOperational = true,
        details,
    }: AppErrorOptions) {
        super(message);

        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.isOperational = isOperational;
        this.name = this.constructor.name;
        this.details = details;

        Error.captureStackTrace(this, this.constructor);
    }
}
