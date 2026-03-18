/**
 * Request Validation Middleware
 * @module middlewares
 * @description Middleware to validate incoming requests using Zod schemas. It parses the request body, query, and params against the provided schema and overwrites the original request data with the validated/transformed data. If validation fails, it throws a ValidationError with details about the issues.
 */

import { type ZodType } from 'zod';
import { ValidationError } from '@errors';
import type { Request, Response, NextFunction } from 'express';

type RequestSchemaShape = {
    body?: unknown;
    query?: unknown;
    params?: unknown;
};

export const validateRequest = <S extends RequestSchemaShape>(schema: ZodType<S>) => {
    return async (req: Request, _res: Response, next: NextFunction) => {
        const result = await schema.safeParseAsync({
            body: req.body as unknown,
            query: req.query as unknown,
            params: req.params as unknown,
        });

        if (!result.success) {
            return next(
                new ValidationError(
                    'Request validation failed',
                    result.error.issues.map((issue) => ({
                        field: issue.path.join('.'),
                        message: issue.message,
                    })),
                ),
            );
        }

        const validated = result.data;

        if (validated.body !== undefined) {
            req.body = validated.body;
        }

        if (validated.query !== undefined) {
            // Create a new query object with the validated properties
            const validatedQuery = validated.query as Record<string, unknown>;

            // Clear existing query parameters
            Object.keys(req.query).forEach((key) => {
                delete req.query[key];
            });

            // Add the validated properties
            Object.keys(validatedQuery).forEach((key) => {
                (req.query as Record<string, unknown>)[key] = validatedQuery[key];
            });
        }

        if (validated.params !== undefined) {
            req.params = validated.params as typeof req.params;
        }

        next();
    };
};
