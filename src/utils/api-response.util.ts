/**
 * API Response Utility
 * @module utils
 * @description Pure factory functions that return a standardised response shape.
 * Controllers own the HTTP concern (res.status + res.json); these helpers only
 * build the consistent envelope. This makes the utilities easy to unit-test
 * without mocking Express's Response object.
 */

// ─── Response Shape Interfaces ────────────────────────────────────────────────

export interface SuccessResponse<T = unknown> {
    success: true;
    message: string;
    data: T;
    timestamp: string;
}

export interface ErrorResponse {
    success: false;
    message: string;
    errorCode: string;
    errors?: unknown[];
    timestamp: string;
}

// ─── Factory Functions ────────────────────────────────────────────────────────

/**
 * Build a success response envelope.
 * @example
 * return res.status(201).json(successResponse(user, 'User registered'));
 */
export const successResponse = <T = unknown>(
    data: T,
    message = 'Operation successful',
): SuccessResponse<T> => ({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
});

/**
 * Build an error response envelope.
 * @example
 * return res.status(404).json(errorResponse('User not found', 'RESOURCE_NOT_FOUND'));
 */
export const errorResponse = (
    message = 'An unexpected error occurred',
    errorCode = 'INTERNAL_ERROR',
    errors?: unknown[],
): ErrorResponse => ({
    success: false,
    message,
    errorCode,
    ...(errors?.length && { errors }),
    timestamp: new Date().toISOString(),
});
